import math


INTERPRETATION_VERSION = "1.1"
PRIMARY_METRICS = {
    "DurationTime",
    "Instructions",
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "L1DcacheLoadMisses",
}

TREND_MIN_POINTS = 2
SCALING_MIN_POINTS = 3
EPSILON = 1e-12


def build_results_analysis(metrics):
    """
    Construye señales descriptivas y reproducibles a partir del contrato
    agregado de métricas.

    Esta capa NO genera lenguaje pedagógico y NO clasifica una implementación
    como "buena", "mala", "eficiente" o equivalente. Tampoco infiere la
    complejidad asintótica del algoritmo.

    Su responsabilidad es producir hechos cuantitativos estructurados que
    posteriormente podrá consumir la capa pedagógica (UI-03C-2) y, más
    adelante, una capa opcional de IA.
    """
    metric_analyses = {}

    for metric_name, metric_data in (metrics or {}).items():
        metric_analyses[metric_name] = build_metric_analysis(
            metric_name,
            metric_data or {},
        )

    analyzed_primary = sum(
        1
        for name in PRIMARY_METRICS
        if metric_analyses.get(name, {}).get("status")
        in {"analyzed", "partial"}
    )

    return {
        "version": INTERPRETATION_VERSION,
        "methodology": {
            "nature": "deterministic_descriptive",
            "input": "aggregated_metric_points",
            "central_value": "median",
            "trend_min_points": TREND_MIN_POINTS,
            "log_log_scaling_min_points": SCALING_MIN_POINTS,
            "robust_dispersion": "(q3 - q1) / abs(median)",
            "coefficient_of_variation": "sample_stddev / abs(mean) [complementary]",
            "outlier_diagnostic": "iqr_outliers_detected / samples_evaluated; diagnostic only, no removal",
            "relative_change": "(last_median - first_median) / abs(first_median)",
            "observed_scaling": (
                "OLS slope of log(median) against log(input_size)"
            ),
            "limitations": [
                "Observed scaling is descriptive and is not an asymptotic complexity classification.",
                "No normative good/bad thresholds are applied in this stage.",
                "Trend and scaling are calculated independently for each source implementation.",
                "IQR outliers are diagnostic flags and are not removed from the aggregates.",
            ],
        },
        "summary": {
            "metrics_total": len(metric_analyses),
            "metrics_analyzed": sum(
                1
                for item in metric_analyses.values()
                if item.get("status") in {"analyzed", "partial"}
            ),
            "primary_metrics_total": len(PRIMARY_METRICS),
            "primary_metrics_analyzed": analyzed_primary,
        },
        "metrics": metric_analyses,
    }


def build_metric_analysis(metric_name, metric_data):
    status = metric_data.get("status")
    points = metric_data.get("points") or []

    if status not in {"available", "partial"} or not points:
        return {
            "status": "unavailable",
            "metric_status": status,
            "reason": metric_data.get("reason"),
            "unit": metric_data.get("unit"),
            "coverage": _build_coverage(metric_data),
            "sources": [],
        }

    grouped = _group_points_by_source(points)
    source_analyses = []

    for source, source_points in grouped:
        analysis = _analyze_source(source, source_points)
        if analysis is not None:
            source_analyses.append(analysis)

    analysis_status = (
        "partial"
        if status == "partial"
        else "analyzed"
    )

    return {
        "status": analysis_status,
        "metric_status": status,
        "reason": metric_data.get("reason"),
        "unit": metric_data.get("unit"),
        "coverage": _build_coverage(metric_data),
        "source_count": len(source_analyses),
        "sources": source_analyses,
    }


def _analyze_source(source, points):
    prepared = []

    for point in points:
        input_size = _finite(point.get("input_size"))
        median = _finite(point.get("median"))

        if input_size is None or median is None:
            continue

        prepared.append(
            {
                "source": source,
                "input_size": input_size,
                "median": median,
                "mean": _finite(point.get("mean")),
                "stddev": _finite(point.get("stddev")),
                "q1": _finite(point.get("q1")),
                "q3": _finite(point.get("q3")),
                "iqr": _finite(point.get("iqr")),
                "samples_total": _int_or_zero(point.get("samples_total")),
                "samples_valid": _int_or_zero(point.get("samples_valid")),
                "iqr_diagnostic_applied": bool(point.get("iqr_diagnostic_applied", False)),
                "iqr_outliers_detected": _int_or_zero(point.get("iqr_outliers_detected")),
                "outliers_removed": _int_or_zero(point.get("outliers_removed")),
            }
        )

    if not prepared:
        return None

    prepared.sort(key=lambda item: item["input_size"])
    max_point = prepared[-1]

    return {
        "source": source,
        "points_analyzed": len(prepared),
        "input_range": {
            "min": _clean_number(prepared[0]["input_size"]),
            "max": _clean_number(prepared[-1]["input_size"]),
        },
        "at_max_input": _build_max_input_snapshot(max_point),
        "variability": _build_variability(prepared),
        "outliers": _build_outlier_summary(prepared),
        "trend": _build_trend(prepared),
        "observed_scaling": _build_log_log_scaling(prepared),
    }

