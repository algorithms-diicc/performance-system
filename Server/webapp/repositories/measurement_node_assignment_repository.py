"""Persistencia transaccional para selección y afinidad de MeasurementNode."""

from psycopg2.extras import RealDictCursor


class MeasurementNodeAssignmentError(Exception):
    """La asignación de nodo no pudo persistirse de forma segura."""


def get_submission_for_update(submission_id, conn):
    """Carga y bloquea la Submission que define la afinidad del experimento."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                id,
                assigned_measurement_node_id,
                measurement_node_mode
            FROM submissions
            WHERE id = %s
            FOR UPDATE;
            """,
            (submission_id,),
        )
        row = cur.fetchone()

    if row is None:
        raise MeasurementNodeAssignmentError(
            "Submission id={} was not found during node assignment.".format(
                submission_id
            )
        )

    return dict(row)


def submission_has_started_execution(submission_id, conn):
    """
    Indica si la Submission ya cruzó la frontera conservadora de RUNNING.

    `started_at` se escribe al hacer QUEUED -> RUNNING. El selector usa esta
    evidencia para impedir migraciones silenciosas de hardware una vez que el
    experimento comenzó a ejecutarse.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM executions
                WHERE submission_id = %s
                  AND started_at IS NOT NULL
            ) AS has_started;
            """,
            (submission_id,),
        )
        row = cur.fetchone()

    return bool(row and row.get("has_started"))


def list_policy_candidates(
    benchmark,
    execution_profile,
    conn,
):
    """
    Lista nodos con HardwareProfile y policy activos para la combinación dada.

    La consulta no decide liveness ni ranking. Los MeasurementNode observados se
    bloquean hasta completar el claim para que configuración/heartbeat y
    asignación pertenezcan a una única decisión transaccional breve.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                mn.id AS measurement_node_id,
                mn.node_key,
                mn.hardware_profile_id,
                mn.institutional_priority,
                mn.is_enabled,
                mn.is_validation_only,
                mn.is_draining,
                mn.last_heartbeat_at,
                hp.profile_key AS hardware_profile_key,
                hp.is_active AS hardware_profile_is_active,
                p.id AS policy_id,
                p.minimum_input,
                p.default_input,
                p.recommended_max_input,
                p.hard_max_input,
                p.input_step,
                p.operational_timeout_seconds
            FROM measurement_nodes mn
            JOIN hardware_profiles hp
              ON hp.id = mn.hardware_profile_id
            JOIN hardware_profile_policies p
              ON p.hardware_profile_id = hp.id
            WHERE hp.is_active = TRUE
              AND p.is_active = TRUE
              AND p.benchmark = %s
              AND p.execution_profile = %s
            ORDER BY mn.id ASC
            FOR UPDATE OF mn;
            """,
            (benchmark, execution_profile),
        )
        rows = cur.fetchall()

    return [dict(row) for row in rows]


def set_submission_assignment(
    submission_id,
    measurement_node_id,
    measurement_node_mode,
    conn,
):
    """Persiste mode + affinity sin hacer commit fuera del claim."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE submissions
            SET
                assigned_measurement_node_id = %s,
                measurement_node_mode = %s
            WHERE id = %s
            RETURNING
                id,
                assigned_measurement_node_id,
                measurement_node_mode;
            """,
            (
                measurement_node_id,
                measurement_node_mode,
                submission_id,
            ),
        )
        row = cur.fetchone()

    if row is None:
        raise MeasurementNodeAssignmentError(
            "Submission id={} disappeared during node assignment.".format(
                submission_id
            )
        )

    return dict(row)


def set_execution_provenance(
    public_id,
    measurement_node_id,
    hardware_profile_id,
    conn,
):
    """Asigna procedencia únicamente mientras la Execution sigue QUEUED."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE executions
            SET
                measurement_node_id = %s,
                hardware_profile_id = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE public_id = %s::uuid
              AND execution_state = 'QUEUED'
            RETURNING
                id,
                public_id::text AS public_id,
                submission_id,
                measurement_node_id,
                hardware_profile_id,
                execution_state,
                state_version;
            """,
            (
                measurement_node_id,
                hardware_profile_id,
                str(public_id),
            ),
        )
        row = cur.fetchone()

    if row is None:
        raise MeasurementNodeAssignmentError(
            "Execution {} is no longer QUEUED during node assignment.".format(
                public_id
            )
        )

    return dict(row)
