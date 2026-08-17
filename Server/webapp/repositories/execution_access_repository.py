from psycopg2.extras import RealDictCursor
from ...db_connection import get_connection

def get_execution_access_row_by_codename(codename, conn=None):
    owns_connection = conn is None
    db = conn or get_connection()
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.id AS execution_id,
                    e.public_id::text AS public_id,
                    e.codename,
                    e.execution_state,
                    e.result_available,
                    e.result_path,
                    e.hardware_snapshot,
                    s.id AS submission_id,
                    s.user_id AS owner_user_id,
                    s.course_id,
                    c.teacher_user_id AS course_teacher_user_id
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
                LEFT JOIN courses c ON c.id = s.course_id
                WHERE e.codename = %s
                LIMIT 1;
                """,
                (codename,),
            )
            row = cur.fetchone()
        return dict(row) if row is not None else None
    finally:
        if owns_connection:
            db.close()