def _build_max_input_snapshot(point):
    cv = _coefficient_of_variation(point.get("mean"), point.get("stddev"))
    median = _finite(point.get("median"))
    q1 = _finite(point.get("q1"))
    q3 = _finite(point.get("q3"))

    relative_iqr = None
    if median is not None and q1 is not None and q3 is not None and abs(median) > EPSILON:
        relative_iqr = _finite(abs(q3 - q1) / abs(median))

    return {
        "input_size": _clean_number(point.get("input_size")),
        "median": median,
        "q1": q1,
        "q3": q3,
        "iqr": _finite(point.get("iqr")),
        "relative_iqr": relative_iqr,
        "mean": _finite(point.get("mean")),
        "stddev": _finite(point.get("stddev")),
        "coefficient_of_variation": cv,
        "samples_total": point.get("samples_total", 0),
        "samples_valid": point.get("samples_valid", 0),
        "iqr_diagnostic_applied": bool(point.get("iqr_diagnostic_applied", False)),
        "iqr_outliers_detected": point.get("iqr_outliers_detected", 0),
        "outliers_removed": point.get("outliers_removed", 0),
        "outlier_rate": _safe_ratio(point.get("outliers_removed", 0), point.get("samples_total", 0)),
    }

def _build_variability(points):
    relative_iqrs = []
    cvs = []

    for point in points:
        median = _finite(point.get("median"))
        q1 = _finite(point.get("q1"))
        q3 = _finite(point.get("q3"))

        if median is not None and q1 is not None and q3 is not None and abs(median) > EPSILON:
            value = _finite(abs(q3 - q1) / abs(median))
            if value is not None:
                relative_iqrs.append(value)

        cv = _coefficient_of_variation(point.get("mean"), point.get("stddev"))
        if cv is not None:
            cvs.append(cv)

    if not relative_iqrs and not cvs:
        return {
            "status": "unavailable",
            "points_with_relative_iqr": 0,
            "mean_relative_iqr": None,
            "max_relative_iqr": None,
            "min_relative_iqr": None,
            "points_with_cv": 0,
            "mean_cv": None,
            "max_cv": None,
            "min_cv": None,
        }

    return {
        "status": "available",
        "points_with_relative_iqr": len(relative_iqrs),
        "mean_relative_iqr": _finite(sum(relative_iqrs) / len(relative_iqrs)) if relative_iqrs else None,
        "max_relative_iqr": _finite(max(relative_iqrs)) if relative_iqrs else None,
        "min_relative_iqr": _finite(min(relative_iqrs)) if relative_iqrs else None,
        "points_with_cv": len(cvs),
        "mean_cv": _finite(sum(cvs) / len(cvs)) if cvs else None,
        "max_cv": _finite(max(cvs)) if cvs else None,
        "min_cv": _finite(min(cvs)) if cvs else None,
    }

def _build_outlier_summary(points):
    total = sum(point.get("samples_total", 0) for point in points)
    valid = sum(point.get("samples_valid", 0) for point in points)
    diagnostic_points = [point for point in points if point.get("iqr_diagnostic_applied")]
    evaluated = sum(point.get("samples_total", 0) for point in diagnostic_points)
    detected = sum(point.get("iqr_outliers_detected", 0) for point in diagnostic_points)

    return {
        "samples_total": int(total),
        "samples_valid": int(valid),
        "groups_total": int(len(points)),
        "iqr_diagnostic_groups": int(len(diagnostic_points)),
        "samples_evaluated": int(evaluated),
        "iqr_outliers_detected": int(detected),
        "iqr_outlier_rate": _safe_ratio(detected, evaluated),
        "diagnostic_only": True,
        "samples_removed": 0,
        "outliers_removed": 0,
        "outlier_rate": 0.0 if total > 0 else None,
    }

def _build_trend(points):
    if len(points) < TREND_MIN_POINTS:
        return {
            "status": "insufficient_points",
            "points_required": TREND_MIN_POINTS,
            "points_available": len(points),
        }

    xs = [point["input_size"] for point in points]
    ys = [point["median"] for point in points]
    first = ys[0]
    last = ys[-1]
    absolute_change = last - first
    relative_change = absolute_change / abs(first) if abs(first) > EPSILON else None
    pairwise = _pairwise_direction_counts(ys)
    regression = _linear_regression(xs, ys)

    return {
        "status": "available",
        "central_value": "median",
        "points_available": len(points),
        "first": {
            "input_size": _clean_number(xs[0]),
            "median": _finite(first),
            "mean": _finite(points[0].get("mean")),
        },
        "last": {
            "input_size": _clean_number(xs[-1]),
            "median": _finite(last),
            "mean": _finite(points[-1].get("mean")),
        },
        "absolute_change": _finite(absolute_change),
        "relative_change": _finite(relative_change),
        "pairwise": pairwise,
        "linear_fit": regression,
    }

