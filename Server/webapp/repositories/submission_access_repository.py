from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


def get_submission_access_row_by_id(submission_id, conn=None):
    """Recupera únicamente los datos necesarios para decidir acceso."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    s.id AS submission_id,
                    s.user_id AS owner_user_id,
                    s.course_id,
                    c.teacher_user_id AS course_teacher_user_id
                FROM submissions s
                LEFT JOIN courses c ON c.id = s.course_id
                WHERE s.id = %s
                LIMIT 1;
                """,
                (submission_id,),
            )
            row = cur.fetchone()

        return dict(row) if row is not None else None
    finally:
        if owns_connection:
            db.close()
