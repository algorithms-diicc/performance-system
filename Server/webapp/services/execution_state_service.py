"""
CORE-04A-3 — Máquina de estados de executions.

Este servicio es la única capa que debe decidir qué transición es válida.
El repository sólo ejecuta SQL atómico.
"""

from ..repositories import execution_repository
from . import notification_service


QUEUED = "QUEUED"
RUNNING = "RUNNING"
PROCESSING = "PROCESSING"
COMPLETED = "COMPLETED"
FAILED = "FAILED"
CANCELLED = "CANCELLED"

TERMINAL_STATES = frozenset({COMPLETED, FAILED, CANCELLED})

ALLOWED_TRANSITIONS = {
    QUEUED: frozenset({RUNNING, FAILED, CANCELLED}),
    RUNNING: frozenset({PROCESSING, FAILED, CANCELLED}),
    PROCESSING: frozenset({COMPLETED, FAILED}),
    COMPLETED: frozenset(),
    FAILED: frozenset(),
    CANCELLED: frozenset(),
}

FAILURE_STAGES = frozenset({
    "VALIDATION",
    "COMPILATION",
    "EXECUTION",
    "MEASUREMENT",
    "PROCESSING",
    "INFRASTRUCTURE",
})


class ExecutionStateError(Exception):
    """Error base de la máquina de estados."""


class InvalidExecutionTransition(ExecutionStateError):
    """La transición solicitada no forma parte del state machine."""


class InvalidFailureMetadata(ExecutionStateError):
    """Los metadatos de un FAILED son incompletos o inválidos."""


class InvalidCompletionMetadata(ExecutionStateError):
    """COMPLETED no tiene un artefacto de resultados válido."""


def allowed_targets(current_state):
    """Estados alcanzables directamente desde current_state."""
    return ALLOWED_TRANSITIONS.get(current_state, frozenset())


def can_transition(current_state, new_state):
    """Retorna True sólo para una transición directa permitida."""
    return new_state in allowed_targets(current_state)


def _validate_transition(current_state, new_state):
    if current_state not in ALLOWED_TRANSITIONS:
        raise InvalidExecutionTransition(
            "Unknown current execution state: {}".format(current_state)
        )

    if new_state not in ALLOWED_TRANSITIONS:
        raise InvalidExecutionTransition(
            "Unknown target execution state: {}".format(new_state)
        )

    if not can_transition(current_state, new_state):
        raise InvalidExecutionTransition(
            "Transition {} -> {} is not allowed.".format(
                current_state,
                new_state,
            )
        )


def _validate_metadata(
    new_state,
    failure_stage,
    error_code,
    error_message,
    result_available,
    result_path,
):
    if new_state == FAILED:
        if failure_stage not in FAILURE_STAGES:
            raise InvalidFailureMetadata(
                "FAILED requires failure_stage in {}.".format(
                    sorted(FAILURE_STAGES)
                )
            )

        if not error_code or not str(error_code).strip():
            raise InvalidFailureMetadata(
                "FAILED requires a non-empty error_code."
            )

        if result_available not in (None, False):
            raise InvalidFailureMetadata(
                "FAILED cannot expose result_available=True."
            )

        return

    # Sólo FAILED puede transportar información de fallo.
    if any(value is not None for value in (
        failure_stage,
        error_code,
        error_message,
    )):
        raise InvalidFailureMetadata(
            "Failure metadata is only valid when transitioning to FAILED."
        )

    if new_state == COMPLETED:
        # Para ejecuciones NUEVAS el service exige un artefacto recuperable.
        # La BD es más flexible sólo para poder conservar registros legacy.
        if result_available is not True:
            raise InvalidCompletionMetadata(
                "COMPLETED requires result_available=True."
            )

        if not result_path or not str(result_path).strip():
            raise InvalidCompletionMetadata(
                "COMPLETED requires a non-empty result_path."
            )
    else:
        if result_available is not None or result_path is not None:
            raise InvalidCompletionMetadata(
                "Result metadata is only written when transitioning to COMPLETED."
            )


def transition_execution(
    public_id,
    new_state,
    failure_stage=None,
    error_code=None,
    error_message=None,
    result_available=None,
    result_path=None,
    conn=None,
    repository=execution_repository,
):
    """
    Valida y ejecuta una transición.

    Flujo:
      1. leer estado + state_version;
      2. validar state machine;
      3. validar metadatos;
      4. UPDATE atómico condicionado por estado+versión.

    Si otro proceso actualiza la fila entre 1 y 4, el repository lanza
    ConcurrentExecutionUpdate.
    """
    current = repository.get_execution(
        public_id,
        conn=conn,
    )

    current_state = current["execution_state"]
    current_version = current["state_version"]

    _validate_transition(current_state, new_state)
    _validate_metadata(
        new_state,
        failure_stage,
        error_code,
        error_message,
        result_available,
        result_path,
    )

    # Todo FAILED queda explícitamente sin resultados publicables.
    if new_state == FAILED:
        result_available = False

    row = repository.transition_execution(
        public_id=public_id,
        expected_state=current_state,
        expected_version=current_version,
        new_state=new_state,
        failure_stage=failure_stage,
        error_code=error_code,
        error_message=error_message,
        result_available=result_available,
        result_path=result_path,
        conn=conn,
    )

    if (
        new_state == FAILED
        and repository is execution_repository
    ):
        try:
            notification_service.notify_execution_failed(
                row,
                conn=conn,
            )
        except Exception as exc:
            # La bandeja interna es secundaria: nunca debe convertir una
            # transición FAILED válida en un fallo del pipeline.
            print(
                "[NOTIFICATION] No se pudo registrar FAILED {}: {}".format(
                    public_id,
                    exc,
                )
            )

    return row


def mark_running(public_id, conn=None, repository=execution_repository):
    return transition_execution(
        public_id,
        RUNNING,
        conn=conn,
        repository=repository,
    )


def mark_processing(public_id, conn=None, repository=execution_repository):
    return transition_execution(
        public_id,
        PROCESSING,
        conn=conn,
        repository=repository,
    )


def mark_completed(
    public_id,
    result_path,
    conn=None,
    repository=execution_repository,
):
    return transition_execution(
        public_id,
        COMPLETED,
        result_available=True,
        result_path=result_path,
        conn=conn,
        repository=repository,
    )


def mark_failed(
    public_id,
    failure_stage,
    error_code,
    error_message=None,
    conn=None,
    repository=execution_repository,
):
    return transition_execution(
        public_id,
        FAILED,
        failure_stage=failure_stage,
        error_code=error_code,
        error_message=error_message,
        conn=conn,
        repository=repository,
    )


def mark_cancelled(public_id, conn=None, repository=execution_repository):
    return transition_execution(
        public_id,
        CANCELLED,
        conn=conn,
        repository=repository,
    )
