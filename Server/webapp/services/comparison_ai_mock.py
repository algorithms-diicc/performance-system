"""Mock determinístico del dominio de IA comparativa."""

from .ai_runtime import build_provider_shaped_response
from .ai_transports import AITransportError


def comparison_mock_transport(
    request_payload,
    api_key,
    *,
    context,
    language,
):
    # Sólo sustituye al proveedor externo. El parser y guardrails son reales.
    del request_payload
    del api_key

    content = _build_mock_content(
        context=context,
        language=language,
    )
    return build_provider_shaped_response(content)


def _build_mock_content(context, language):
    metrics = context.get("metrics") or {}
    implementations = context.get("implementations") or []
    implementation_map = {
        item.get("id"): item
        for item in implementations
        if item.get("id")
    }

    patterns = []
    for metric, payload in metrics.items():
        pattern = _metric_pattern(
            metric=metric,
            payload=payload,
            implementation_map=implementation_map,
            language=language,
        )
        if pattern:
            patterns.append(pattern)
        if len(patterns) >= 3:
            break

    if not patterns:
        raise AITransportError(
            "El modo mock comparativo no encontró evidencia utilizable."
        )

    tradeoffs = _observed_order_reversals(
        metrics=metrics,
        implementation_map=implementation_map,
        language=language,
    )
    focus = [
        {
            "metric": item["metric"],
            "text": _focus_text(
                item["metric"],
                language,
            ),
        }
        for item in patterns[:2]
    ]
    limitations = _limitations(
        context=context,
        language=language,
    )

    metric_labels = ", ".join(
        _metric_label(item["metric"], language)
        for item in patterns
    )

    if language == "en":
        summary = (
            "This simulated comparative reading uses only the canonical "
            "deterministic evidence shared by the selected executions and "
            "focuses on {}."
        ).format(metric_labels)
    else:
        summary = (
            "Esta lectura comparativa simulada usa únicamente la evidencia "
            "determinística canónica común a las ejecuciones seleccionadas "
            "y se concentra en {}."
        ).format(metric_labels)

    return {
        "summary": summary,
        "patterns": patterns,
        "tradeoffs": tradeoffs,
        "focus": focus,
        "limitations": limitations,
    }


def _metric_pattern(
    metric,
    payload,
    implementation_map,
    language,
):
    observation = payload.get("observation") or {}
    observation_series = observation.get("series") or []
    input_size = observation.get("input_size")

    usable = [
        item
        for item in observation_series
        if _stable_id(item) in implementation_map
        and item.get("median") is not None
    ]

    if usable:
        refs = [_stable_id(item) for item in usable]
        descriptions = []

        for item in usable:
            ref = _stable_id(item)
            label = implementation_map[ref].get("label") or ref
            descriptions.append(
                "{}: {}".format(
                    label,
                    _format_value(item.get("median")),
                )
            )

        if language == "en":
            text = (
                "For {}, at the largest common measured input size {}, "
                "the reported medians were {}."
            ).format(
                _metric_label(metric, language),
                _format_value(input_size),
                "; ".join(descriptions),
            )
        else:
            text = (
                "Para {}, en el mayor tamaño de entrada común medido {}, "
                "las medianas reportadas fueron {}."
            ).format(
                _metric_label(metric, language),
                _format_value(input_size),
                "; ".join(descriptions),
            )

        return {
            "metric": metric,
            "evidence_kind": "observation",
            "implementation_refs": refs,
            "text": text,
        }

    trend = payload.get("trend") or {}
    trend_series = trend.get("series") or []
    refs = [
        _stable_id(item)
        for item in trend_series
        if _stable_id(item) in implementation_map
    ]

    if refs:
        if language == "en":
            text = (
                "{} has deterministic trend evidence for the common "
                "measured input-size domain."
            ).format(_metric_label(metric, language))
        else:
            text = (
                "{} dispone de evidencia determinística de tendencia "
                "dentro del dominio común de tamaños medidos."
            ).format(_metric_label(metric, language))

        return {
            "metric": metric,
            "evidence_kind": "trend",
            "implementation_refs": refs,
            "text": text,
        }

    return None


