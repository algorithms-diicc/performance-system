"""Pedagogía determinística para comparaciones científicas canónicas."""

COMPARISON_PEDAGOGY_VERSION = "1.0"
PRESENTATION_CONTRACT = "language-neutral-comparison-evidence-v1"

TARGET_METRICS = (
    "DurationTime",
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "EnergyPkg",
)


def build_comparison_pedagogy(comparison):
    """Construye evidencia pedagógica sin volver a medir ni recalcular muestras."""
    payload = comparison if isinstance(comparison, dict) else {}
    compatibility = _mapping(payload.get("compatibility"))
    metrics = _mapping(payload.get("metrics"))
    status = _normalized_token(compatibility.get("status"))

    metric_evidence = {}
    if status != "INCOMPATIBLE":
        for metric in TARGET_METRICS:
            metric_data = _mapping(metrics.get(metric))
            if metric_data:
                evidence = _metric_evidence(
                    metric,
                    metric_data,
                    compatibility,
                )
                if evidence is not None:
                    metric_evidence[metric] = evidence

    return {
        "version": COMPARISON_PEDAGOGY_VERSION,
        "generation": {
            "type": "deterministic_rules",
            "uses_ai": False,
            "statistics_recomputed": False,
            "derived_from_reported_aggregates": True,
            "source": "comparison",
            "presentation_contract": PRESENTATION_CONTRACT,
            "principles": [
                "Only canonical comparison aggregates are used.",
                "No winner or global score is assigned.",
                "No causal explanation is inferred from observed associations.",
                "Observed changes are not presented as asymptotic complexity.",
                "Missing or excluded metrics are never interpreted as zero.",
            ],
        },
        "scope": {
            "status": status or "UNKNOWN",
            "common_input_sizes": _numeric_domain(
                compatibility.get("commonInputSizes")
            ),
            "common_metrics": [
                metric
                for metric in compatibility.get("commonMetrics", [])
                if isinstance(metric, str) and metric
            ],
            "target_metric_count": len(TARGET_METRICS),
        },
        "metrics": metric_evidence,
        "limitations": {
            "issues": _public_issues(compatibility),
            "excluded_metrics": _excluded_metrics(compatibility),
        },
    }


def _metric_evidence(metric, metric_data, compatibility):
    common_sizes = _numeric_domain(metric_data.get("commonInputSizes"))
    series = metric_data.get("series")
    if not common_sizes or not isinstance(series, list) or not series:
        return None

    snapshot_input = common_sizes[-1]
    snapshot_values = []
    trend_series = []
    variability_series = []

    for item in series:
        if not isinstance(item, dict):
            continue
        points = _public_points(item.get("points"))
        if not points:
            continue

        identity = {
            "public_id": _clean_text(item.get("publicId")),
            "codename": _clean_text(item.get("codename")),
            "source_filename": _clean_text(item.get("sourceFilename")),
        }

        snapshot = next(
            (
                point
                for point in points
                if point["input_size"] == snapshot_input
            ),
            None,
        )
        if snapshot is not None:
            snapshot_values.append({
                **identity,
                "median": snapshot["median"],
                "mean": snapshot["mean"],
            })
            variability_series.append({
                **identity,
                "q1": snapshot["q1"],
                "q3": snapshot["q3"],
                "stddev": snapshot["stddev"],
            })

        first = points[0]
        last = points[-1]
        trend_series.append({
            **identity,
            "first": {
                "input_size": first["input_size"],
                "median": first["median"],
                "mean": first["mean"],
            },
            "last": {
                "input_size": last["input_size"],
                "median": last["median"],
                "mean": last["mean"],
            },
            "median_direction": _direction(
                first["median"],
                last["median"],
            ),
            "mean_direction": _direction(
                first["mean"],
                last["mean"],
            ),
        })

    if not snapshot_values and not trend_series:
        return None

    return {
        "metric": metric,
        "unit": _clean_text(metric_data.get("unit")) or "",
        "common_input_sizes": common_sizes,
        "observation": {
            "input_size": snapshot_input,
            "series": snapshot_values,
        },
        "trend": {
            "points_available": len(common_sizes),
            "series": trend_series,
        },
        "variability": {
            "input_size": snapshot_input,
            "series": variability_series,
        },
        "limitations": _metric_issue_codes(
            compatibility,
            metric,
        ),
    }


def _public_points(value):
    output = []
    for point in value if isinstance(value, list) else []:
        if not isinstance(point, dict):
            continue
        input_size = _finite_number(point.get("inputSize"))
        if input_size is None:
            continue
        output.append({
            "input_size": input_size,
            "median": _finite_number(point.get("median")),
            "mean": _finite_number(point.get("mean")),
            "q1": _finite_number(point.get("q1")),
            "q3": _finite_number(point.get("q3")),
            "stddev": _finite_number(point.get("stddev")),
        })
    return sorted(
        output,
        key=lambda item: item["input_size"],
    )


def _public_issues(compatibility):
    output = []
    seen = set()
    for collection in ("blockers", "warnings"):
        values = compatibility.get(collection)
        for issue in values if isinstance(values, list) else []:
            if not isinstance(issue, dict):
                continue
            item = {
                "severity": (
                    "blocker"
                    if collection == "blockers"
                    else "warning"
                ),
                "code": _normalized_token(issue.get("code")),
                "dimension": _clean_text(issue.get("dimension")),
                "metric": _clean_text(issue.get("metric")),
            }
            identity = tuple(item.values())
            if not item["code"] or identity in seen:
                continue
            seen.add(identity)
            output.append(item)
    return output


def _excluded_metrics(compatibility):
    output = []
    values = compatibility.get("excludedMetrics")
    for item in values if isinstance(values, list) else []:
        if not isinstance(item, dict):
            continue
        metric = _clean_text(item.get("metric"))
        if not metric:
            continue
        output.append({
            "metric": metric,
            "reason_code": _normalized_token(item.get("reasonCode")),
        })
    return output


def _metric_issue_codes(compatibility, metric):
    codes = []
    for issue in _public_issues(compatibility):
        issue_metric = issue.get("metric")
        if issue_metric not in (None, "", metric):
            continue
        code = issue.get("code")
        if code and code not in codes:
            codes.append(code)
    return codes


def _direction(first, last):
    if first is None or last is None:
        return "unavailable"
    if last > first:
        return "increased"
    if last < first:
        return "decreased"
    return "unchanged"


def _mapping(value):
    return value if isinstance(value, dict) else {}


def _clean_text(value):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    text = str(value).strip()
    return text or None


def _normalized_token(value):
    text = _clean_text(value)
    return text.upper() if text else ""


def _finite_number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        if number == number and number not in (
            float("inf"),
            float("-inf"),
        ):
            return int(number) if number.is_integer() else number
    return None


def _numeric_domain(values):
    numbers = []
    for value in values if isinstance(values, list) else []:
        number = _finite_number(value)
        if number is not None and number not in numbers:
            numbers.append(number)
    return sorted(numbers)