def _build_log_log_scaling(points):
    positive = [
        point for point in points
        if point["input_size"] > 0 and point["median"] > 0
    ]

    if len(positive) < SCALING_MIN_POINTS:
        return {
            "status": "insufficient_points",
            "points_required": SCALING_MIN_POINTS,
            "points_available": len(positive),
        }

    log_x = [math.log(point["input_size"]) for point in positive]
    log_y = [math.log(point["median"]) for point in positive]
    regression = _linear_regression(log_x, log_y)

    if regression.get("status") != "available":
        return {
            "status": regression.get("status"),
            "points_required": SCALING_MIN_POINTS,
            "points_available": len(positive),
        }

    return {
        "status": "available",
        "central_value": "median",
        "points_available": len(positive),
        "exponent": regression.get("slope"),
        "r_squared": regression.get("r_squared"),
        "note": "Observed log-log scaling of medians only; not an asymptotic complexity classification.",
    }

def _build_coverage(metric_data):
    availability = metric_data.get("availability") or {}

    rows_total = _int_or_zero(availability.get("rows_total"))
    numeric = _int_or_zero(availability.get("numeric"))
    groups_total = _int_or_zero(availability.get("groups_total"))
    groups_with_data = _int_or_zero(
        availability.get("groups_with_data")
    )

    return {
        "rows_total": rows_total,
        "numeric_rows": numeric,
        "numeric_ratio": _safe_ratio(numeric, rows_total),
        "groups_total": groups_total,
        "groups_with_data": groups_with_data,
        "group_coverage_ratio": _safe_ratio(
            groups_with_data,
            groups_total,
        ),
        "unsupported": _int_or_zero(
            availability.get("unsupported")
        ),
        "not_counted": _int_or_zero(
            availability.get("not_counted")
        ),
        "missing": _int_or_zero(
            availability.get("missing")
        ),
    }


def _group_points_by_source(points):
    order = []
    grouped = {}

    for point in points:
        source = point.get("source")
        key = source if source is not None else "__default__"

        if key not in grouped:
            grouped[key] = []
            order.append(key)

        grouped[key].append(point)

    result = []
    for key in order:
        source = None if key == "__default__" else key
        result.append((source, grouped[key]))

    return result


def _pairwise_direction_counts(values):
    increasing = 0
    decreasing = 0
    unchanged = 0

    for previous, current in zip(values, values[1:]):
        delta = current - previous
        tolerance = EPSILON * max(
            1.0,
            abs(previous),
            abs(current),
        )

        if delta > tolerance:
            increasing += 1
        elif delta < -tolerance:
            decreasing += 1
        else:
            unchanged += 1

    total = max(0, len(values) - 1)

    return {
        "comparisons": total,
        "increasing": increasing,
        "decreasing": decreasing,
        "unchanged": unchanged,
        "increasing_ratio": _safe_ratio(increasing, total),
        "decreasing_ratio": _safe_ratio(decreasing, total),
        "unchanged_ratio": _safe_ratio(unchanged, total),
    }


def _linear_regression(xs, ys):
    if len(xs) != len(ys) or len(xs) < 2:
        return {
            "status": "insufficient_points",
        }

    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)

    ss_xx = sum((x - mean_x) ** 2 for x in xs)

    if ss_xx <= EPSILON:
        return {
            "status": "constant_x",
        }

    ss_xy = sum(
        (x - mean_x) * (y - mean_y)
        for x, y in zip(xs, ys)
    )

    slope = ss_xy / ss_xx
    intercept = mean_y - slope * mean_x

    predictions = [
        intercept + slope * x
        for x in xs
    ]

    ss_res = sum(
        (y - predicted) ** 2
        for y, predicted in zip(ys, predictions)
    )
    ss_tot = sum(
        (y - mean_y) ** 2
        for y in ys
    )

    if ss_tot <= EPSILON:
        r_squared = 1.0 if ss_res <= EPSILON else 0.0
    else:
        r_squared = 1.0 - (ss_res / ss_tot)

    return {
        "status": "available",
        "slope": _finite(slope),
        "intercept": _finite(intercept),
        "r_squared": _finite(r_squared),
    }


def _coefficient_of_variation(mean, stddev):
    mean = _finite(mean)
    stddev = _finite(stddev)

    if mean is None or stddev is None:
        return None

    if abs(mean) <= EPSILON:
        return None

    return _finite(abs(stddev) / abs(mean))


def _safe_ratio(numerator, denominator):
    try:
        numerator = float(numerator)
        denominator = float(denominator)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(numerator) or not math.isfinite(denominator):
        return None

    if abs(denominator) <= EPSILON:
        return None

    return _finite(numerator / denominator)


def _finite(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if math.isfinite(number) else None


def _int_or_zero(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _clean_number(value):
    number = _finite(value)

    if number is None:
        return None

    if number.is_integer():
        return int(number)

    return number