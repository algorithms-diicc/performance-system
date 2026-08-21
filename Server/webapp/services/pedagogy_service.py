PEDAGOGY_VERSION = "1.1"
PRESENTATION_CONTRACT = "language-neutral-evidence-v1"

PRIMARY_ORDER = [
    "DurationTime",
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "Instructions",
    "L1DcacheLoadMisses",
]

METRIC_LABELS = {
    "DurationTime": "Tiempo de ejecución",
    "Instructions": "Instrucciones",
    "IPC": "IPC",
    "CacheMissRate": "Tasa de fallos de caché",
    "BranchMissRate": "Tasa de fallos de predicción",
    "L1DcacheLoadMisses": "Fallos de lectura L1D",
    "CpuCycles": "Ciclos de CPU",
    "CacheReferences": "Referencias de caché",
    "CacheMisses": "Fallos de caché",
    "Branches": "Saltos",
    "BranchMisses": "Fallos de predicción",
    "TaskClock": "Task clock",
    "CpuClock": "CPU clock",
    "PageFaults": "Fallos de página",
    "MajorFaults": "Fallos de página mayores",
    "EnergyPkg": "Energía del paquete",
    "EnergyCores": "Energía de núcleos",
    "EnergyRAM": "Energía de memoria",
}

PERCENT_METRICS = {
    "CacheMissRate",
    "BranchMissRate",
}

MILLISECOND_METRICS = {
    "DurationTime",
    "TaskClock",
    "CpuClock",
}


def build_pedagogical_interpretation(analysis, metrics):
    """
    Convierte hechos cuantitativos ya calculados en mensajes pedagógicos
    determinísticos.

    Esta función NO vuelve a calcular estadísticas y NO usa IA.
    Cada mensaje conserva evidencia estructurada para que pueda auditarse
    de dónde salió la explicación.
    """
    analysis_metrics = (analysis or {}).get("metrics") or {}
    metrics = metrics or {}

    metric_messages = {}

    for metric_name, metric_analysis in analysis_metrics.items():
        metric_messages[metric_name] = _build_metric_messages(
            metric_name,
            metric_analysis or {},
            metrics.get(metric_name) or {},
        )

    summary = _build_summary(metric_messages)

    return {
        "version": PEDAGOGY_VERSION,
        "generation": {
            "type": "deterministic_rules",
            "uses_ai": False,
            "statistics_recomputed": False,
            "source": "analysis",
            "presentation_contract": PRESENTATION_CONTRACT,
            "principles": [
                "Only statements supported by structured analysis are emitted.",
                "No good/bad performance labels are assigned without an explicit reference baseline.",
                "Observed scaling is described as empirical and is not presented as asymptotic complexity.",
                "Unavailable metrics are explained without interpreting missing measurements as zero.",
            ],
        },
        "summary": summary,
        "metrics": metric_messages,
    }


def _build_metric_messages(metric_name, metric_analysis, metric_data):
    label = METRIC_LABELS.get(metric_name, metric_name)
    status = metric_analysis.get("status")

    if status == "unavailable":
        return {
            "status": "unavailable",
            "label": label,
            "messages": [
                _unavailable_message(
                    metric_name,
                    metric_analysis,
                )
            ],
        }

    messages = []
    sources = metric_analysis.get("sources") or []

    for source in sources:
        messages.extend(
            _build_source_messages(
                metric_name,
                label,
                source,
            )
        )

    coverage_message = _coverage_message(
        metric_name,
        metric_analysis,
    )
    if coverage_message:
        messages.append(coverage_message)

    return {
        "status": status,
        "label": label,
        "messages": messages,
    }


