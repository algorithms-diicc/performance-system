from .ai_runtime import build_provider_shaped_response
from .ai_transports import AITransportError


def individual_mock_transport(
    request_payload,
    api_key,
    *,
    context,
    language,
):
    # Sólo sustituye la dependencia externa. Parser y guardrails siguen reales.
    del request_payload
    del api_key

    content = _build_mock_content(
        context=context,
        language=language,
    )

    return build_provider_shaped_response(content)


def _build_mock_content(context, language):
    metrics = context.get("metrics") or {}
    observations = []
    selected_metric_names = []
    preferred_kinds = (
        "trend",
        "snapshot",
        "outliers",
        "coverage",
        "availability",
        "limitation",
        "observed_scaling",
    )

    for metric_name, metric_payload in metrics.items():
        messages = metric_payload.get("messages") or []
        selected = None

        for kind in preferred_kinds:
            selected = next(
                (
                    message
                    for message in messages
                    if message.get("kind") == kind
                ),
                None,
            )
            if selected:
                break

        if not selected:
            continue

        observations.append(
            {
                "metric": metric_name,
                "evidence_kind": selected.get("kind"),
                "text": _mock_observation_text(
                    metric_name=metric_name,
                    message=selected,
                    language=language,
                ),
            }
        )
        selected_metric_names.append(metric_name)

        if len(observations) >= 3:
            break

    if not observations:
        raise AITransportError(
            "El modo mock no encontró evidencia determinística utilizable."
        )

    benchmark = (
        context.get("execution", {}).get("benchmark")
        or "benchmark"
    )
    metric_list = _join_metric_labels(
        selected_metric_names,
        language,
    )

    if language == "en":
        summary = (
            "This simulated assistant reading uses the deterministic "
            "evidence available for the {} execution and focuses on {}."
        ).format(benchmark, metric_list)
        takeaway = (
            "Inspect the observed behavior of {} together across the "
            "measured input sizes, and keep the experimental limitations "
            "visible before drawing broader conclusions."
        ).format(metric_list)
    else:
        summary = (
            "Esta lectura simulada usa la evidencia determinística "
            "disponible para la ejecución {} y se concentra en {}."
        ).format(benchmark, metric_list)
        takeaway = (
            "Conviene revisar en conjunto el comportamiento observado de "
            "{} a través de los tamaños de entrada medidos y mantener "
            "visibles las limitaciones experimentales antes de extraer "
            "conclusiones más amplias."
        ).format(metric_list)

    return {
        "summary": summary,
        "observations": observations,
        "limitations": _mock_limitations(metrics, language),
        "student_takeaway": takeaway,
    }


def _mock_observation_text(metric_name, message, language):
    evidence_kind = message.get("kind")
    evidence = message.get("evidence") or {}
    label = _metric_label(metric_name, language)

    if evidence_kind == "trend":
        first = evidence.get("first") or {}
        last = evidence.get("last") or {}
        first_input = first.get("input_size")
        last_input = last.get("input_size")
        first_value = first.get("median")
        last_value = last.get("median")

        if all(
            value is not None
            for value in (
                first_input,
                last_input,
                first_value,
                last_value,
            )
        ):
            direction = _observed_direction(
                first_value,
                last_value,
                language,
            )

            if language == "en":
                return (
                    "For {}, the median changed from {} at input size {} "
                    "to {} at input size {}; the observed direction was {}."
                ).format(
                    label,
                    _display_metric_value(metric_name, first_value),
                    first_input,
                    _display_metric_value(metric_name, last_value),
                    last_input,
                    direction,
                )

            return (
                "Para {}, la mediana pasó de {} en el tamaño de entrada {} "
                "a {} en el tamaño {}; la dirección observada fue {}."
            ).format(
                label,
                _display_metric_value(metric_name, first_value),
                first_input,
                _display_metric_value(metric_name, last_value),
                last_input,
                direction,
            )

    if evidence_kind == "snapshot":
        input_size = evidence.get("input_size")
        median = evidence.get("median")
        mean = evidence.get("mean")

        if input_size is not None and median is not None:
            if language == "en":
                return (
                    "At input size {}, the deterministic analysis reports "
                    "a median {} of {}."
                ).format(
                    input_size,
                    label,
                    _display_metric_value(metric_name, median),
                )

            return (
                "En el tamaño de entrada {}, el análisis determinístico "
                "registra una mediana de {} para {}."
            ).format(
                input_size,
                _display_metric_value(metric_name, median),
                label,
            )

        if input_size is not None and mean is not None:
            if language == "en":
                return (
                    "At input size {}, the deterministic analysis reports "
                    "a mean {} of {}."
                ).format(
                    input_size,
                    label,
                    _display_metric_value(metric_name, mean),
                )

            return (
                "En el tamaño de entrada {}, el análisis determinístico "
                "registra una media de {} para {}."
            ).format(
                input_size,
                _display_metric_value(metric_name, mean),
                label,
            )

    if evidence_kind == "outliers":
        detected = evidence.get("iqr_outliers_detected")
        evaluated = evidence.get("samples_evaluated")

        if detected is not None and evaluated is not None:
            if language == "en":
                return (
                    "The IQR diagnostic for {} flagged {} observations "
                    "among {} evaluated samples; those observations remain "
                    "part of the reported aggregates."
                ).format(label, detected, evaluated)

            return (
                "El diagnóstico IQR para {} marcó {} observaciones entre "
                "{} muestras evaluadas; esas observaciones se mantienen "
                "dentro de los agregados reportados."
            ).format(label, detected, evaluated)

    if evidence_kind == "coverage":
        numeric_rows = evidence.get("numeric_rows")
        rows_total = evidence.get("rows_total")

        if numeric_rows is not None and rows_total is not None:
            if language == "en":
                return (
                    "For {}, numeric measurements were available in {} "
                    "of {} recorded rows."
                ).format(label, numeric_rows, rows_total)

            return (
                "Para {}, hubo mediciones numéricas disponibles en {} "
                "de {} filas registradas."
            ).format(label, numeric_rows, rows_total)

    if evidence_kind == "limitation":
        points = evidence.get("points_analyzed")

        if points is not None:
            if language == "en":
                return (
                    "The deterministic evidence for {} contains {} "
                    "analyzed input point, so the scope of any trend "
                    "interpretation is limited."
                ).format(label, points)

            return (
                "La evidencia determinística para {} contiene {} punto "
                "de entrada analizado, por lo que el alcance de cualquier "
                "interpretación de tendencia es limitado."
            ).format(label, points)

    if evidence_kind == "observed_scaling":
        exponent = evidence.get("exponent")
        r_squared = evidence.get("r_squared")

        if exponent is not None and r_squared is not None:
            if language == "en":
                return (
                    "For {}, the deterministic empirical fit reports "
                    "exponent {} with R² {}; this describes only the "
                    "measured points and is not an asymptotic-complexity "
                    "classification."
                ).format(label, exponent, r_squared)

            return (
                "Para {}, el ajuste empírico determinístico registra "
                "exponente {} con R² {}; esto describe únicamente los "
                "puntos medidos y no constituye una clasificación de "
                "complejidad asintótica."
            ).format(label, exponent, r_squared)

    if evidence_kind == "availability":
        if language == "en":
            return (
                "The deterministic evidence reports a measurement "
                "availability limitation for {}."
            ).format(label)

        return (
            "La evidencia determinística informa una limitación de "
            "disponibilidad de medición para {}."
        ).format(label)

    if language == "en":
        return (
            "The deterministic evidence contains a validated observation "
            "for {}."
        ).format(label)

    return (
        "La evidencia determinística contiene una observación validada "
        "para {}."
    ).format(label)


