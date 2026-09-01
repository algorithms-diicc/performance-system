import hashlib
import json
import os
import re
from datetime import datetime, timezone
from .ai_transports import (
    AITransportConfigurationError,
    AITransportError,
    AITransportSelection,
    DEFAULT_OPENAI_URL,
    DEFAULT_TIMEOUT_SECONDS,
    resolve_ai_transport,
)
from .individual_ai_mock import individual_mock_transport
from .ai_runtime import (
    AIInvalidLanguageError,
    AIProviderError,
    build_ai_context_hash,
    normalize_ai_language,
    parse_openai_structured_output,
    read_valid_ai_cache,
    write_ai_cache,
)


AI_SCHEMA_VERSION = "1.0"
PROMPT_VERSION = "iter11c2-individual-v1"
DEFAULT_MODEL = "gpt-5.6-luna"
DEFAULT_TRANSPORT = "mock"
CACHE_FILENAME = "AIExplanation.json"
SUPPORTED_LANGUAGES = {"es", "en"}

PRIMARY_METRICS = [
    "DurationTime",
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "Instructions",
    "L1DcacheLoadMisses",
]

ALLOWED_EVIDENCE_KINDS = {
    "snapshot",
    "trend",
    "observed_scaling",
    "outliers",
    "coverage",
    "limitation",
    "availability",
}

FORBIDDEN_COMPLEXITY_PATTERNS = [
    re.compile(r"\bO\s*\(", re.IGNORECASE),
    re.compile(r"\bcomplejidad\s+asint[oó]tica\s+es\b", re.IGNORECASE),
    re.compile(r"\bel algoritmo es O\b", re.IGNORECASE),
]


class AIExplanationError(RuntimeError):
    """Error genérico de la capa de explicación con IA."""


class AINotConfiguredError(AIExplanationError):
    """El servidor no tiene credenciales/configuración para invocar IA."""




class AIOutputRejectedError(AIExplanationError):
    """La salida no superó las validaciones de consistencia locales."""




def generate_ai_explanation(
    static_dir,
    codename,
    results_payload,
    force=False,
    transport=None,
    api_key=None,
    model=None,
    language="es",
    transport_mode=None,
    transport_name=None,
    transport_simulated=None,
):
    resolved_language = normalize_ai_language(language)

    configured_mode = (
        transport_mode
        or os.environ.get("PERFORMANCE_AI_TRANSPORT")
        or DEFAULT_TRANSPORT
    )

    context = build_ai_context(
        results_payload,
        language=resolved_language,
    )

    if transport is not None:
        selection = AITransportSelection(
            name=transport_name or "injected",
            simulated=(
                True
                if transport_simulated is None
                else bool(transport_simulated)
            ),
            requires_api_key=False,
            default_model=(
                model
                or os.environ.get("PERFORMANCE_AI_MODEL")
                or DEFAULT_MODEL
            ),
            send=transport,
        )
    else:
        try:
            selection = resolve_ai_transport(
                configured_mode,
                mock_send=(
                    lambda request_payload, api_key:
                    individual_mock_transport(
                        request_payload=request_payload,
                        api_key=api_key,
                        context=context,
                        language=resolved_language,
                    )
                ),
                openai_model=(
                    model
                    or os.environ.get("PERFORMANCE_AI_MODEL")
                    or DEFAULT_MODEL
                ),
                openai_url=DEFAULT_OPENAI_URL,
                timeout_seconds=DEFAULT_TIMEOUT_SECONDS,
            )
        except AITransportConfigurationError as exc:
            raise AINotConfiguredError(str(exc)) from exc

    resolved_model = (
        model
        or (
            os.environ.get("PERFORMANCE_AI_MODEL")
            if selection.name == "openai"
            else None
        )
        or selection.default_model
    )

    resolved_api_key = (
        api_key
        if api_key is not None
        else os.environ.get("OPENAI_API_KEY")
    )

    if selection.requires_api_key and not resolved_api_key:
        raise AINotConfiguredError(
            "OPENAI_API_KEY no está configurada en el servidor."
        )

    context_hash = build_ai_context_hash(
        context=context,
        prompt_version=PROMPT_VERSION,
        schema_version=AI_SCHEMA_VERSION,
        model=resolved_model,
        provider=selection.name,
        transport_mode=selection.name,
        language=resolved_language,
    )

    cache_path = _cache_path(
        static_dir=static_dir,
        codename=codename,
    )

    if not force:
        cached = read_valid_ai_cache(
            cache_path=cache_path,
            context_hash=context_hash,
            schema_version=AI_SCHEMA_VERSION,
            prompt_version=PROMPT_VERSION,
            model=resolved_model,
            provider=selection.name,
            transport_mode=selection.name,
            language=resolved_language,
        )
        if cached:
            cached["cached"] = True
            return cached

    request_payload = build_openai_request(
        context=context,
        model=resolved_model,
        language=resolved_language,
    )

    try:
        provider_response = selection.send(
            request_payload,
            resolved_api_key,
        )
    except AITransportError as exc:
        raise AIProviderError(str(exc)) from exc

    parsed = parse_openai_structured_output(
        provider_response
    )

    validate_ai_output(
        output=parsed,
        context=context,
    )

    result = {
        "schema_version": AI_SCHEMA_VERSION,
        "generated_by_ai": not selection.simulated,
        "simulated": selection.simulated,
        "provider": selection.name,
        "transport_mode": selection.name,
        "language": resolved_language,
        "model": resolved_model,
        "prompt_version": PROMPT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "source": {
            "results_schema_version": results_payload.get(
                "schema_version"
            ),
            "analysis_version": (
                results_payload.get("analysis") or {}
            ).get("version"),
            "pedagogy_version": (
                results_payload.get("pedagogy") or {}
            ).get("version"),
            "student_code_sent": False,
            "raw_csv_sent": False,
        },
        "guardrails": {
            "structured_output": True,
            "numeric_consistency_check": True,
            "asymptotic_claim_check": True,
            "passed": True,
        },
        "content": parsed,
        "context_hash": context_hash,
    }

    write_ai_cache(cache_path, result)

    return result