def _build_source_messages(metric_name, label, source):
    messages = []
    source_name = source.get("source")
    evidence_source = source_name or "default"

    snapshot = source.get("at_max_input") or {}
    if snapshot.get("median") is not None:
        input_size = snapshot.get("input_size")
        median = snapshot.get("median")
        q1 = snapshot.get("q1")
        q3 = snapshot.get("q3")
        mean = snapshot.get("mean")
        stddev = snapshot.get("stddev")
        cv = snapshot.get("coefficient_of_variation")

        text = (
            "{}: en el mayor tamaño de entrada medido ({}) "
            "la mediana fue {}."
        ).format(
            label,
            _format_number(input_size),
            _format_metric_value(metric_name, median),
        )

        if q1 is not None and q3 is not None:
            text += " El intervalo Q1–Q3 fue de {} a {}.".format(
                _format_metric_value(metric_name, q1),
                _format_metric_value(metric_name, q3),
            )

        if mean is not None:
            text += " Como referencia complementaria, la media fue {}.".format(
                _format_metric_value(metric_name, mean)
            )

        if stddev is not None:
            text += " La desviación estándar fue {}.".format(
                _format_metric_value(metric_name, stddev)
            )

        if cv is not None:
            text += " El coeficiente de variación clásico fue {}.".format(
                _format_percent(cv)
            )

        messages.append(_message(
            kind="snapshot",
            priority="primary",
            text=text,
            metric=metric_name,
            source=evidence_source,
            evidence={
                "input_size": input_size,
                "median": median,
                "q1": q1,
                "q3": q3,
                "iqr": snapshot.get("iqr"),
                "mean": mean,
                "stddev": stddev,
                "coefficient_of_variation": cv,
                "samples_total": snapshot.get("samples_total"),
                "samples_valid": snapshot.get("samples_valid"),
            },
        ))

    trend = source.get("trend") or {}
    if trend.get("status") == "available":
        first = trend.get("first") or {}
        last = trend.get("last") or {}
        relative = trend.get("relative_change")
        pairwise = trend.get("pairwise") or {}
        direction = _direction_text(relative)

        text = (
            "Entre los tamaños de entrada {} y {}, la mediana de {} "
            "pasó de {} a {}{}."
        ).format(
            _format_number(first.get("input_size")),
            _format_number(last.get("input_size")),
            label.lower(),
            _format_metric_value(metric_name, first.get("median")),
            _format_metric_value(metric_name, last.get("median")),
            _relative_change_clause(relative, direction),
        )

        comparisons = pairwise.get("comparisons") or 0
        if comparisons > 0:
            text += (
                " En los {} intervalos consecutivos de las medianas: "
                "{} aumentos, {} disminuciones y {} sin cambio apreciable."
            ).format(
                comparisons,
                pairwise.get("increasing", 0),
                pairwise.get("decreasing", 0),
                pairwise.get("unchanged", 0),
            )

        messages.append(_message(
            kind="trend",
            priority="primary",
            text=text,
            metric=metric_name,
            source=evidence_source,
            evidence={
                "central_value": "median",
                "first": first,
                "last": last,
                "relative_change": relative,
                "pairwise": pairwise,
                "linear_fit": trend.get("linear_fit"),
            },
        ))

    scaling = source.get("observed_scaling") or {}
    if scaling.get("status") == "available":
        exponent = scaling.get("exponent")
        r_squared = scaling.get("r_squared")
        text = (
            "En la escala log-log observada sobre las medianas, {} "
            "presentó un exponente empírico de {} con R²={}. "
            "Este valor describe únicamente los puntos medidos y no "
            "constituye una clasificación de complejidad asintótica."
        ).format(
            label.lower(),
            _format_number(exponent, 3),
            _format_number(r_squared, 3),
        )

        messages.append(_message(
            kind="observed_scaling",
            priority="advanced",
            text=text,
            metric=metric_name,
            source=evidence_source,
            evidence={
                "central_value": "median",
                "exponent": exponent,
                "r_squared": r_squared,
                "points_available": scaling.get("points_available"),
            },
        ))

    outliers = source.get("outliers") or {}
    total = outliers.get("samples_total") or 0
    evaluated = outliers.get("samples_evaluated") or 0
    detected = outliers.get("iqr_outliers_detected") or 0
    diagnostic_groups = outliers.get("iqr_diagnostic_groups") or 0
    groups_total = outliers.get("groups_total") or 0

    if evaluated > 0:
        text = (
            "El criterio IQR 1,5× se utilizó solo como diagnóstico: "
            "detectó {} de {} muestras evaluadas ({}) como potencialmente "
            "atípicas. Estas observaciones se conservaron; no se eliminó "
            "ninguna muestra de los agregados."
        ).format(
            detected,
            evaluated,
            _format_percent(outliers.get("iqr_outlier_rate") or 0.0),
        )
        if groups_total > 0:
            text += " El diagnóstico se aplicó en {} de {} puntos de entrada.".format(
                diagnostic_groups, groups_total
            )

        messages.append(_message(
            kind="outliers",
            priority="secondary",
            text=text,
            metric=metric_name,
            source=evidence_source,
            evidence={
                "diagnostic_only": True,
                "samples_total": total,
                "samples_valid": outliers.get("samples_valid"),
                "samples_evaluated": evaluated,
                "iqr_diagnostic_groups": diagnostic_groups,
                "groups_total": groups_total,
                "iqr_outliers_detected": detected,
                "iqr_outlier_rate": outliers.get("iqr_outlier_rate"),
                "samples_removed": 0,
            },
        ))
    elif total > 0:
        messages.append(_message(
            kind="outliers",
            priority="secondary",
            text=(
                "El criterio IQR no se aplicó como diagnóstico porque los "
                "puntos disponibles no alcanzaron el mínimo de muestras "
                "requerido. No se eliminó ninguna muestra de los agregados."
            ),
            metric=metric_name,
            source=evidence_source,
            evidence={
                "diagnostic_only": True,
                "samples_total": total,
                "samples_valid": outliers.get("samples_valid"),
                "samples_evaluated": 0,
                "iqr_outliers_detected": 0,
                "samples_removed": 0,
            },
        ))

    if trend.get("status") == "insufficient_points" and source.get("points_analyzed") == 1:
        messages.append(_message(
            kind="limitation",
            priority="secondary",
            text=(
                "Esta ejecución contiene un único tamaño de entrada para esta "
                "métrica, por lo que no es posible describir una tendencia "
                "respecto del tamaño de entrada."
            ),
            metric=metric_name,
            source=evidence_source,
            evidence={
                "points_analyzed": source.get("points_analyzed"),
                "trend_status": "insufficient_points",
            },
        ))

    return messages

