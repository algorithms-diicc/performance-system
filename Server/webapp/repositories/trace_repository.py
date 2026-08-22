"""Lecturas acotadas para la procedencia histórica de fuentes."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


def get_execution_provenance_by_codename(codename, conn=None):
    """Obtiene la referencia persistida necesaria para una Execution."""
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
                    e.execution_config ->> 'original_filename'
                        AS source_filename,
                    e.execution_config ->> 'source_index' AS source_index,
                    e.execution_config AS execution_config,
                    e.execution_config ->> 'source_contract_version'
                        AS source_contract_version,
                    e.execution_config ->> 'source_language'
                        AS source_language,
                    e.execution_config ->> 'compiler' AS compiler,
                    e.execution_config ->> 'compiler_flags'
                        AS compiler_flags,
                    s.id AS submission_id,
                    s.title AS submission_title,
                    s.file_path AS archive_file_path,
                    s.original_filename AS archive_original_filename,
                    s.code_hash AS archive_sha256
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
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


def list_submission_sources(submission_id, conn=None):
    """Lista Executions hermanas sin exponer sus configuraciones completas."""
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
                    e.execution_config ->> 'original_filename'
                        AS source_filename,
                    e.execution_config ->> 'source_index' AS source_index,
                    e.execution_config AS execution_config,
                    e.execution_config ->> 'source_contract_version'
                        AS source_contract_version,
                    e.execution_config ->> 'source_language'
                        AS source_language,
                    e.execution_config ->> 'compiler' AS compiler,
                    e.execution_config ->> 'compiler_flags'
                        AS compiler_flags
                FROM executions e
                WHERE e.submission_id = %s
                ORDER BY e.id ASC;
                """,
                (submission_id,),
            )
            rows = cur.fetchall()

        return [dict(row) for row in rows]
    finally:
        if owns_connection:
            db.close()


def get_submission_archive_by_id(submission_id, conn=None):
    """Obtiene la referencia interna del ZIP luego de autorizar al owner."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    s.id AS submission_id,
                    s.user_id AS owner_user_id,
                    s.title AS submission_title,
                    s.file_path AS archive_file_path,
                    s.original_filename AS archive_original_filename,
                    s.code_hash AS archive_sha256
                FROM submissions s
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


def list_submission_repeat_configurations(submission_id, conn=None):
    """Carga la configuración común necesaria para repetir un Experimento."""
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
                WHERE e.submission_id = %s
                ORDER BY e.id ASC;
                """,
                (submission_id,),
            )
            rows = cur.fetchall()

        return [dict(row) for row in rows]
    finally:
        if owns_connection:
            db.close()
