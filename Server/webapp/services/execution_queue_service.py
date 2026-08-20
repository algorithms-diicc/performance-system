"""
Iteración 9 — claim persistente de la cola de executions.

PostgreSQL es la fuente de verdad del orden de despacho. Este servicio no
ejecuta benchmarks: únicamente reclama de forma atómica la siguiente ejecución
QUEUED y reutiliza la máquina de estados existente para pasarla a RUNNING.
"""

from ...db_connection import get_connection
from ..repositories import execution_repository
from . import execution_state_service


def claim_next_queued_execution(
    conn=None,
    repository=execution_repository,
    state_service=execution_state_service,
):
    """
    Reclama la siguiente execution FIFO dentro de una única transacción.

    Flujo:
    1. SELECT de la execution QUEUED más antigua con
       FOR UPDATE SKIP LOCKED.
    2. QUEUED -> RUNNING mediante execution_state_service.
    3. COMMIT del claim si esta función administra la conexión.

    Retorna None cuando no existe trabajo pendiente.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        candidates = repository.list_queued_executions(
            limit=1,
            conn=db,
            for_update=True,
            skip_locked=True,
        )

        if not candidates:
            if owns_connection:
                db.commit()
            return None

        candidate = candidates[0]

        claimed = state_service.mark_running(
            candidate["public_id"],
            conn=db,
            repository=repository,
        )

        if owns_connection:
            db.commit()

        return claimed

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()