def _coverage_message(metric_name, metric_analysis):
    coverage = metric_analysis.get("coverage") or {}
    total = coverage.get("rows_total") or 0
    numeric = coverage.get("numeric_rows") or 0

    if total <= 0:
        return None

    if numeric == total:
        return None

    return _message(
        kind="coverage",
        priority="secondary",
        text=(
            "{} de {} filas de medición contienen un valor numérico "
            "para esta métrica."
        ).format(
            numeric,
            total,
        ),
        metric=metric_name,
        source=None,
        evidence=coverage,
    )


def _unavailable_message(metric_name, metric_analysis):
    metric_status = metric_analysis.get("metric_status")
    coverage = metric_analysis.get("coverage") or {}

    if metric_status == "permission_denied":
        text = (
            "Esta métrica no fue medida porque el proceso de medición "
            "no tuvo permisos suficientes para acceder al evento de "
            "rendimiento solicitado."
        )
    elif metric_status == "unsupported":
        text = (
            "Esta métrica no fue medida porque el evento de hardware "
            "no está soportado por el entorno de ejecución utilizado."
        )
    elif metric_status == "not_counted":
        text = (
            "El evento fue reconocido, pero no se obtuvo un conteo "
            "válido durante esta ejecución."
        )
    else:
        text = (
            "No se obtuvieron observaciones numéricas válidas para "
            "esta métrica."
        )

    text += " La ausencia de medición no se interpreta como un valor cero."

    return _message(
        kind="availability",
        priority="secondary",
        text=text,
        metric=metric_name,
        source=None,
        evidence={
            "metric_status": metric_status,
            "coverage": coverage,
        },
    )


