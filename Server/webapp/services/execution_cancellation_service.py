"""Cancelación pública y atómica de executions que siguen en cola."""

from ...db_connection import get_connection
from ..repositories import execution_repository
from . import execution_state_service


class ExecutionCancellationError(Exception):
    pass


class ExecutionCancellationNotFound(ExecutionCancellationError):
    pass


class ExecutionCancellationForbidden(ExecutionCancellationError):
    pass


class ExecutionCancellationConflict(ExecutionCancellationError):
    pass


def cancel_queued_execution(
    public_id,
    current_user_id,
    current_role_name=None,
    conn=None,
    repository=execution_repository,
    state_service=execution_state_service,
):
    """Aplica QUEUED -> CANCELLED bajo el mismo lock usado por la cola."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        current = repository.get_execution_cancellation_row(
            public_id,
            conn=db,
        )
        if current is None:
            raise ExecutionCancellationNotFound(
                "La ejecución solicitada no existe."
            )

        is_owner = int(current["owner_user_id"]) == int(current_user_id)
        is_admin = (
            str(current_role_name or "").strip().casefold() == "admin"
        )
        if not (is_owner or is_admin):
            raise ExecutionCancellationForbidden(
                "No tienes permiso para cancelar esta ejecución."
            )

        if current["execution_state"] != execution_state_service.QUEUED:
            raise ExecutionCancellationConflict(
                "La ejecución ya no está en cola y no puede cancelarse."
            )

        cancelled = state_service.mark_cancelled(
            public_id,
            conn=db,
            repository=repository,
        )

        if owns_connection:
            db.commit()

        return {
            "publicId": cancelled.get("public_id"),
            "state": cancelled.get("execution_state"),
            "stateVersion": int(cancelled.get("state_version") or 0),
            "terminal": True,
            "resultAvailable": bool(cancelled.get("result_available")),
            "canCancel": False,
        }

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()
