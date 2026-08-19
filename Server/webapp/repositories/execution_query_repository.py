from psycopg2.extras import RealDictCursor
from ...db_connection import get_connection

def get_execution_snapshot_row(public_id, conn=None):
    owns_connection = conn is None
    db = conn or get_connection()
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.public_id::text AS public_id,
                    e.submission_id,
                    e.codename,
                    e.execution_state,
                    e.state_version,
                    e.failure_stage,
                    e.error_code,
                    e.error_message,
                    e.created_at,
                    e.queued_at,
                    e.started_at,
                    e.processing_at,
                    e.finished_at,
                    e.updated_at,
                    e.benchmark,
                    e.input_size,
                    e.samples,
                    e.execution_profile,
                    e.execution_config,
                    e.result_available,
                    e.result_path,
                    e.duration_ms,
                    s.user_id AS owner_user_id,
                    s.title AS submission_title,
                    hp.name AS hardware_profile_name
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
                LEFT JOIN hardware_profiles hp ON hp.id = e.hardware_profile_id
                WHERE e.public_id = %s::uuid
                LIMIT 1;
                """,
                (str(public_id),),
            )
            row = cur.fetchone()
        return dict(row) if row is not None else None
    finally:
        if owns_connection:
            db.close()


def get_execution_reuse_row(public_id, conn=None):
    """Carga solo la configuración necesaria para reutilizar una Execution."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.public_id::text AS public_id,
                    e.benchmark,
                    e.input_size,
                    e.samples,
                    e.execution_profile,
                    s.user_id AS owner_user_id,
                    CASE
                        WHEN s.course_id IS NOT NULL
                         AND c.is_active = TRUE
                         AND cm.is_active = TRUE
                        THEN s.course_id
                        ELSE NULL
                    END AS reusable_course_id
                FROM executions e
                JOIN submissions s
                  ON s.id = e.submission_id
                LEFT JOIN courses c
                  ON c.id = s.course_id
                LEFT JOIN course_memberships cm
                  ON cm.course_id = s.course_id
                 AND cm.user_id = s.user_id
                WHERE e.public_id = %s::uuid
                LIMIT 1;
                """,
                (str(public_id),),
            )
            row = cur.fetchone()

        return dict(row) if row is not None else None

    finally:
        if owns_connection:
            db.close()