def _build_summary(metric_messages):
    available = []
    unavailable = []

    for metric_name in PRIMARY_ORDER:
        item = metric_messages.get(metric_name)
        if not item:
            continue

        if item.get("status") == "unavailable":
            unavailable.append(metric_name)
        else:
            available.append(metric_name)

    highlights = []

    for metric_name in PRIMARY_ORDER:
        item = metric_messages.get(metric_name) or {}
        messages = item.get("messages") or []

        preferred = None
        for kind in ("trend", "snapshot", "coverage"):
            preferred = next(
                (
                    message
                    for message in messages
                    if message.get("kind") == kind
                ),
                None,
            )
            if preferred:
                break

        if preferred:
            highlights.append(preferred)

        if len(highlights) >= 3:
            break

    return {
        "primary_metrics_available": available,
        "primary_metrics_unavailable": unavailable,
        "highlights": highlights,
    }


def _message(kind, priority, text, metric, source, evidence):
    # `text` se conserva sólo por compatibilidad legacy.
    # La UI debe presentar `message_code + metric + source + evidence`.
    evidence = evidence or {}

    return {
        "kind": kind,
        "message_code": _message_code(kind, evidence),
        "priority": priority,
        "text": text,
        "metric": metric,
        "source": source,
        "evidence": evidence,
    }


def _message_code(kind, evidence):
    if kind == "snapshot":
        return "snapshot"

    if kind == "trend":
        return "trend"

    if kind == "observed_scaling":
        return "observed_scaling"

    if kind == "outliers":
        if (evidence.get("samples_evaluated") or 0) > 0:
            return "outliers_detected"
        return "outliers_insufficient"

    if kind == "limitation":
        if evidence.get("trend_status") == "insufficient_points":
            return "single_input_limitation"
        return "limitation"

    if kind == "coverage":
        return "partial_coverage"

    if kind == "availability":
        metric_status = evidence.get("metric_status")

        if metric_status == "permission_denied":
            return "availability_permission_denied"

        if metric_status == "unsupported":
            return "availability_unsupported"

        if metric_status == "not_counted":
            return "availability_not_counted"

        return "availability_no_numeric"

    return kind


def _direction_text(relative):
    if relative is None:
        return None

    if relative > 0:
        return "aumentó"

    if relative < 0:
        return "disminuyó"

    return "no cambió"


def _relative_change_clause(relative, direction):
    if relative is None:
        return ""

    magnitude = abs(relative)

    if direction == "aumentó":
        return ", un aumento de {}".format(
            _format_percent(magnitude)
        )

    if direction == "disminuyó":
        return ", una disminución de {}".format(
            _format_percent(magnitude)
        )

    return ", sin cambio relativo"


def _format_metric_value(metric_name, value):
    if value is None:
        return "—"

    if metric_name in PERCENT_METRICS:
        return _format_percent(value)

    if metric_name in MILLISECOND_METRICS:
        return "{} ms".format(
            _format_number(value, 3)
        )

    if metric_name == "IPC":
        return _format_number(value, 3)

    if metric_name.startswith("Energy"):
        return "{} J".format(
            _format_number(value, 4)
        )

    return _format_number(value, 3)


def _format_percent(value):
    if value is None:
        return "—"

    return "{} %".format(
        _format_number(float(value) * 100.0, 2)
    )


def _format_number(value, decimals=3):
    if value is None:
        return "—"

    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)

    if abs(number - round(number)) < 1e-12:
        return str(int(round(number)))

    text = ("{:." + str(decimals) + "f}").format(number)
    text = text.rstrip("0").rstrip(".")

    # Las explicaciones pedagógicas se presentan en español.
    # Se mantiene el valor numérico intacto y sólo se adapta
    # el separador decimal para evitar ambigüedad visual:
    # 17.736 -> 17,736.
    return text.replace(".", ",")