def build_ai_context(results_payload, language="es"):
    resolved_language = normalize_ai_language(language)

    execution = results_payload.get("execution") or {}
    pedagogy = results_payload.get("pedagogy") or {}
    analysis = results_payload.get("analysis") or {}

    pedagogy_metrics = pedagogy.get("metrics") or {}
    analysis_metrics = analysis.get("metrics") or {}

    selected = {}

    for metric_name in PRIMARY_METRICS:
        pedagogy_metric = pedagogy_metrics.get(metric_name)
        analysis_metric = analysis_metrics.get(metric_name)

        if not pedagogy_metric and not analysis_metric:
            continue

        selected[metric_name] = {
            "analysis_status": (
                analysis_metric or {}
            ).get("status"),
            "metric_status": (
                analysis_metric or {}
            ).get("metric_status"),
            "messages": [
                {
                    "kind": message.get("kind"),
                    "message_code": message.get("message_code"),
                    "priority": message.get("priority"),
                    "source": message.get("source"),
                    "evidence": message.get("evidence") or {},
                }
                for message in (
                    (pedagogy_metric or {}).get("messages") or []
                )
                if message.get("kind") in ALLOWED_EVIDENCE_KINDS
            ],
        }

    return {
        "contract": {
            "results_schema_version": results_payload.get(
                "schema_version"
            ),
            "analysis_version": analysis.get("version"),
            "pedagogy_version": pedagogy.get("version"),
            "presentation_contract": (
                pedagogy.get("generation") or {}
            ).get("presentation_contract"),
        },
        "execution": {
            "benchmark": execution.get("benchmark"),
            "input_size": execution.get("input_size"),
            "samples": execution.get("samples"),
            "sources_count": len(execution.get("sources") or []),
        },
        "deterministic_summary": _language_neutral_summary(
            pedagogy.get("summary") or {}
        ),
        "metrics": selected,
        "constraints": {
            "single_source_of_truth": (
                "Use only the deterministic facts in this payload."
            ),
            "no_student_code": True,
            "no_raw_csv": True,
            "no_asymptotic_complexity_claims": True,
            "no_unreferenced_numbers": True,
            "language": resolved_language,
        },
    }


