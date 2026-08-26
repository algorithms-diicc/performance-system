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
    protocol_id=None,
    status="QUEUED",
    conn=None,
    original_filename=None,
    note=None,
    is_pinned=False,
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
                    protocol_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    created_at,
                    status
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, %s
                )
                RETURNING
                    id,
                    user_id,
                    course_id,
                    protocol_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
                    created_at,
                    status;
                """,
                (
                    user_id,
                    course_id,
                    protocol_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
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
                    protocol_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
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
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
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


def update_submission_note(submission_id, note, conn=None):
    """
    Persiste una nota ya normalizada por la capa de servicio/dominio.

    Este helper no aplica autorización ni decide el contrato del contenido.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET note = %s
                WHERE id = %s
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
                    created_at,
                    status;
                """,
                (note, submission_id),
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

    finally:
        if owns_connection:
            db.close()


def set_submission_pinned(submission_id, is_pinned, conn=None):
    """Marca o desmarca una submission; la autorización vive fuera del repository."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET is_pinned = %s
                WHERE id = %s
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
                    created_at,
                    status;
                """,
                (is_pinned, submission_id),
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

    finally:
        if owns_connection:
            db.close()


def update_submission_metadata(submission_id, note, is_pinned, conn=None):
    """
    Actualiza note e is_pinned juntos en una sola sentencia.

    Los valores deben llegar validados y normalizados desde la capa de ruta o
    servicio. Este helper no aplica autorización.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET note = %s,
                    is_pinned = %s
                WHERE id = %s
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    language,
                    file_path,
                    original_filename,
                    code_hash,
                    note,
                    is_pinned,
                    archived_at,
                    created_at,
                    status;
                """,
                (note, is_pinned, submission_id),
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

    finally:
        if owns_connection:
            db.close()


def set_submission_archived(submission_id, archived, conn=None):
    """Actualiza únicamente el archivado reversible de una submission."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE submissions
                SET archived_at = CASE
                      WHEN %s THEN COALESCE(archived_at, CURRENT_TIMESTAMP)
                      ELSE NULL
                    END
                WHERE id = %s
                RETURNING
                    id, user_id, course_id, title, language, file_path,
                    original_filename, code_hash, note, is_pinned,
                    archived_at, created_at, status;
                """,
                (archived, submission_id),
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
    finally:
        if owns_connection:
            db.close()
