import hashlib
import json
import os
import re
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


AI_SCHEMA_VERSION = "1.0"
PROMPT_VERSION = "ui03c4-v1"
DEFAULT_MODEL = "gpt-5.6-luna"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
CACHE_FILENAME = "AIExplanation.json"
REQUEST_TIMEOUT_SECONDS = 30

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


class AIProviderError(AIExplanationError):
    """El proveedor remoto devolvió un error o una respuesta no utilizable."""


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
):
    """
    Genera una explicación complementaria mediante IA.

    La IA recibe únicamente contexto estructurado derivado de:
      metrics -> analysis -> pedagogy

    No recibe el código C/C++ enviado por el estudiante ni el CSV bruto.
    """
    resolved_model = (
        model
        or os.environ.get("PERFORMANCE_AI_MODEL")
        or DEFAULT_MODEL
    )
    resolved_api_key = (
        api_key
        if api_key is not None
        else os.environ.get("OPENAI_API_KEY")
    )

    if transport is None and not resolved_api_key:
        raise AINotConfiguredError(
            "OPENAI_API_KEY no está configurada en el servidor."
        )

    context = build_ai_context(results_payload)
    context_hash = _context_hash(
        context=context,
        model=resolved_model,
    )

    cache_path = _cache_path(
        static_dir=static_dir,
        codename=codename,
    )

    if not force:
        cached = _read_valid_cache(
            cache_path=cache_path,
            context_hash=context_hash,
            model=resolved_model,
        )
        if cached:
            cached["cached"] = True
            return cached

    request_payload = build_openai_request(
        context=context,
        model=resolved_model,
    )

    if transport is None:
        provider_response = _openai_http_transport(
            request_payload=request_payload,
            api_key=resolved_api_key,
        )
    else:
        provider_response = transport(
            request_payload,
            resolved_api_key,
        )

    parsed = parse_openai_structured_output(
        provider_response
    )

    validate_ai_output(
        output=parsed,
        context=context,
    )

    result = {
        "schema_version": AI_SCHEMA_VERSION,
        "generated_by_ai": True,
        "provider": "openai",
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

    _write_cache(cache_path, result)

    return result


def build_ai_context(results_payload):
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
                    "text": message.get("text"),
                    "evidence": message.get("evidence"),
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
        },
        "execution": {
            "benchmark": execution.get("benchmark"),
            "input_size": execution.get("input_size"),
            "samples": execution.get("samples"),
            "sources_count": len(execution.get("sources") or []),
        },
        "deterministic_summary": (
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
            "language": "es-CL",
        },
    }


def build_openai_request(context, model):
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

    system_text = (
        "Eres una capa pedagógica complementaria de Performance System. "
        "Explica resultados experimentales de algoritmos C/C++ en español "
        "claro y técnico. La fuente de verdad son exclusivamente los hechos "
        "determinísticos incluidos por el servidor. No recalcules métricas. "
        "No inventes números. No clasifiques el algoritmo como bueno, malo, "
        "eficiente o ineficiente sin una línea base explícita. No afirmes "
        "complejidad asintótica O(...) a partir de mediciones empíricas. "
        "Si sólo existe un tamaño de entrada, indica que no puede inferirse "
        "una tendencia. Diferencia ausencia de medición de un valor cero. "
        "No menciones datos que no estén presentes en el contexto."
    )

    user_text = (
        "Genera una explicación pedagógica complementaria para esta "
        "ejecución. Prioriza 2 a 4 observaciones útiles, conserva las "
        "limitaciones experimentales y evita repetir mecánicamente todos "
        "los KPIs.\n\nCONTEXTO ESTRUCTURADO:\n"
        + json.dumps(
            context,
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    return {
        "model": model,
        "store": False,
        "max_output_tokens": 700,
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


def parse_openai_structured_output(provider_response):
    if not isinstance(provider_response, dict):
        raise AIProviderError(
            "La respuesta del proveedor no es un objeto JSON."
        )

    if provider_response.get("status") == "incomplete":
        raise AIProviderError(
            "La respuesta de IA quedó incompleta."
        )

    output_items = provider_response.get("output") or []

    for item in output_items:
        if item.get("type") != "message":
            continue

        for content in item.get("content") or []:
            if content.get("type") == "refusal":
                raise AIProviderError(
                    "El proveedor rechazó generar la explicación."
                )

            if content.get("type") == "output_text":
                text = content.get("text")

                if not text:
                    continue

                try:
                    parsed = json.loads(text)
                except ValueError as exc:
                    raise AIProviderError(
                        "La salida estructurada no contiene JSON válido."
                    ) from exc

                return parsed

    raise AIProviderError(
        "No se encontró contenido textual estructurado en la respuesta."
    )


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


def _openai_http_transport(request_payload, api_key):
    body = json.dumps(
        request_payload,
        ensure_ascii=False,
    ).encode("utf-8")

    request = Request(
        OPENAI_RESPONSES_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer {}".format(api_key),
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            return json.loads(
                response.read().decode("utf-8")
            )
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)

        raise AIProviderError(
            "OpenAI API respondió HTTP {}: {}".format(
                exc.code,
                detail[:500],
            )
        ) from exc
    except URLError as exc:
        raise AIProviderError(
            "No fue posible conectar con OpenAI API."
        ) from exc
    except ValueError as exc:
        raise AIProviderError(
            "OpenAI API devolvió JSON inválido."
        ) from exc


def _context_hash(context, model):
    canonical = json.dumps(
        {
            "prompt_version": PROMPT_VERSION,
            "model": model,
            "context": context,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return hashlib.sha256(canonical).hexdigest()


def _cache_path(static_dir, codename):
    return os.path.join(
        static_dir,
        codename,
        CACHE_FILENAME,
    )


def _read_valid_cache(cache_path, context_hash, model):
    if not os.path.isfile(cache_path):
        return None

    try:
        with open(cache_path, "r", encoding="utf-8") as handle:
            cached = json.load(handle)
    except (OSError, ValueError):
        return None

    if cached.get("context_hash") != context_hash:
        return None

    if cached.get("model") != model:
        return None

    if cached.get("prompt_version") != PROMPT_VERSION:
        return None

    return cached


def _write_cache(cache_path, payload):
    directory = os.path.dirname(cache_path)

    try:
        os.makedirs(directory, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as handle:
            json.dump(
                payload,
                handle,
                ensure_ascii=False,
                indent=2,
            )
    except OSError:
        # La IA sigue siendo utilizable aunque el cache no pueda persistirse.
        pass