def _language_neutral_summary(summary):
    highlights = []

    for message in summary.get("highlights") or []:
        highlights.append(
            {
                "metric": message.get("metric"),
                "kind": message.get("kind"),
                "message_code": message.get("message_code"),
                "source": message.get("source"),
                "evidence": message.get("evidence") or {},
            }
        )

    return {
        "primary_metrics_available": list(
            summary.get("primary_metrics_available") or []
        ),
        "primary_metrics_unavailable": list(
            summary.get("primary_metrics_unavailable") or []
        ),
        "highlights": highlights,
    }

def build_openai_request(context, model, language=None):
    output_schema = {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": (
                    "Resumen pedagógico breve de la ejecución."
                ),
            },
            "observations": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": {
                            "type": "string",
                        },
                        "evidence_kind": {
                            "type": "string",
                            "enum": sorted(
                                ALLOWED_EVIDENCE_KINDS
                            ),
                        },
                        "text": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "metric",
                        "evidence_kind",
                        "text",
                    ],
                    "additionalProperties": False,
                },
            },
            "limitations": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "string",
                },
            },
            "student_takeaway": {
                "type": "string",
                "description": (
                    "Una idea concreta que ayude al estudiante "
                    "a interpretar el experimento sin emitir una "
                    "calificación normativa."
                ),
            },
        },
        "required": [
            "summary",
            "observations",
            "limitations",
            "student_takeaway",
        ],
        "additionalProperties": False,
    }

    resolved_language = normalize_ai_language(
        language
        or (context.get("constraints") or {}).get("language")
        or "es"
    )

    if resolved_language == "en":
        system_text = (
            "You are the complementary pedagogical assistant layer of "
            "Performance System. Explain experimental C/C++ algorithm "
            "results in clear technical English. The only source of truth "
            "is the deterministic structured evidence supplied by the "
            "server. Do not recompute metrics. Do not invent numbers. Do "
            "not classify an algorithm as good, bad, efficient or "
            "inefficient without an explicit reference baseline. Do not "
            "claim asymptotic O(...) complexity from empirical measurements. "
            "If only one input size exists, preserve that experimental "
            "limitation. Distinguish a missing measurement from zero."
        )
        user_prefix = (
            "Generate a complementary pedagogical explanation for this "
            "single execution. Prioritize useful evidence-backed "
            "observations and preserve experimental limitations."
        )
    else:
        system_text = (
            "Eres la capa de asistente pedagógico complementario de "
            "Performance System. Explica resultados experimentales de "
            "algoritmos C/C++ en español técnico y claro. La única fuente "
            "de verdad es la evidencia determinística estructurada enviada "
            "por el servidor. No recalcules métricas. No inventes números. "
            "No clasifiques un algoritmo como bueno, malo, eficiente o "
            "ineficiente sin una línea base explícita. No afirmes "
            "complejidad asintótica O(...) desde mediciones empíricas. "
            "Si existe un único tamaño de entrada, conserva esa limitación "
            "experimental. Diferencia una medición ausente de un valor cero."
        )
        user_prefix = (
            "Genera una explicación pedagógica complementaria para esta "
            "ejecución individual. Prioriza observaciones útiles respaldadas "
            "por evidencia y conserva las limitaciones experimentales."
        )

    if resolved_language == "en":
        system_text += (
            " Mandatory output rules: Every observations[].metric value must "
            "exactly match a key from STRUCTURED CONTEXT.metrics; never invent "
            "aggregate labels. Do not write the expressions 'asymptotic "
            "complexity' or Big-O notation, even to negate them; omit that "
            "topic completely. Every numeric literal must be copied exactly "
            "from STRUCTURED CONTEXT. Do not calculate percentages, "
            "differences, ratios, factors, conversions or rounded values."
        )
    else:
        system_text += (
            " Reglas obligatorias de salida: cada valor "
            "observations[].metric debe coincidir exactamente con una clave "
            "de STRUCTURED CONTEXT.metrics; no inventes etiquetas agregadas. "
            "No escribas las expresiones 'complejidad asintótica' ni notación "
            "Big-O, incluso para negarlas; omite ese tema por completo. Todo "
            "literal numérico debe copiarse exactamente de STRUCTURED CONTEXT. "
            "No calcules porcentajes, diferencias, razones, factores, "
            "conversiones ni valores redondeados."
        )

    user_text = (
        user_prefix
        + "\n\nSTRUCTURED CONTEXT:\n"
        + json.dumps(
            context,
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    return {
        "model": model,
        "store": False,
        "max_output_tokens": 1600,
        "input": [
            {
                "role": "system",
                "content": system_text,
            },
            {
                "role": "user",
                "content": user_text,
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "performance_system_explanation",
                "description": (
                    "Explicación pedagógica estructurada de una "
                    "ejecución de Performance System."
                ),
                "strict": True,
                "schema": output_schema,
            }
        },
    }




def validate_ai_output(output, context):
    if not isinstance(output, dict):
        raise AIOutputRejectedError(
            "La explicación no cumple el contrato esperado."
        )

    observations = output.get("observations")
    limitations = output.get("limitations")

    if not isinstance(output.get("summary"), str):
        raise AIOutputRejectedError("summary inválido.")

    if not isinstance(observations, list) or not observations:
        raise AIOutputRejectedError("observations inválido.")

    if not isinstance(limitations, list):
        raise AIOutputRejectedError("limitations inválido.")

    if not isinstance(output.get("student_takeaway"), str):
        raise AIOutputRejectedError("student_takeaway inválido.")

    allowed_metrics = set((context.get("metrics") or {}).keys())

    for observation in observations:
        metric = observation.get("metric")
        kind = observation.get("evidence_kind")
        text = observation.get("text")

        if metric not in allowed_metrics:
            raise AIOutputRejectedError(
                "La IA citó una métrica no incluida en el contexto."
            )

        if kind not in ALLOWED_EVIDENCE_KINDS:
            raise AIOutputRejectedError(
                "La IA citó un tipo de evidencia no permitido."
            )

        metric_messages = (
            context.get("metrics", {})
            .get(metric, {})
            .get("messages", [])
        )

        if not any(
            message.get("kind") == kind
            for message in metric_messages
        ):
            raise AIOutputRejectedError(
                "La observación no tiene evidencia determinística asociada."
            )

        if not isinstance(text, str) or not text.strip():
            raise AIOutputRejectedError(
                "La observación contiene texto vacío."
            )

    all_text = " ".join(
        [
            output.get("summary", ""),
            output.get("student_takeaway", ""),
        ]
        + [
            item.get("text", "")
            for item in observations
        ]
        + [
            str(item)
            for item in limitations
        ]
    )

    for pattern in FORBIDDEN_COMPLEXITY_PATTERNS:
        if pattern.search(all_text):
            raise AIOutputRejectedError(
                "La salida contiene una afirmación de complejidad "
                "asintótica no permitida."
            )

    _validate_numeric_consistency(
        output_text=all_text,
        context=context,
    )


def _validate_numeric_consistency(output_text, context):
    allowed_text = json.dumps(
        context,
        ensure_ascii=False,
        sort_keys=True,
    )

    allowed_numbers = {
        _normalize_number_token(token)
        for token in _extract_number_tokens(allowed_text)
    }

    output_numbers = {
        _normalize_number_token(token)
        for token in _extract_number_tokens(output_text)
    }

    # Se toleran números puramente discursivos de pequeña cardinalidad
    # (por ejemplo "2 observaciones") sólo si ya estaban en el contexto.
    unreferenced = {
        token
        for token in output_numbers
        if token not in allowed_numbers
    }

    if unreferenced:
        raise AIOutputRejectedError(
            "La salida contiene valores numéricos no presentes en "
            "la evidencia determinística: {}".format(
                ", ".join(sorted(unreferenced))
            )
        )


def _extract_number_tokens(text):
    return re.findall(
        r"(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?",
        text or "",
    )


def _normalize_number_token(token):
    token = token.strip().replace(",", ".")
    if token.endswith("%"):
        token = token[:-1]

    try:
        value = float(token)
    except ValueError:
        return token

    return "{:.12g}".format(value)




def _cache_path(static_dir, codename):
    return os.path.join(
        static_dir,
        codename,
        CACHE_FILENAME,
    )
