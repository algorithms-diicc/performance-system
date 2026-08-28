"""Acceso persistente a los nodos físicos de medición."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


def get_measurement_node_by_key(node_key, conn=None):
    """Obtiene un MeasurementNode concreto por su node_key estable."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    mn.id,
                    mn.node_key,
                    mn.display_name,
                    mn.hardware_profile_id,
                    mn.institutional_priority,
                    mn.is_enabled,
                    mn.is_validation_only,
                    mn.is_draining,
                    mn.last_heartbeat_at,
                    mn.created_at,
                    mn.updated_at,
                    hp.profile_key AS hardware_profile_key,
                    hp.name AS hardware_profile_name,
                    hp.is_active AS hardware_profile_is_active
                FROM measurement_nodes mn
                JOIN hardware_profiles hp
                  ON hp.id = mn.hardware_profile_id
                WHERE mn.node_key = %s
                LIMIT 1;
                """,
                (node_key,),
            )
            row = cur.fetchone()

        return dict(row) if row is not None else None

    finally:
        if owns_connection:
            db.close()


def list_measurement_nodes(conn=None):
    """
    Lista los nodos registrados.

    No deriva todavía AVAILABLE/OFFLINE/DRAINING: esa lógica operacional
    pertenece al servicio de liveness de Gate 6.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    mn.id,
                    mn.node_key,
                    mn.display_name,
                    mn.hardware_profile_id,
                    mn.institutional_priority,
                    mn.is_enabled,
                    mn.is_validation_only,
                    mn.is_draining,
                    mn.last_heartbeat_at,
                    mn.created_at,
                    mn.updated_at,
                    hp.profile_key AS hardware_profile_key,
                    hp.name AS hardware_profile_name,
                    hp.is_active AS hardware_profile_is_active
                FROM measurement_nodes mn
                JOIN hardware_profiles hp
                  ON hp.id = mn.hardware_profile_id
                ORDER BY
                    mn.institutional_priority DESC,
                    mn.id ASC;
                """,
            )
            rows = cur.fetchall()

        return [dict(row) for row in rows]

    finally:
        if owns_connection:
            db.close()

def upsert_measurement_node(
    node_key,
    display_name,
    hardware_profile_id,
    institutional_priority=0,
    is_enabled=False,
    is_validation_only=False,
    is_draining=False,
    conn=None,
):
    """
    Crea o actualiza un MeasurementNode por su identidad estable node_key.

    El heartbeat no se modifica durante el upsert: representa liveness
    observado, no configuración administrativa.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO measurement_nodes (
                    node_key,
                    display_name,
                    hardware_profile_id,
                    institutional_priority,
                    is_enabled,
                    is_validation_only,
                    is_draining,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (node_key)
                DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    hardware_profile_id =
                        EXCLUDED.hardware_profile_id,
                    institutional_priority =
                        EXCLUDED.institutional_priority,
                    is_enabled = EXCLUDED.is_enabled,
                    is_validation_only =
                        EXCLUDED.is_validation_only,
                    is_draining = EXCLUDED.is_draining,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING
                    id,
                    node_key,
                    display_name,
                    hardware_profile_id,
                    institutional_priority,
                    is_enabled,
                    is_validation_only,
                    is_draining,
                    last_heartbeat_at,
                    created_at,
                    updated_at;
                """,
                (
                    node_key,
                    display_name,
                    hardware_profile_id,
                    institutional_priority,
                    is_enabled,
                    is_validation_only,
                    is_draining,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return dict(row) if row is not None else None

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def touch_measurement_node_heartbeat(
    node_key,
    conn=None,
):
    """
    Registra liveness observado para un MeasurementNode existente.

    No habilita el nodo ni modifica draining/priority/profile.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE measurement_nodes
                SET
                    last_heartbeat_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE node_key = %s
                RETURNING
                    id,
                    node_key,
                    last_heartbeat_at,
                    updated_at;
                """,
                (node_key,),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return dict(row) if row is not None else None

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()