def _mock_limitations(metrics, language):
    has_scope_limitation = False
    has_availability = False
    has_scaling = False

    for metric_payload in metrics.values():
        for message in metric_payload.get("messages") or []:
            kind = message.get("kind")
            has_scope_limitation = has_scope_limitation or kind == "limitation"
            has_availability = has_availability or kind in {"availability", "coverage"}
            has_scaling = has_scaling or kind == "observed_scaling"

    result = []

    if has_scope_limitation:
        result.append(
            "The deterministic analysis reports an experimental scope limitation that should constrain interpretation."
            if language == "en"
            else "El análisis determinístico registra una limitación de alcance experimental que debe restringir la interpretación."
        )

    if has_availability:
        result.append(
            "Some evidence has limited measurement availability or coverage; missing measurements must not be read as zero."
            if language == "en"
            else "Parte de la evidencia presenta disponibilidad o cobertura de medición limitada; una medición ausente no debe interpretarse como cero."
        )

    if has_scaling:
        result.append(
            "Observed empirical scaling describes the measured points only and must not be interpreted as asymptotic complexity."
            if language == "en"
            else "El escalamiento empírico observado describe sólo los puntos medidos y no debe interpretarse como complejidad asintótica."
        )

    return result


def _observed_direction(first_value, last_value, language):
    try:
        first_numeric = float(first_value)
        last_numeric = float(last_value)
    except (TypeError, ValueError):
        return (
            "reported by the deterministic analysis"
            if language == "en"
            else "registrada por el análisis determinístico"
        )

    if last_numeric > first_numeric:
        return "increasing" if language == "en" else "creciente"
    if last_numeric < first_numeric:
        return "decreasing" if language == "en" else "decreciente"
    return "stable" if language == "en" else "estable"


def _display_metric_value(metric_name, value):
    units = {
        "DurationTime": " ms",
        "CacheMissRate": " %",
        "BranchMissRate": " %",
    }
    return "{}{}".format(value, units.get(metric_name, ""))


def _join_metric_labels(metric_names, language):
    labels = [
        _metric_label(metric_name, language)
        for metric_name in metric_names
    ]

    if not labels:
        return "the available metrics" if language == "en" else "las métricas disponibles"
    if len(labels) == 1:
        return labels[0]

    conjunction = " and " if language == "en" else " y "
    return ", ".join(labels[:-1]) + conjunction + labels[-1]


def _metric_label(metric_name, language):
    labels = {
        "DurationTime": {"es": "tiempo de ejecución", "en": "execution time"},
        "IPC": {"es": "IPC", "en": "IPC"},
        "CacheMissRate": {"es": "tasa de fallos de caché", "en": "cache miss rate"},
        "BranchMissRate": {"es": "tasa de fallos de predicción", "en": "branch miss rate"},
        "Instructions": {"es": "instrucciones", "en": "instructions"},
        "L1DcacheLoadMisses": {"es": "fallos de lectura L1D", "en": "L1D load misses"},
    }
    entry = labels.get(metric_name) or {}
    return entry.get(language) or metric_name
