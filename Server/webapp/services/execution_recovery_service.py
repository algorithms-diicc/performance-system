"""
CORE-04F-1B — Detección y recuperación de executions stale.

El heartbeat actual representa la vida del coordinador de ejecución en el
proceso web/master. La pérdida real del slave sigue protegida por los timeouts
y errores Master/Slave existentes.

Este módulo no inicia threads ni procesos al importarse.
"""

from datetime import datetime, timedelta

from ..repositories import execution_repository


ACTIVE_STATES = frozenset({"RUNNING", "PROCESSING"})
RECOVERABLE_STATES = frozenset({"QUEUED", "RUNNING", "PROCESSING"})

RECOVERY_FAILURES = {
    "QUEUED": (
        "INFRASTRUCTURE",
        "QUEUE_STALE",
        "La ejecución permaneció en cola más allá del umbral permitido.",
    ),
    "RUNNING": (
        "INFRASTRUCTURE",
        "COORDINATOR_HEARTBEAT_LOST",
        "Se perdió el heartbeat del coordinador mientras la ejecución estaba activa.",
    ),
    "PROCESSING": (
        "INFRASTRUCTURE",
        "PROCESSING_HEARTBEAT_LOST",
        "Se perdió el heartbeat del coordinador durante el procesamiento de resultados.",
    ),
}


def _cutoffs(now, active_stale_seconds, queued_stale_seconds):
    if active_stale_seconds <= 0:
        raise ValueError("active_stale_seconds debe ser > 0.")
    if queued_stale_seconds <= 0:
        raise ValueError("queued_stale_seconds debe ser > 0.")

    return (
        now - timedelta(seconds=active_stale_seconds),
        now - timedelta(seconds=queued_stale_seconds),
    )


def scan_stale_executions(
    now=None,
    active_stale_seconds=90,
    queued_stale_seconds=1800,
    repository=execution_repository,
):
    now = now or datetime.now()
    active_before, queued_before = _cutoffs(
        now,
        active_stale_seconds,
        queued_stale_seconds,
    )
    return repository.list_stale_executions(
        active_before=active_before,
        queued_before=queued_before,
    )


def recovery_descriptor(state):
    if state not in RECOVERY_FAILURES:
        raise ValueError(
            "Estado no recuperable: {!r}".format(state)
        )
    stage, code, message = RECOVERY_FAILURES[state]
    return {
        "failure_stage": stage,
        "error_code": code,
        "error_message": message,
    }


def recover_stale_executions(
    now=None,
    active_stale_seconds=90,
    queued_stale_seconds=1800,
    dry_run=True,
    repository=execution_repository,
):
    now = now or datetime.now()
    active_before, queued_before = _cutoffs(
        now,
        active_stale_seconds,
        queued_stale_seconds,
    )

    candidates = repository.list_stale_executions(
        active_before=active_before,
        queued_before=queued_before,
    )

    result = {
        "dry_run": bool(dry_run),
        "candidates": [],
        "recovered": [],
        "skipped_race": [],
    }

    for row in candidates:
        state = row["execution_state"]
        descriptor = recovery_descriptor(state)

        item = {
            "id": row["id"],
            "public_id": row["public_id"],
            "codename": row.get("codename"),
            "state": state,
            "state_version": row["state_version"],
            "last_activity_at": row.get("last_activity_at"),
            **descriptor,
        }
        result["candidates"].append(item)

        if dry_run:
            continue

        cutoff = (
            queued_before
            if state == "QUEUED"
            else active_before
        )

        updated = repository.fail_execution_if_stale(
            public_id=row["public_id"],
            expected_state=state,
            expected_version=row["state_version"],
            stale_before=cutoff,
            failure_stage=descriptor["failure_stage"],
            error_code=descriptor["error_code"],
            error_message=descriptor["error_message"],
        )

        if updated:
            result["recovered"].append(updated)
        else:
            # Hubo transición, state_version nuevo o heartbeat posterior al scan.
            result["skipped_race"].append(item)

    return result
