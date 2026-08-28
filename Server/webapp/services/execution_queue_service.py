"""
Gate 7B — claim persistente con selección serial de MeasurementNode.

PostgreSQL continúa siendo la fuente de verdad del orden de despacho. El claim
reclama la siguiente Execution FIFO, resuelve/persiste affinity + provenance y
sólo entonces reutiliza la máquina de estados para QUEUED -> RUNNING.
"""

from ...db_connection import get_connection
from ..repositories import execution_repository
from ..repositories import measurement_node_assignment_repository
from . import execution_state_service
from .measurement_node_selector_service import select_measurement_node


def claim_next_queued_execution(
    conn=None,
    repository=execution_repository,
    state_service=execution_state_service,
    assignment_repository=measurement_node_assignment_repository,
    selector_func=select_measurement_node,
):
    """
    Reclama la siguiente execution FIFO dentro de una única transacción.

    Flujo:
    1. bloquear la Execution QUEUED más antigua con FOR UPDATE SKIP LOCKED;
    2. bloquear su Submission;
    3. resolver AUTO/PINNED y affinity contra nodos/policies disponibles;
    4. si no hay nodo elegible, conservar la Execution en QUEUED;
    5. persistir affinity de Submission y provenance de Execution;
    6. recién entonces ejecutar QUEUED -> RUNNING;
    7. commit del claim si esta función administra la conexión.

    Retorna None cuando no existe trabajo pendiente o cuando el head FIFO debe
    esperar por un nodo compatible/disponible.

    Repositories inyectados por tests legacy pueden devolver candidatos mínimos
    sin submission_id. Ese seam conserva el claim histórico sólo fuera del
    repository productivo; un candidato real sin submission_id es un error de
    integridad y nunca omite la selección de nodo.
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
        selection = None
        submission_id = candidate.get("submission_id")

        if submission_id is None:
            if repository is execution_repository:
                raise RuntimeError(
                    "Queued execution is missing submission_id during "
                    "measurement-node assignment."
                )
        else:
            submission = assignment_repository.get_submission_for_update(
                submission_id,
                conn=db,
            )

            selection = selector_func(
                candidate,
                submission,
                conn=db,
                repository=assignment_repository,
            )

            if selection is None:
                if owns_connection:
                    db.commit()
                return None

            node_key = str(
                selection.get("node_key") or ""
            ).strip().lower()
            if not node_key:
                raise RuntimeError(
                    "Selected measurement node is missing node_key."
                )

            if selection.get("affinity_changed"):
                assignment_repository.set_submission_assignment(
                    submission["id"],
                    selection["measurement_node_id"],
                    selection["measurement_node_mode"],
                    conn=db,
                )

            assignment_repository.set_execution_provenance(
                candidate["public_id"],
                selection["measurement_node_id"],
                selection["hardware_profile_id"],
                conn=db,
            )

        claimed = state_service.mark_running(
            candidate["public_id"],
            conn=db,
            repository=repository,
        )

        if selection is not None:
            # El transition repository todavía no devuelve measurement_node_id;
            # el claim sí debe entregar la provenance que acaba de persistir.
            claimed = dict(claimed)
            claimed["measurement_node_id"] = selection[
                "measurement_node_id"
            ]
            claimed["hardware_profile_id"] = selection[
                "hardware_profile_id"
            ]
            claimed["measurement_node_key"] = node_key

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
