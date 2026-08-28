"""Gate 7B — selector serial de MeasurementNode con afinidad de experimento."""

import os

from ..repositories import measurement_node_assignment_repository
from .hardware_profile_service import (
    normalize_policy_benchmark,
    normalize_policy_execution_profile,
)
from .measurement_node_service import (
    AVAILABLE,
    derive_measurement_node_state,
)


AUTO = "AUTO"
PINNED = "PINNED"
VALID_MODES = frozenset({AUTO, PINNED})


class MeasurementNodeSelectionError(ValueError):
    """La solicitud persistida no puede convertirse en una selección válida."""


def normalize_measurement_node_mode(value):
    """Las submissions legacy NULL se interpretan como AUTO sin backfill global."""
    normalized = str(value or AUTO).strip().upper()
    if normalized not in VALID_MODES:
        raise MeasurementNodeSelectionError(
            "Unsupported measurement_node_mode: {!r}.".format(value)
        )
    return normalized


def configured_allow_validation_only(environment=None):
    """
    Mantiene validation-only fuera del flujo normal salvo habilitación explícita.

    La bandera está pensada para campañas controladas como Gate 9; no se deriva
    de datos enviados por estudiantes.
    """
    source = os.environ if environment is None else environment
    value = str(
        source.get("MEASUREMENT_NODE_ALLOW_VALIDATION_ONLY", "false")
    ).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _as_positive_int(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _is_hard_compatible(candidate, input_size):
    minimum = _as_positive_int(candidate.get("minimum_input"))
    recommended = _as_positive_int(
        candidate.get("recommended_max_input")
    )
    hard_max = _as_positive_int(candidate.get("hard_max_input"))

    if None in (minimum, recommended, hard_max):
        return False

    if not minimum <= recommended <= hard_max:
        return False

    return minimum <= input_size <= hard_max


def _is_available(
    candidate,
    *,
    now,
    stale_after_seconds,
    allow_validation_only,
):
    if (
        bool(candidate.get("is_validation_only"))
        and not allow_validation_only
    ):
        return False

    state = derive_measurement_node_state(
        candidate,
        now=now,
        stale_after_seconds=stale_after_seconds,
    )
    return state == AVAILABLE


def _rank_key(candidate, input_size):
    recommended = int(candidate["recommended_max_input"])
    priority = int(candidate.get("institutional_priority") or 0)
    node_id = int(candidate["measurement_node_id"])

    # Rango recomendado antes que prioridad institucional. La prioridad es una
    # preferencia administrativa, nunca un score de potencia de CPU.
    return (
        0 if input_size <= recommended else 1,
        -priority,
        node_id,
    )


def select_measurement_node(
    execution,
    submission,
    *,
    conn,
    repository=measurement_node_assignment_repository,
    now=None,
    stale_after_seconds=None,
    allow_validation_only=None,
):
    """
    Resuelve un nodo sin modificar estado ni hacer commit.

    Retorna None cuando el head FIFO debe permanecer QUEUED. Un resultado
    exitoso contiene los IDs de procedencia y si la affinity debe persistirse.
    """
    if not isinstance(execution, dict) or not isinstance(submission, dict):
        raise MeasurementNodeSelectionError(
            "Execution and Submission must be dictionaries."
        )

    mode = normalize_measurement_node_mode(
        submission.get("measurement_node_mode")
    )
    assigned_id = _as_positive_int(
        submission.get("assigned_measurement_node_id")
    )
    submission_id = _as_positive_int(submission.get("id"))
    input_size = _as_positive_int(execution.get("input_size"))

    if submission_id is None or input_size is None:
        raise MeasurementNodeSelectionError(
            "Submission id and execution input_size must be positive integers."
        )

    benchmark = normalize_policy_benchmark(
        execution.get("benchmark")
    )
    execution_profile = normalize_policy_execution_profile(
        execution.get("execution_profile")
    )

    allow_validation = (
        configured_allow_validation_only()
        if allow_validation_only is None
        else bool(allow_validation_only)
    )

    candidates = repository.list_policy_candidates(
        benchmark,
        execution_profile,
        conn,
    )

    eligible = []
    by_id = {}

    for raw_candidate in candidates:
        candidate = dict(raw_candidate)
        node_id = _as_positive_int(
            candidate.get("measurement_node_id")
        )
        profile_id = _as_positive_int(
            candidate.get("hardware_profile_id")
        )
        if node_id is None or profile_id is None:
            continue

        by_id[node_id] = candidate

        if not _is_hard_compatible(candidate, input_size):
            continue

        if not _is_available(
            candidate,
            now=now,
            stale_after_seconds=stale_after_seconds,
            allow_validation_only=allow_validation,
        ):
            continue

        eligible.append(candidate)

    has_started = repository.submission_has_started_execution(
        submission_id,
        conn,
    )

    if assigned_id is not None:
        assigned = by_id.get(assigned_id)
        assigned_is_eligible = bool(
            assigned is not None and assigned in eligible
        )

        if assigned_is_eligible:
            selected = assigned
        elif mode == PINNED or has_started:
            return None
        else:
            selected = min(
                eligible,
                key=lambda item: _rank_key(item, input_size),
                default=None,
            )
    else:
        # No inventar affinity para una Submission legacy que ya contiene
        # executions iniciadas sin measurement_node_id/hardware_profile_id.
        if has_started:
            return None

        if mode == PINNED:
            return None

        selected = min(
            eligible,
            key=lambda item: _rank_key(item, input_size),
            default=None,
        )

    if selected is None:
        return None

    selected_id = int(selected["measurement_node_id"])

    return {
        "measurement_node_id": selected_id,
        "hardware_profile_id": int(selected["hardware_profile_id"]),
        "node_key": selected.get("node_key"),
        "measurement_node_mode": mode,
        "within_recommended": (
            input_size <= int(selected["recommended_max_input"])
        ),
        "affinity_changed": (
            assigned_id != selected_id
            or submission.get("measurement_node_mode") is None
        ),
    }
