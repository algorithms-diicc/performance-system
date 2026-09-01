"""Dominio de análisis comparativo asistido por IA.

La IA comparativa es complementaria a la pedagogía determinística. Recibe
únicamente evidencia comparativa canónica ya estructurada por el servidor.
"""

import math
import os
import re
from datetime import datetime, timezone

from .ai_runtime import (
    AIInvalidLanguageError,
    AIProviderError,
    build_ai_context_hash,
    normalize_ai_language,
    parse_openai_structured_output,
    read_valid_ai_cache,
    write_ai_cache,
)
from .ai_transports import (
    AITransportConfigurationError,
    AITransportError,
    AITransportSelection,
    DEFAULT_OPENAI_URL,
    DEFAULT_TIMEOUT_SECONDS,
    resolve_ai_transport,
)
from .comparison_ai_mock import comparison_mock_transport
from .comparison_pedagogy_service import build_comparison_pedagogy


COMPARISON_AI_SCHEMA_VERSION = "1.0"
COMPARISON_AI_PROMPT_VERSION = "iter11e-comparison-v2"
DEFAULT_MODEL = "gpt-5.6-luna"
DEFAULT_TRANSPORT = "mock"
CACHE_DIRNAME = "_comparison_ai"
ALLOWED_EVIDENCE_KINDS = {
    "observation",
    "trend",
    "variability",
}

NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9_])[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)(?![A-Za-z0-9_])"
)
FORBIDDEN_PATTERNS = [
    re.compile(r"\bO\s*\(", re.IGNORECASE),
    re.compile(r"\bcomplejidad\s+asint[oó]tica\b", re.IGNORECASE),
    re.compile(r"\basymptotic\s+complexity\b", re.IGNORECASE),
    re.compile(r"\bganador(?:a)?\b", re.IGNORECASE),
    re.compile(r"\bwinner\b", re.IGNORECASE),
    re.compile(r"\bmejor\s+en\s+general\b", re.IGNORECASE),
    re.compile(r"\bbest\s+overall\b", re.IGNORECASE),
    re.compile(r"\bcaus(?:a|ó|o|as|an|ed|es|ing)\b", re.IGNORECASE),
]


class ComparisonAIError(RuntimeError):
    """Error genérico del dominio de IA comparativa."""


class ComparisonAINotConfiguredError(ComparisonAIError):
    """El proveedor configurado requiere configuración ausente."""


class ComparisonAIUnavailableError(ComparisonAIError):
    """La comparación no tiene base válida suficiente para análisis IA."""


class ComparisonAIOutputRejectedError(ComparisonAIError):
    """La salida del asistente no superó guardrails comparativos."""


class ComparisonAIProviderError(ComparisonAIError):
    """El transporte/proveedor no entregó una respuesta utilizable."""


