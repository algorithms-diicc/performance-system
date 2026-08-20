"""
CORE-04F-1A — Orquestación persistente worker + heartbeat.

Responsabilidades:
- Mantener las transiciones del worker delegadas en execution_state_service.
- Mantener un heartbeat periódico mientras la ejecución está RUNNING/PROCESSING.
- Detener el heartbeat al llegar a un estado terminal.
"""

import os
import threading

from . import execution_state_service
from ..repositories import execution_repository


class PersistentExecutionMissing(Exception):
    pass


class UnexpectedWorkerOutcome(Exception):
    pass


HEARTBEAT_INTERVAL_SECONDS = max(
    1,
    int(os.getenv("EXECUTION_HEARTBEAT_SECONDS", "10")),
)

_heartbeat_lock = threading.Lock()
_heartbeat_leases = {}


def get_execution_context(codename, repository=execution_repository):
    row = repository.get_execution_by_codename(codename)
    if not row:
        raise PersistentExecutionMissing(
            "No persistent execution for codename={!r}".format(codename)
        )
    return row


def _heartbeat_loop(
    codename,
    public_id,
    stop_event,
    repository,
    interval_seconds,
):
    """
    Renueva last_heartbeat_at hasta que:
    - se solicite stop;
    - la ejecución deje RUNNING/PROCESSING;
    - el registro desaparezca.

    Un error de heartbeat no cambia por sí mismo el estado. La recuperación
    de stale executions es responsabilidad de execution_recovery_service.
    """
    while not stop_event.wait(interval_seconds):
        try:
            repository.touch_heartbeat(public_id)
        except Exception:
            # Si ya es terminal, desapareció o PostgreSQL está temporalmente
            # inaccesible, dejamos de renovar. El recovery decide posteriormente.
            break

    with _heartbeat_lock:
        lease = _heartbeat_leases.get(codename)
        if lease and lease["stop_event"] is stop_event:
            _heartbeat_leases.pop(codename, None)


def start_heartbeat_lease(
    codename,
    public_id,
    repository=execution_repository,
    interval_seconds=None,
):
    """
    Inicia como máximo un heartbeat thread por codename en este proceso.
    """
    interval = (
        HEARTBEAT_INTERVAL_SECONDS
        if interval_seconds is None
        else max(1, int(interval_seconds))
    )

    with _heartbeat_lock:
        existing = _heartbeat_leases.get(codename)
        if existing:
            return False

        stop_event = threading.Event()
        thread = threading.Thread(
            target=_heartbeat_loop,
            args=(
                codename,
                public_id,
                stop_event,
                repository,
                interval,
            ),
            name="execution-heartbeat-{}".format(codename),
            daemon=True,
        )
        _heartbeat_leases[codename] = {
            "public_id": str(public_id),
            "stop_event": stop_event,
            "thread": thread,
        }
        thread.start()

    return True


def stop_heartbeat_lease(codename):
    """
    Solicita detener el heartbeat del codename.
    """
    with _heartbeat_lock:
        lease = _heartbeat_leases.pop(codename, None)

    if not lease:
        return False

    lease["stop_event"].set()
    return True


def active_heartbeat_codenames():
    with _heartbeat_lock:
        return tuple(sorted(_heartbeat_leases.keys()))


def mark_worker_started(
    codename,
    repository=execution_repository,
    state_service=execution_state_service,
):
    execution = get_execution_context(codename, repository=repository)
    row = state_service.mark_running(execution["public_id"])

    # El primer heartbeat se escribe inmediatamente para no depender del
    # primer tick del thread.
    repository.touch_heartbeat(execution["public_id"])
    start_heartbeat_lease(
        codename,
        execution["public_id"],
        repository=repository,
    )
    return row


def activate_claimed_execution(
    codename,
    public_id,
    repository=execution_repository,
):
    """
    Activa heartbeat para una execution ya reclamada como RUNNING.

    El dispatcher persistente hace QUEUED -> RUNNING dentro del claim
    transaccional. Por eso aquí no se repite la transición de estado.
    """
    execution = get_execution_context(
        codename,
        repository=repository,
    )

    if str(execution.get("public_id")) != str(public_id):
        raise UnexpectedWorkerOutcome(
            "Claim public_id does not match codename={!r}.".format(
                codename
            )
        )

    if execution.get("execution_state") != "RUNNING":
        raise UnexpectedWorkerOutcome(
            "Claimed execution must already be RUNNING; current state={!r}."
            .format(execution.get("execution_state"))
        )

    repository.touch_heartbeat(public_id)
    start_heartbeat_lease(
        codename,
        public_id,
        repository=repository,
    )
    return execution


def persist_worker_outcome(
    codename,
    outcome,
    repository=execution_repository,
    state_service=execution_state_service,
):
    execution = get_execution_context(codename, repository=repository)
    public_id = execution["public_id"]

    if outcome.kind == "SUCCESS":
        # RUNNING -> PROCESSING. El lease continúa durante graph/data processing.
        return state_service.mark_processing(public_id)

    if outcome.kind == "FAILED":
        failure = outcome.failure
        if failure is None:
            raise UnexpectedWorkerOutcome(
                "FAILED outcome without failure metadata."
            )

        try:
            return state_service.mark_failed(
                public_id,
                failure_stage=failure.failure_stage,
                error_code=failure.error_code,
                error_message=failure.message,
            )
        finally:
            stop_heartbeat_lease(codename)

    raise UnexpectedWorkerOutcome(
        "Cannot persist worker outcome kind={!r}.".format(outcome.kind)
    )


def mark_worker_failed(
    codename,
    failure_stage,
    error_code,
    error_message,
    repository=execution_repository,
    state_service=execution_state_service,
):
    execution = get_execution_context(codename, repository=repository)
    try:
        return state_service.mark_failed(
            execution["public_id"],
            failure_stage=failure_stage,
            error_code=error_code,
            error_message=error_message,
        )
    finally:
        stop_heartbeat_lease(codename)


def mark_processing_failed(
    codename,
    error_code,
    error_message,
    repository=execution_repository,
    state_service=execution_state_service,
):
    return mark_worker_failed(
        codename,
        failure_stage="PROCESSING",
        error_code=error_code,
        error_message=error_message,
        repository=repository,
        state_service=state_service,
    )


def mark_worker_completed(
    codename,
    result_path,
    repository=execution_repository,
    state_service=execution_state_service,
):
    execution = get_execution_context(codename, repository=repository)
    try:
        return state_service.mark_completed(
            execution["public_id"],
            result_path=result_path,
        )
    finally:
        stop_heartbeat_lease(codename)
