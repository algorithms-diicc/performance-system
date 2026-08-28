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