def generate_comparison_ai_explanation(
    static_dir,
    comparison_payload,
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
    context = build_comparison_ai_context(
        comparison_payload,
        language=resolved_language,
    )

    status = str(
        (context.get("scope") or {}).get("status") or ""
    ).upper()
    if status == "INCOMPATIBLE":
        raise ComparisonAIUnavailableError(
            "Una comparación incompatible no posee base experimental "
            "válida para síntesis asistida."
        )

    if not (context.get("metrics") or {}):
        raise ComparisonAIUnavailableError(
            "La comparación no contiene evidencia métrica común utilizable."
        )

    configured_mode = (
        transport_mode
        or os.environ.get("PERFORMANCE_AI_TRANSPORT")
        or DEFAULT_TRANSPORT
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
                    lambda request_payload, key:
                    comparison_mock_transport(
                        request_payload=request_payload,
                        api_key=key,
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
            raise ComparisonAINotConfiguredError(str(exc)) from exc

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
        raise ComparisonAINotConfiguredError(
            "OPENAI_API_KEY no está configurada en el servidor."
        )

    context_hash = build_ai_context_hash(
        context=context,
        prompt_version=COMPARISON_AI_PROMPT_VERSION,
        schema_version=COMPARISON_AI_SCHEMA_VERSION,
        model=resolved_model,
        provider=selection.name,
        transport_mode=selection.name,
        language=resolved_language,
    )
    cache_path = _cache_path(
        static_dir=static_dir,
        context_hash=context_hash,
    )

    if not force:
        cached = read_valid_ai_cache(
            cache_path=cache_path,
            context_hash=context_hash,
            schema_version=COMPARISON_AI_SCHEMA_VERSION,
            prompt_version=COMPARISON_AI_PROMPT_VERSION,
            model=resolved_model,
            provider=selection.name,
            transport_mode=selection.name,
            language=resolved_language,
        )
        if cached:
            cached["cached"] = True
            return cached

    request_payload = build_comparison_openai_request(
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
        raise ComparisonAIProviderError(str(exc)) from exc

    try:
        parsed = parse_openai_structured_output(
            provider_response
        )
    except AIProviderError as exc:
        raise ComparisonAIProviderError(str(exc)) from exc

    validate_comparison_ai_output(
        output=parsed,
        context=context,
    )

    pedagogy = context.get("contract") or {}
    result = {
        "schema_version": COMPARISON_AI_SCHEMA_VERSION,
        "generated_by_ai": not selection.simulated,
        "simulated": selection.simulated,
        "provider": selection.name,
        "transport_mode": selection.name,
        "language": resolved_language,
        "model": resolved_model,
        "prompt_version": COMPARISON_AI_PROMPT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "comparison_status": status,
        "source": {
            "comparison_schema_version": pedagogy.get(
                "comparison_schema_version"
            ),
            "comparison_pedagogy_version": pedagogy.get(
                "comparison_pedagogy_version"
            ),
            "presentation_contract": pedagogy.get(
                "presentation_contract"
            ),
            "student_code_sent": False,
            "raw_csv_sent": False,
            "browser_metrics_trusted": False,
            "canonical_server_comparison": True,
        },
        "guardrails": {
            "structured_output": True,
            "numeric_consistency_check": True,
            "asymptotic_claim_check": True,
            "global_winner_check": True,
            "causal_claim_check": True,
            "metric_reference_check": True,
            "implementation_reference_check": True,
            "passed": True,
        },
        "content": parsed,
        "context_hash": context_hash,
    }

    write_ai_cache(cache_path, result)
    return result


def build_comparison_ai_context(comparison_payload, language="es"):
    resolved_language = normalize_ai_language(language)
    comparison = (
        comparison_payload
        if isinstance(comparison_payload, dict)
        else {}
    )

    pedagogy = build_comparison_pedagogy(comparison)
    generation = pedagogy.get("generation") or {}
    scope = pedagogy.get("scope") or {}
    metrics = pedagogy.get("metrics") or {}
    limitations = pedagogy.get("limitations") or {}

    implementations = _collect_implementations(
        metrics,
        comparison.get("executions"),
    )

    return {
        "contract": {
            "comparison_schema_version": comparison.get(
                "schemaVersion"
            ),
            "comparison_pedagogy_version": pedagogy.get(
                "version"
            ),
            "presentation_contract": generation.get(
                "presentation_contract"
            ),
        },
        "scope": {
            "status": str(
                scope.get("status") or "UNKNOWN"
            ).upper(),
            "common_input_sizes": list(
                scope.get("common_input_sizes") or []
            ),
            "common_metrics": list(
                scope.get("common_metrics") or []
            ),
            "target_metric_count": scope.get(
                "target_metric_count"
            ),
            "implementation_count": len(implementations),
        },
        "implementations": implementations,
        "metrics": metrics,
        "limitations": {
            "issues": list(
                limitations.get("issues") or []
            ),
            "excluded_metrics": list(
                limitations.get("excluded_metrics") or []
            ),
        },
        "constraints": {
            "single_source_of_truth": (
                "Use only the deterministic comparative evidence "
                "in this payload."
            ),
            "no_student_code": True,
            "no_raw_csv": True,
            "no_browser_metrics_as_truth": True,
            "no_recalculation": True,
            "no_global_winner": True,
            "no_causal_inference": True,
            "no_asymptotic_complexity_claims": True,
            "missing_or_excluded_is_not_zero": True,
            "language": resolved_language,
        },
    }


def build_comparison_openai_request(context, model, language=None):
    resolved_language = normalize_ai_language(
        language
        or (context.get("constraints") or {}).get("language")
        or "es"
    )

    allowed_metrics = sorted(
        (context.get("metrics") or {}).keys()
    )
    implementation_ids = [
        item.get("id")
        for item in (context.get("implementations") or [])
        if item.get("id")
    ]

    metric_schema = {
        "type": "string",
        "enum": allowed_metrics,
    }
    implementation_schema = {
        "type": "string",
        "enum": implementation_ids,
    }

    output_schema = {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
            },
            "patterns": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": metric_schema,
                        "evidence_kind": {
                            "type": "string",
                            "enum": sorted(
                                ALLOWED_EVIDENCE_KINDS
                            ),
                        },
                        "implementation_refs": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": max(
                                1,
                                len(implementation_ids),
                            ),
                            "items": implementation_schema,
                        },
                        "text": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "metric",
                        "evidence_kind",
                        "implementation_refs",
                        "text",
                    ],
                    "additionalProperties": False,
                },
            },
            "tradeoffs": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "metrics": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 3,
                            "items": metric_schema,
                        },
                        "implementation_refs": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": max(
                                1,
                                len(implementation_ids),
                            ),
                            "items": implementation_schema,
                        },
                        "text": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "metrics",
                        "implementation_refs",
                        "text",
                    ],
                    "additionalProperties": False,
                },
            },
            "focus": {
                "type": "array",
                "minItems": 1,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "metric": metric_schema,
                        "text": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "metric",
                        "text",
                    ],
                    "additionalProperties": False,
                },
            },
            "limitations": {
                "type": "array",
                "maxItems": 5,
                "items": {
                    "type": "string",
                },
            },
        },
        "required": [
            "summary",
            "patterns",
            "tradeoffs",
            "focus",
            "limitations",
        ],
        "additionalProperties": False,
    }

    if resolved_language == "en":
        system_text = (
            "You are the comparative pedagogical assistant layer of "
            "Performance System. Explain only the deterministic canonical "
            "comparison evidence supplied by the server. Do not recompute "
            "metrics, invent numbers, infer causality, infer asymptotic "
            "complexity, or declare an overall winner. Every comparative "
            "claim must identify the relevant metric and remain within the "
            "measured common input-size scope. Missing or excluded metrics "
            "are not zero. If the comparison status is LIMITED, preserve "
            "its limitations explicitly. Tradeoffs must describe observed "
            "multi-metric evidence, not a global ranking."
        )
        user_prefix = (
            "Generate a structured comparative pedagogical reading with: "
            "summary, observed patterns, observed tradeoffs when supported, "
            "what to inspect next, and limitations."
        )
    else:
        system_text = (
            "Eres la capa de asistente pedagógico comparativo de Performance "
            "System. Explica únicamente la evidencia comparativa canónica y "
            "determinística enviada por el servidor. No recalcules métricas, "
            "no inventes números, no infieras causalidad, no infieras "
            "complejidad asintótica y no declares un ganador global. Toda "
            "afirmación comparativa debe identificar la métrica pertinente y "
            "mantenerse dentro del dominio común de tamaños efectivamente "
            "medido. Una métrica ausente o excluida no equivale a cero. Si "
            "el estado es LIMITED, conserva explícitamente sus limitaciones. "
            "Las compensaciones deben describir evidencia observada entre "
            "métricas, no construir un ranking global."
        )
        user_prefix = (
            "Genera una lectura pedagógica comparativa estructurada con: "
            "resumen, patrones observados, compensaciones observadas cuando "
            "exista evidencia, qué conviene analizar y limitaciones."
        )

    if resolved_language == "en":
        system_text += (
            " Mandatory output rules: Do not write the expressions "
            "'asymptotic complexity', 'winner', 'best', 'worst' or Big-O "
            "notation, even to negate them; omit those topics completely. "
            "Every numeric literal must be copied exactly from STRUCTURED "
            "COMPARISON CONTEXT. Do not calculate percentages, differences, "
            "ratios, factors, conversions or rounded values. Describe only "
            "observed metric relationships and omit explanatory mechanisms."
        )
    else:
        system_text += (
            " Reglas obligatorias de salida: no escribas las expresiones "
            "'complejidad asintótica', 'ganador', 'ganadora', 'winner', "
            "'best', 'worst' ni notación Big-O, incluso para negarlas; omite "
            "esos temas por completo. Todo literal numérico debe copiarse "
            "exactamente de STRUCTURED COMPARISON CONTEXT. No calcules "
            "porcentajes, diferencias, razones, factores, conversiones ni "
            "valores redondeados. Describe únicamente relaciones observadas "
            "entre métricas y omite mecanismos explicativos."
        )

    import json

    return {
        "model": model,
        "store": False,
        "max_output_tokens": 2400,
        "input": [
            {
                "role": "system",
                "content": system_text,
            },
            {
                "role": "user",
                "content": (
                    user_prefix
                    + "\n\nSTRUCTURED COMPARISON CONTEXT:\n"
                    + json.dumps(
                        context,
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                ),
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "performance_system_comparison_explanation",
                "description": (
                    "Lectura pedagógica estructurada de una comparación "
                    "científica en Performance System."
                ),
                "strict": True,
                "schema": output_schema,
            }
        },
    }


def validate_comparison_ai_output(output, context):
    if not isinstance(output, dict):
        raise ComparisonAIOutputRejectedError(
            "La explicación comparativa no cumple el contrato esperado."
        )

    required = {
        "summary",
        "patterns",
        "tradeoffs",
        "focus",
        "limitations",
    }
    if set(output.keys()) != required:
        raise ComparisonAIOutputRejectedError(
            "La salida comparativa contiene campos faltantes o no permitidos."
        )

    if not _nonempty_text(output.get("summary")):
        raise ComparisonAIOutputRejectedError(
            "summary inválido."
        )

    patterns = output.get("patterns")
    tradeoffs = output.get("tradeoffs")
    focus = output.get("focus")
    limitations = output.get("limitations")

    if not isinstance(patterns, list) or not patterns:
        raise ComparisonAIOutputRejectedError(
            "patterns inválido."
        )
    if not isinstance(tradeoffs, list):
        raise ComparisonAIOutputRejectedError(
            "tradeoffs inválido."
        )
    if not isinstance(focus, list) or not focus:
        raise ComparisonAIOutputRejectedError(
            "focus inválido."
        )
    if not isinstance(limitations, list):
        raise ComparisonAIOutputRejectedError(
            "limitations inválido."
        )

    allowed_metrics = set(
        (context.get("metrics") or {}).keys()
    )
    allowed_refs = set(
        item.get("id")
        for item in (context.get("implementations") or [])
        if item.get("id")
    )

    for pattern in patterns:
        if not isinstance(pattern, dict):
            raise ComparisonAIOutputRejectedError(
                "pattern inválido."
            )
        metric = pattern.get("metric")
        kind = pattern.get("evidence_kind")
        refs = pattern.get("implementation_refs")
        text = pattern.get("text")

        if metric not in allowed_metrics:
            raise ComparisonAIOutputRejectedError(
                "La IA citó una métrica fuera del contexto comparativo."
            )
        if kind not in ALLOWED_EVIDENCE_KINDS:
            raise ComparisonAIOutputRejectedError(
                "La IA citó evidencia comparativa no permitida."
            )
        if not _valid_refs(refs, allowed_refs):
            raise ComparisonAIOutputRejectedError(
                "La IA citó una implementación fuera del contexto."
            )
        if not _nonempty_text(text):
            raise ComparisonAIOutputRejectedError(
                "El patrón contiene texto vacío."
            )
        if not _metric_supports_kind(
            (context.get("metrics") or {}).get(metric) or {},
            kind,
            refs,
        ):
            raise ComparisonAIOutputRejectedError(
                "El patrón no tiene evidencia determinística asociada."
            )

    for item in tradeoffs:
        if not isinstance(item, dict):
            raise ComparisonAIOutputRejectedError(
                "tradeoff inválido."
            )
        metrics = item.get("metrics")
        refs = item.get("implementation_refs")
        if (
            not isinstance(metrics, list)
            or len(metrics) < 2
            or any(metric not in allowed_metrics for metric in metrics)
        ):
            raise ComparisonAIOutputRejectedError(
                "La compensación cita métricas fuera del contexto."
            )
        if not _valid_refs(refs, allowed_refs):
            raise ComparisonAIOutputRejectedError(
                "La compensación cita implementaciones fuera del contexto."
            )
        if not _nonempty_text(item.get("text")):
            raise ComparisonAIOutputRejectedError(
                "La compensación contiene texto vacío."
            )
        for metric in metrics:
            if not _metric_supports_kind(
                (context.get("metrics") or {}).get(metric) or {},
                "observation",
                refs,
            ):
                raise ComparisonAIOutputRejectedError(
                    "La compensación carece de observación común suficiente."
                )

    for item in focus:
        if (
            not isinstance(item, dict)
            or item.get("metric") not in allowed_metrics
            or not _nonempty_text(item.get("text"))
        ):
            raise ComparisonAIOutputRejectedError(
                "focus inválido."
            )

    if any(not _nonempty_text(item) for item in limitations):
        raise ComparisonAIOutputRejectedError(
            "limitations contiene texto inválido."
        )

    status = str(
        (context.get("scope") or {}).get("status") or ""
    ).upper()
    if status == "LIMITED" and not limitations:
        raise ComparisonAIOutputRejectedError(
            "Una comparación LIMITED debe conservar sus limitaciones."
        )

    all_text = _output_text(output)

    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(all_text):
            raise ComparisonAIOutputRejectedError(
                "La salida contiene una afirmación comparativa no permitida."
            )

    _validate_numeric_consistency(
        output_text=all_text,
        context=context,
    )


def _public_execution_metadata(executions):
    by_identity = {}
    for execution in executions if isinstance(executions, list) else []:
        if not isinstance(execution, dict):
            continue
        source_language = _clean_text(execution.get("sourceLanguage"))
        compiler = _clean_text(execution.get("compiler"))
        if source_language not in {"C", "C++"}:
            source_language = None
        if compiler not in {"gcc", "g++"}:
            compiler = None

        hardware = execution.get("hardwareObserved") or {}
        toolchain = (
            hardware.get("toolchain")
            if isinstance(hardware, dict)
            else {}
        ) or {}
        compiler_version = (
            _clean_text(toolchain.get("version"))
            if isinstance(toolchain, dict)
            else None
        )
        if (
            compiler_version
            and (
                len(compiler_version) > 256
                or "/" in compiler_version
                or "\\" in compiler_version
            )
        ):
            compiler_version = None
        metadata = {
            "source_language": source_language,
            "compiler": compiler,
            "compiler_version": compiler_version,
        }
        for identity in (
            execution.get("publicId"),
            execution.get("codename"),
            execution.get("sourceFilename"),
        ):
            normalized = _clean_text(identity)
            if normalized:
                by_identity.setdefault(normalized, metadata)
    return by_identity


def _collect_implementations(metrics, executions=None):
    collected = []
    seen = set()
    execution_metadata = _public_execution_metadata(executions)

    for metric_payload in metrics.values():
        for section in ("observation", "trend", "variability"):
            section_payload = metric_payload.get(section) or {}
            for item in section_payload.get("series") or []:
                public_id = _clean_text(item.get("public_id"))
                codename = _clean_text(item.get("codename"))
                filename = _clean_text(item.get("source_filename"))
                stable_id = public_id or codename or filename
                if not stable_id or stable_id in seen:
                    continue
                seen.add(stable_id)
                item = {
                    "id": stable_id,
                    "public_id": public_id,
                    "codename": codename,
                    "source_filename": filename,
                    "label": filename or codename or public_id,
                }
                metadata = (
                    execution_metadata.get(public_id)
                    or execution_metadata.get(codename)
                    or execution_metadata.get(filename)
                )
                if metadata:
                    item.update(metadata)
                collected.append(item)

    return collected


def _metric_supports_kind(metric_payload, kind, refs):
    section_name = {
        "observation": "observation",
        "trend": "trend",
        "variability": "variability",
    }.get(kind)

    if not section_name:
        return False

    section = metric_payload.get(section_name) or {}
    series = section.get("series") or []
    present = set()

    for item in series:
        stable_id = (
            _clean_text(item.get("public_id"))
            or _clean_text(item.get("codename"))
            or _clean_text(item.get("source_filename"))
        )
        if stable_id:
            present.add(stable_id)

    return bool(present) and set(refs).issubset(present)


def _valid_refs(refs, allowed_refs):
    return (
        isinstance(refs, list)
        and bool(refs)
        and len(refs) == len(set(refs))
        and set(refs).issubset(allowed_refs)
    )


def _output_text(output):
    parts = [output.get("summary", "")]

    for key in ("patterns", "tradeoffs", "focus"):
        for item in output.get(key) or []:
            parts.append(item.get("text", ""))

    parts.extend(output.get("limitations") or [])
    return " ".join(str(part) for part in parts)


def _validate_numeric_consistency(output_text, context):
    context_numbers = _collect_context_numbers(context)

    for token in NUMBER_RE.findall(output_text or ""):
        normalized = token.replace(",", ".")
        try:
            value = float(normalized)
        except ValueError:
            continue

        if not any(
            math.isclose(
                value,
                reference,
                rel_tol=1e-9,
                abs_tol=1e-9,
            )
            for reference in context_numbers
        ):
            raise ComparisonAIOutputRejectedError(
                "La salida contiene un número no presente en la "
                "evidencia comparativa canónica: {}.".format(token)
            )


def _collect_context_numbers(value):
    output = []

    if isinstance(value, bool):
        return output

    if isinstance(value, (int, float)):
        if math.isfinite(float(value)):
            output.append(float(value))
        return output

    if isinstance(value, dict):
        for item in value.values():
            output.extend(_collect_context_numbers(item))
        return output

    if isinstance(value, (list, tuple)):
        for item in value:
            output.extend(_collect_context_numbers(item))

    return output


def _cache_path(static_dir, context_hash):
    return os.path.join(
        static_dir,
        CACHE_DIRNAME,
        "{}.json".format(context_hash),
    )


def _clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _nonempty_text(value):
    return isinstance(value, str) and bool(value.strip())
