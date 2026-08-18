"""Lectura persistida acotada para manifest y exportaciones reproducibles."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


def get_execution_export_row_by_codename(codename, conn=None):
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
                    e.benchmark,
                    e.input_size,
                    e.samples,
                    e.execution_profile,
                    e.execution_config,
                    e.execution_config ->> 'original_filename'
                        AS source_filename,
                    e.execution_config ->> 'source_index' AS source_index,
                    e.hardware_snapshot,
                    e.created_at,
                    e.started_at,
                    e.finished_at,
                    e.result_available,
                    e.result_path,
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