def _observed_order_reversals(
    metrics,
    implementation_map,
    language,
):
    if len(implementation_map) != 2:
        return []

    refs = list(implementation_map.keys())
    order = []

    for metric, payload in metrics.items():
        series = (
            (payload.get("observation") or {}).get("series")
            or []
        )
        values = {}
        for item in series:
            ref = _stable_id(item)
            if ref in refs and item.get("median") is not None:
                values[ref] = item.get("median")

        if len(values) != 2:
            continue

        left = values[refs[0]]
        right = values[refs[1]]
        if left == right:
            continue
        order.append((
            metric,
            -1 if left < right else 1,
        ))

    for index, first in enumerate(order):
        for second in order[index + 1:]:
            if first[1] == second[1]:
                continue

            left_label = (
                implementation_map[refs[0]].get("label")
                or refs[0]
            )
            right_label = (
                implementation_map[refs[1]].get("label")
                or refs[1]
            )

            if language == "en":
                text = (
                    "The relative ordering of the observed medians for {} "
                    "and {} changes between {} and {}; inspect both metrics "
                    "instead of reducing the comparison to one ranking."
                ).format(
                    left_label,
                    right_label,
                    _metric_label(first[0], language),
                    _metric_label(second[0], language),
                )
            else:
                text = (
                    "El orden relativo de las medianas observadas de {} y {} "
                    "cambia entre {} y {}; conviene analizar ambas métricas "
                    "sin reducir la comparación a un único ranking."
                ).format(
                    left_label,
                    right_label,
                    _metric_label(first[0], language),
                    _metric_label(second[0], language),
                )

            return [
                {
                    "metrics": [first[0], second[0]],
                    "implementation_refs": refs,
                    "text": text,
                }
            ]

    return []


def _focus_text(metric, language):
    label = _metric_label(metric, language)

    if language == "en":
        return (
            "Inspect {} together with its reported dispersion and the "
            "shared input-size domain before drawing broader conclusions."
        ).format(label)

    return (
        "Conviene revisar {} junto con su dispersión reportada y el "
        "dominio común de tamaños antes de extraer conclusiones más amplias."
    ).format(label)


def _limitations(context, language):
    scope = context.get("scope") or {}
    status = str(scope.get("status") or "").upper()
    excluded = (
        (context.get("limitations") or {}).get("excluded_metrics")
        or []
    )
    common_sizes = scope.get("common_input_sizes") or []
    output = []

    if status == "LIMITED":
        output.append(
            "The comparison has limited scope; warnings and exclusions "
            "must remain visible."
            if language == "en"
            else
            "La comparación tiene alcance limitado; sus advertencias y "
            "exclusiones deben mantenerse visibles."
        )

    if excluded:
        labels = ", ".join(
            _metric_label(item.get("metric"), language)
            for item in excluded
            if item.get("metric")
        )
        if labels:
            output.append(
                (
                    "Excluded metrics are not interpreted as zero: {}."
                    if language == "en"
                    else
                    "Las métricas excluidas no se interpretan como cero: {}."
                ).format(labels)
            )

    if len(common_sizes) == 1:
        output.append(
            (
                "Only the common measured input size {} is available."
                if language == "en"
                else
                "Sólo está disponible el tamaño de entrada común medido {}."
            ).format(_format_value(common_sizes[0]))
        )

    return output[:5]


def _stable_id(item):
    return (
        _clean(item.get("public_id"))
        or _clean(item.get("codename"))
        or _clean(item.get("source_filename"))
    )


def _metric_label(metric, language):
    labels = {
        "DurationTime": {
            "es": "tiempo de ejecución",
            "en": "execution time",
        },
        "IPC": {
            "es": "IPC",
            "en": "IPC",
        },
        "CacheMissRate": {
            "es": "tasa de fallos de caché",
            "en": "cache miss rate",
        },
        "BranchMissRate": {
            "es": "tasa de fallos de predicción",
            "en": "branch miss rate",
        },
        "EnergyPkg": {
            "es": "energía del paquete",
            "en": "package energy",
        },
    }

    entry = labels.get(metric) or {}
    return entry.get(language) or metric or "métrica"


def _format_value(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _clean(value):
    if value is None:
        return ""
    return str(value).strip()
