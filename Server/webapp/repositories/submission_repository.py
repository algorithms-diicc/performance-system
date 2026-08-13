"""
CORE-04B-1 — Repository de submissions.

Este módulo centraliza las escrituras/lecturas mínimas necesarias para crear
una submission persistente antes de encolar sus executions.
"""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


class SubmissionRepositoryError(Exception):
    """Error base del repository de submissions."""


class SubmissionNotFound(SubmissionRepositoryError):
    """La submission solicitada no existe."""


def create_submission(
    user_id,
    title,
    language,
    file_path,
    code_hash,
    course_id=None,
    status="QUEUED",
    conn=None,
):
    """
    Crea una submission.

    Si `conn` es suministrada, la transacción queda bajo control del llamador.
    Si no, este repository abre/commit/cierra su propia conexión.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO submissions (
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    code_hash,
                    created_at,
                    status
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s
                )
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    code_hash,
                    created_at,
                    status;
                """,
                (
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    code_hash,
                    status,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def get_submission(submission_id, conn=None):
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    code_hash,
                    created_at,
                    status
                FROM submissions
                WHERE id = %s;
                """,
                (submission_id,),
            )
            row = cur.fetchone()

        if row is None:
            raise SubmissionNotFound(
                "Submission id={} was not found.".format(submission_id)
            )

        return dict(row)

    finally:
        if owns_connection:
            db.close()


def update_submission_status(submission_id, status, conn=None):
    """Actualiza el status legacy de una submission."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET status = %s
                WHERE id = %s
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    code_hash,
                    created_at,
                    status;
                """,
                (status, submission_id),
            )
            row = cur.fetchone()

        if row is None:
            raise SubmissionNotFound(
                "Submission id={} was not found.".format(submission_id)
            )

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise