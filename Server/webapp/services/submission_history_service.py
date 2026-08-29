"""Helpers canónicos para historial de submissions.

La unidad primaria del historial es Submission. Las executions siguen siendo
la fuente de verdad para el estado técnico de cada implementación, pero el
historial necesita un estado agregado estable para el experimento completo.
"""

SUBMISSION_AGGREGATE_LABELS = {
    "EMPTY": "Sin ejecuciones",
    "IN_PROGRESS": "En progreso",
    "COMPLETED": "Completado",
    "PARTIAL": "Parcial",
    "FAILED": "Error",
    "CANCELLED": "Cancelado",
}

CAMM_BENCHMARKS = frozenset({
    "CAMM",
    "CAMMR",
    "CAMMS",
    "CAMMSO",
})


def _count(row, key):
    value = row.get(key)
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def derive_submission_aggregate_state(row):
    """Deriva el estado del experimento usando todas sus executions."""
    total = _count(row, "executions_count")
    completed = _count(row, "completed_executions")
    failed = _count(row, "failed_executions")
    cancelled = _count(row, "cancelled_executions")
    queued = _count(row, "queued_executions")
    running = _count(row, "running_executions")
    processing = _count(row, "processing_executions")

    active = queued + running + processing
    unsuccessful_terminal = failed + cancelled

    if total == 0:
        return "EMPTY"

    if active > 0:
        return "IN_PROGRESS"

    if completed > 0 and unsuccessful_terminal == 0:
        return "COMPLETED"

    if completed > 0 and unsuccessful_terminal > 0:
        return "PARTIAL"

    if completed == 0 and failed > 0:
        return "FAILED"

    if completed == 0 and failed == 0 and cancelled > 0:
        return "CANCELLED"

    return "EMPTY"


def aggregate_state_label(state):
    normalized = str(state or "").strip().upper()
    return SUBMISSION_AGGREGATE_LABELS.get(
        normalized,
        SUBMISSION_AGGREGATE_LABELS["EMPTY"],
    )


def normalize_benchmark_family(value):
    benchmark = str(value or "").strip().upper()
    if not benchmark:
        return None
    if benchmark in CAMM_BENCHMARKS:
        return "CAMM"
    return benchmark


def _stable_unique_strings(values):
    if values is None:
        return []

    if isinstance(values, str):
        values = [values]

    result = []
    seen = set()

    for value in values:
        normalized = str(value or "").strip()
        if not normalized:
            continue

        key = normalized.casefold()
        if key in seen:
            continue

        seen.add(key)
        result.append(normalized)

    return result


def _iso(value):
    return value.isoformat() if value is not None else None


def _submission_language(value):
    language = str(value or "").strip()
    return language if language in {"C", "C++", "C/C++"} else None


def build_submission_history_projection(row):
    """Serializa la parte canónica que necesita la lista de historial."""
    aggregate_state = derive_submission_aggregate_state(row)
    benchmarks = _stable_unique_strings(row.get("benchmarks"))
    benchmark_families = _stable_unique_strings(
        normalize_benchmark_family(value)
        for value in benchmarks
    )
    source_filenames = _stable_unique_strings(
        row.get("source_filenames")
    )
    measurement_nodes = _stable_unique_strings(
        row.get("measurement_node_names")
    )
    hardware_profiles = _stable_unique_strings(
        row.get("hardware_profile_names")
    )

    summary = {
        "executionsCount": _count(row, "executions_count"),
        "completedExecutions": _count(row, "completed_executions"),
        "failedExecutions": _count(row, "failed_executions"),
        "queuedExecutions": _count(row, "queued_executions"),
        "runningExecutions": _count(row, "running_executions"),
        "processingExecutions": _count(row, "processing_executions"),
        "cancelledExecutions": _count(row, "cancelled_executions"),
    }

    activity_at = row.get("activity_at") or row.get("created_at")

    return {
        "language": _submission_language(row.get("language")),
        "aggregateState": aggregate_state,
        "aggregateStateLabel": aggregate_state_label(aggregate_state),
        "activityAt": _iso(activity_at),
        "benchmarks": benchmarks,
        "benchmarkFamilies": benchmark_families,
        "sourceFilenames": source_filenames,
        "measurementNodes": measurement_nodes,
        "hardwareProfiles": hardware_profiles,
        "summary": summary,
    }
