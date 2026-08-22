# server/webapp/routes/submissions_routes.py

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..repositories import submission_repository
from ..utils.db_utils import db_cursor
from ..utils.auth_decorators import get_user_role_name, login_required
from ..utils.api_errors import (
    APIError,
    handle_api_errors,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    BadRequestError,
)
from ..services.execution_history_service import (
    execution_status_filter_sql,
    map_execution_state_label,
    serialize_execution_history_row,
    summary_from_aggregate,
)
from ..services.submission_history_service import (
    build_submission_history_projection,
)
from ..services.submission_repeat_service import (
    SubmissionRepeatConfigurationInvalid,
    SubmissionRepeatForbidden,
    SubmissionRepeatNotFound,
    get_submission_repeat_for_user,
)
from ..services.source_provenance_service import SourceProvenanceError
from ..services.execution_creation_service import (
    InvalidExecutionRequest,
    normalize_submission_note,
    resolve_submission_course,
)
from ..services.submission_access_service import (
    SubmissionAccessForbidden,
    SubmissionAccessNotFound,
    assert_submission_viewer,
    is_submission_owner,
)

submissions_bp = Blueprint("submissions", __name__, url_prefix="/api")

MUTABLE_SUBMISSION_METADATA_FIELDS = frozenset({"note", "isPinned"})

HISTORY_STATUS_FILTERS = frozenset({
    "EMPTY",
    "IN_PROGRESS",
    "COMPLETED",
    "PARTIAL",
    "FAILED",
    "CANCELLED",
})

HISTORY_BENCHMARK_FILTERS = {
    "SIZE": ("SIZE",),
    "LCS": ("LCS",),
    "CAMM": ("CAMM", "CAMMR", "CAMMS", "CAMMSO"),
}

HISTORY_QUERY_MAX_LENGTH = 200


def _parse_submission_history_filters():
    raw_status = str(request.args.get("status") or "").strip().upper()
    raw_benchmark = str(
        request.args.get("benchmark") or ""
    ).strip().upper()
    raw_course = str(request.args.get("course_id") or "").strip()
    raw_reference = str(request.args.get("reference") or "").strip()
    query = str(request.args.get("q") or "").strip()

    if raw_status and raw_status not in HISTORY_STATUS_FILTERS:
        raise BadRequestError(
            "El parámetro 'status' no corresponde a un estado válido."
        )

    if (
        raw_benchmark
        and raw_benchmark not in HISTORY_BENCHMARK_FILTERS
    ):
        raise BadRequestError(
            "El parámetro 'benchmark' no corresponde a un benchmark válido."
        )

    course_mode = None
    course_id = None

    if raw_course:
        if raw_course.casefold() == "personal":
            course_mode = "personal"
        else:
            try:
                course_id = int(raw_course)
            except (TypeError, ValueError):
                raise BadRequestError(
                    "El parámetro 'course_id' debe ser un id positivo "
                    "o 'personal'."
                )

            if course_id <= 0:
                raise BadRequestError(
                    "El parámetro 'course_id' debe ser un id positivo "
                    "o 'personal'."
                )

            course_mode = "course"

    if len(query) > HISTORY_QUERY_MAX_LENGTH:
        raise BadRequestError(
            "El parámetro 'q' no puede superar 200 caracteres."
        )

    if raw_reference not in {"", "0", "1"}:
        raise BadRequestError(
            "El parámetro 'reference' debe ser '1' o '0'."
        )

    return {
        "status": raw_status or None,
        "benchmark": raw_benchmark or None,
        "courseMode": course_mode,
        "courseId": course_id,
        "referenceOnly": raw_reference == "1",
        "query": query or None,
    }


def _build_submission_history_cte(user_id, filters):
    where_parts = ["s.user_id = %s"]
    params = [user_id]

    course_mode = filters.get("courseMode")

    if course_mode == "personal":
        where_parts.append("s.course_id IS NULL")
    elif course_mode == "course":
        where_parts.append("s.course_id = %s")
        params.append(filters["courseId"])

    if filters.get("referenceOnly"):
        where_parts.append("s.is_pinned = TRUE")

    benchmark = filters.get("benchmark")
    if benchmark:
        benchmark_values = HISTORY_BENCHMARK_FILTERS[benchmark]
        placeholders = ", ".join(["%s"] * len(benchmark_values))

        where_parts.append(
            """
            EXISTS (
              SELECT 1
              FROM executions be
              WHERE be.submission_id = s.id
                AND UPPER(COALESCE(be.benchmark, ''))
                    IN ({})
            )
            """.format(placeholders).strip()
        )
        params.extend(benchmark_values)

    query = filters.get("query")
    if query:
        pattern = "%{}%".format(query)

        where_parts.append(
            """
            (
              COALESCE(s.title, '') ILIKE %s
              OR COALESCE(s.original_filename, '') ILIKE %s
              OR COALESCE(s.note, '') ILIKE %s
              OR EXISTS (
                SELECT 1
                FROM executions qe
                WHERE qe.submission_id = s.id
                  AND COALESCE(
                    qe.execution_config->>'original_filename',
                    ''
                  ) ILIKE %s
              )
            )
            """.strip()
        )
        params.extend([pattern, pattern, pattern, pattern])

    where_sql = "\n              AND ".join(where_parts)

    status_sql = ""
    status = filters.get("status")

    if status:
        status_sql = "WHERE aggregate_state = %s"
        params.append(status)

    sql = """
    WITH submission_base AS (
      SELECT
        s.id,
        s.created_at,

        COUNT(e.id) AS executions_count,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'COMPLETED'
        ) AS completed_executions,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'FAILED'
        ) AS failed_executions,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'QUEUED'
        ) AS queued_executions,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'RUNNING'
        ) AS running_executions,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'PROCESSING'
        ) AS processing_executions,

        COUNT(e.id) FILTER (
          WHERE e.execution_state = 'CANCELLED'
        ) AS cancelled_executions,

        ARRAY_AGG(
          e.benchmark
          ORDER BY e.id
        ) FILTER (
          WHERE e.benchmark IS NOT NULL
        ) AS benchmarks,

        ARRAY_AGG(
          e.execution_config->>'original_filename'
          ORDER BY e.id
        ) FILTER (
          WHERE COALESCE(
            e.execution_config->>'original_filename',
            ''
          ) <> ''
        ) AS source_filenames,

        COALESCE(
          MAX(
            COALESCE(
              e.finished_at,
              e.processing_at,
              e.started_at,
              e.queued_at,
              e.created_at
            )
          ),
          s.created_at
        ) AS activity_at

      FROM submissions s

      LEFT JOIN executions e
        ON e.submission_id = s.id

      WHERE {where_sql}

      GROUP BY
        s.id,
        s.created_at
    ),

    history_rows AS (
      SELECT
        sb.*,

        CASE
          WHEN sb.executions_count = 0
            THEN 'EMPTY'

          WHEN (
            sb.queued_executions
            + sb.running_executions
            + sb.processing_executions
          ) > 0
            THEN 'IN_PROGRESS'

          WHEN sb.completed_executions > 0
            AND (
              sb.failed_executions
              + sb.cancelled_executions
            ) = 0
            THEN 'COMPLETED'

          WHEN sb.completed_executions > 0
            AND (
              sb.failed_executions
              + sb.cancelled_executions
            ) > 0
            THEN 'PARTIAL'

          WHEN sb.completed_executions = 0
            AND sb.failed_executions > 0
            THEN 'FAILED'

          WHEN sb.completed_executions = 0
            AND sb.failed_executions = 0
            AND sb.cancelled_executions > 0
            THEN 'CANCELLED'

          ELSE 'EMPTY'
        END AS aggregate_state

      FROM submission_base sb
    ),

    filtered_history AS (
      SELECT *
      FROM history_rows
      {status_sql}
    )
    """.format(
        where_sql=where_sql,
        status_sql=status_sql,
    ).strip()

    return sql, params


def _serialize_submission_metadata(row, include_private=True):
    """Serializa procedencia y, cuando corresponde, metadata privada."""
    payload = {
        "originalFilename": row.get("original_filename"),
    }
    if include_private:
        payload.update(
            {
                "note": row.get("note"),
                "isPinned": bool(row.get("is_pinned")),
            }
        )
    return payload


def _parse_submission_metadata_patch():
    """Valida por completo el PATCH antes de cualquier escritura."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequestError(
            "El cuerpo de la solicitud debe ser un objeto JSON."
        )

    if not data:
        raise BadRequestError(
            "Debe indicar al menos un campo modificable."
        )

    unknown_fields = sorted(
        set(data) - MUTABLE_SUBMISSION_METADATA_FIELDS
    )
    if unknown_fields:
        raise BadRequestError(
            "La solicitud contiene campos no permitidos.",
            extra={"fields": unknown_fields},
        )

    updates = {}

    if "note" in data:
        raw_note = data["note"]
        if raw_note is not None and not isinstance(raw_note, str):
            raise ValidationError(
                "note debe ser texto o null.",
                extra={"field": "note"},
            )

        try:
            updates["note"] = normalize_submission_note(raw_note)
        except InvalidExecutionRequest as exc:
            raise ValidationError(
                str(exc),
                extra={"field": "note"},
            )

    if "isPinned" in data:
        raw_is_pinned = data["isPinned"]
        if not isinstance(raw_is_pinned, bool):
            raise ValidationError(
                "isPinned debe ser un booleano JSON.",
                extra={"field": "isPinned"},
            )
        updates["is_pinned"] = raw_is_pinned

    return updates


def _current_role_name():
    role_name = getattr(g, "current_role_name", None)
    if role_name:
        return role_name
    return get_user_role_name(g.current_user)


def _assert_current_user_can_view_submission(submission_id, conn):
    try:
        return assert_submission_viewer(
            submission_id=submission_id,
            current_user_id=g.current_user["id"],
            current_role_name=_current_role_name(),
            conn=conn,
        )
    except SubmissionAccessNotFound:
        raise NotFoundError(
            f"Submission con id {submission_id} no existe."
        )
    except SubmissionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para ver este envío."
        )


def map_submission_status_label(raw_status: str) -> str:
    """
    Compatibilidad temporal para submissions.status.
    El estado de las EXECUTIONS ya no se obtiene desde este campo.
    """
    if not raw_status:
        return "Desconocido"

    s = str(raw_status).upper()
    if s in ("QUEUED", "PENDING"):
        return "En cola"
    if s == "RUNNING":
        return "En ejecución"
    if s == "OK":
        return "Aprobado"
    if s in ("ERR", "ERROR"):
        return "Error"
    return raw_status


# ==========================
# GET /api/submissions
# ==========================

@submissions_bp.route("/submissions", methods=["GET"])
@login_required
@handle_api_errors
def list_my_submissions():
    user = g.current_user

    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 200."
        )

    filters = _parse_submission_history_filters()
    offset = (page - 1) * page_size

    history_cte_sql, history_params = (
        _build_submission_history_cte(
            user_id=user["id"],
            filters=filters,
        )
    )

    conn = get_connection()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            count_sql = """
            {history_cte_sql}

            SELECT COUNT(*) AS total
            FROM filtered_history;
            """.format(
                history_cte_sql=history_cte_sql,
            )

            cur.execute(
                count_sql,
                tuple(history_params),
            )

            total_row = cur.fetchone() or {"total": 0}
            total = total_row["total"] or 0

            list_sql = """
            {history_cte_sql},

            last_exec AS (
              SELECT DISTINCT ON (e.submission_id)
                e.submission_id,
                e.execution_state,
                e.public_id::text AS public_id,
                e.codename,

                COALESCE(
                  e.finished_at,
                  e.processing_at,
                  e.started_at,
                  e.queued_at,
                  e.created_at
                ) AS activity_at

              FROM executions e

              JOIN filtered_history fh_last
                ON fh_last.id = e.submission_id

              ORDER BY
                e.submission_id,
                e.id DESC
            )

            SELECT
              s.id,
              s.course_id,
              s.title,
              s.original_filename,
              s.note,
              s.is_pinned,
              s.status AS legacy_status,
              s.created_at,

              c.code AS course_code,
              c.name AS course_name,
              c.academic_year AS course_year,
              c.academic_term AS course_term,

              le.execution_state AS last_execution_state,
              le.public_id AS last_execution_public_id,
              le.codename AS last_execution_codename,
              le.activity_at AS last_execution_at,

              fh.executions_count,
              fh.completed_executions,
              fh.failed_executions,
              fh.queued_executions,
              fh.running_executions,
              fh.processing_executions,
              fh.cancelled_executions,
              fh.benchmarks,
              fh.source_filenames,
              fh.activity_at AS activity_at

            FROM filtered_history fh

            JOIN submissions s
              ON s.id = fh.id

            LEFT JOIN courses c
              ON c.id = s.course_id

            LEFT JOIN last_exec le
              ON le.submission_id = s.id

            ORDER BY activity_at DESC, s.id DESC

            LIMIT %s OFFSET %s;
            """.format(
                history_cte_sql=history_cte_sql,
            )

            cur.execute(
                list_sql,
                tuple(history_params) + (page_size, offset),
            )

            rows = cur.fetchall()

        items = []

        for row in rows:
            last_state = row.get("last_execution_state")
            last_label = (
                map_execution_state_label(last_state)
                if last_state
                else "Sin ejecuciones"
            )

            history_projection = (
                build_submission_history_projection(row)
            )

            items.append(
                {
                    "id": row["id"],
                    "courseId": row.get("course_id"),
                    "course": (
                        {
                            "id": row.get("course_id"),
                            "code": row.get("course_code"),
                            "name": row.get("course_name"),
                            "academicYear": row.get("course_year"),
                            "academicTerm": row.get("course_term"),
                        }
                        if row.get("course_id") is not None
                        else None
                    ),
                    "title": row.get("title"),
                    **_serialize_submission_metadata(row),
                    "status": last_state,
                    "statusLabel": last_label,
                    "legacyStatus": row.get("legacy_status"),
                    "createdAt": (
                        row["created_at"].isoformat()
                        if row.get("created_at")
                        else None
                    ),
                    "executionsCount": (
                        row["executions_count"] or 0
                    ),
                    **history_projection,
                    "lastExecutionState": last_state,
                    "lastExecutionStatus": last_label,
                    "lastExecutionPublicId": row.get(
                        "last_execution_public_id"
                    ),
                    "lastExecutionCodename": row.get(
                        "last_execution_codename"
                    ),
                    "lastExecutionAt": (
                        row["last_execution_at"].isoformat()
                        if row.get("last_execution_at")
                        else None
                    ),
                }
            )

        return jsonify(
            {
                "items": items,
                "page": page,
                "pageSize": page_size,
                "total": total,
            }
        ), 200

    finally:
        conn.close()


# ==========================
# GET /api/submissions/history-filter-options
# ==========================

@submissions_bp.route(
    "/submissions/history-filter-options",
    methods=["GET"],
)
@login_required
@handle_api_errors
def list_submission_history_filter_options():
    user = g.current_user

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT DISTINCT
                  c.id,
                  c.code,
                  c.name,
                  c.academic_year,
                  c.academic_term
                FROM submissions s
                JOIN courses c
                  ON c.id = s.course_id
                WHERE s.user_id = %s
                  AND s.course_id IS NOT NULL
                ORDER BY
                  c.academic_year DESC,
                  c.academic_term DESC,
                  c.code,
                  c.id;
                """,
                (user["id"],),
            )
            rows = cur.fetchall()

        courses = [
            {
                "id": row["id"],
                "code": row["code"],
                "name": row["name"],
                "academicYear": row["academic_year"],
                "academicTerm": row["academic_term"],
            }
            for row in rows
        ]

        return jsonify({"courses": courses}), 200

    finally:
        conn.close()
# ==========================
# POST /api/submissions
# ==========================

@submissions_bp.route("/submissions", methods=["POST"])
@login_required
@handle_api_errors
def create_submission():
    """
    Endpoint manual legacy de creación mínima de submission.
    /sendcode sigue siendo el flujo real integrado.
    """
    user = g.current_user
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    requested_course_id = data.get(
        "courseId",
        data.get("course_id"),
    )

    if not title:
        raise ValidationError(
            "Debe indicar un título para la entrega.",
            extra={"field": "title"},
        )

    initial_status = "QUEUED"

    try:
        with db_cursor() as (conn, cur):
            course_id = resolve_submission_course(
                user_id=user["id"],
                requested_course_id=requested_course_id,
                conn=conn,
            )

            cur.execute(
                """
                INSERT INTO submissions (
                    user_id,
                    course_id,
                    title,
                    status,
                    created_at
                )
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING
                    id,
                    user_id,
                    course_id,
                    title,
                    status,
                    created_at;
                """,
                (
                    user["id"],
                    course_id,
                    title,
                    initial_status,
                ),
            )
            row = cur.fetchone()

        return jsonify(
            {
                "id": row["id"],
                "courseId": row["course_id"],
                "title": row["title"],
                "status": row["status"],
                "statusLabel": map_submission_status_label(
                    row["status"]
                ),
                "createdAt": (
                    row["created_at"].isoformat()
                    if row.get("created_at")
                    else None
                ),
            }
        ), 201
    except InvalidExecutionRequest as exc:
        raise ValidationError(str(exc))


# ==========================
# GET /api/submissions/<id>
# ==========================

@submissions_bp.route("/submissions/<int:submission_id>", methods=["GET"])
@login_required
@handle_api_errors
def get_submission_detail(submission_id: int):
    user = g.current_user
    conn = get_connection()

    try:
        access_row = _assert_current_user_can_view_submission(
            submission_id,
            conn,
        )
        can_view_private_metadata = is_submission_owner(
            access_row,
            user["id"],
        )

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  s.id,
                  s.course_id,
                  s.title,
                  s.original_filename,
                  s.code_hash AS archive_sha256,
                  s.note,
                  s.is_pinned,
                  s.status AS legacy_status,
                  s.created_at,
                  c.code AS course_code,
                  c.name AS course_name,
                  c.academic_year AS course_year,
                  c.academic_term AS course_term
                FROM submissions s
                LEFT JOIN courses c
                  ON c.id = s.course_id
                WHERE s.id = %s;
                """,
                (submission_id,),
            )
            srow = cur.fetchone()

            if srow is None:
                raise NotFoundError(
                    f"Submission con id {submission_id} no existe."
                )

            cur.execute(
                """
                SELECT
                  COUNT(*) AS executions_count,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'COMPLETED'
                  ) AS completed_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'FAILED'
                  ) AS failed_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'FAILED'
                      AND error_code = 'EXECUTION_TIMEOUT'
                  ) AS timeout_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'FAILED'
                      AND COALESCE(error_code, '') <> 'EXECUTION_TIMEOUT'
                  ) AS error_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'QUEUED'
                  ) AS queued_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'RUNNING'
                  ) AS running_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'PROCESSING'
                  ) AS processing_executions,
                  COUNT(*) FILTER (
                    WHERE execution_state = 'CANCELLED'
                  ) AS cancelled_executions
                FROM executions
                WHERE submission_id = %s;
                """,
                (submission_id,),
            )
            agg = cur.fetchone() or {}

            cur.execute(
                """
                SELECT
                  e.execution_state,
                  e.public_id::text AS public_id,
                  e.codename,
                  COALESCE(
                    e.finished_at,
                    e.processing_at,
                    e.started_at,
                    e.queued_at,
                    e.created_at
                  ) AS activity_at
                FROM executions e
                WHERE e.submission_id = %s
                ORDER BY e.id DESC
                LIMIT 1;
                """,
                (submission_id,),
            )
            last = cur.fetchone()

        summary = summary_from_aggregate(agg)

        if last:
            last_state = last["execution_state"]
            last_label = map_execution_state_label(last_state)
            last_at = (
                last["activity_at"].isoformat()
                if last.get("activity_at")
                else None
            )
        else:
            last_state = None
            last_label = "Sin ejecuciones"
            last_at = None

        summary.update(
            {
                "lastExecutionState": last_state,
                "lastExecutionStatus": last_label,
                "lastExecutionAt": last_at,
                "lastExecutionPublicId": (
                    last.get("public_id") if last else None
                ),
                "lastExecutionCodename": (
                    last.get("codename") if last else None
                ),
            }
        )

        submission = {
            "id": srow["id"],
            "courseId": srow.get("course_id"),
            "course": (
                {
                    "id": srow.get("course_id"),
                    "code": srow.get("course_code"),
                    "name": srow.get("course_name"),
                    "academicYear": srow.get("course_year"),
                    "academicTerm": srow.get("course_term"),
                }
                if srow.get("course_id") is not None
                else None
            ),
            "title": srow["title"],
            **_serialize_submission_metadata(
                srow,
                include_private=can_view_private_metadata,
            ),
            "archiveSha256": srow.get("archive_sha256"),
            "status": last_state,
            "statusLabel": last_label,
            "legacyStatus": srow.get("legacy_status"),
            "createdAt": (
                srow["created_at"].isoformat()
                if srow.get("created_at")
                else None
            ),
        }

        return jsonify(
            {
                "submission": submission,
                "summary": summary,
                "permissions": {
                    "canEditMetadata": can_view_private_metadata,
                    "canViewPrivateMetadata": can_view_private_metadata,
                },
            }
        ), 200
    finally:
        conn.close()


# ==========================
# PATCH /api/submissions/<id>
# ==========================

@submissions_bp.route("/submissions/<int:submission_id>", methods=["PATCH"])
@login_required
@handle_api_errors
def update_submission_metadata(submission_id: int):
    user = g.current_user
    updates = _parse_submission_metadata_patch()
    conn = get_connection()

    try:
        try:
            current = submission_repository.get_submission(
                submission_id,
                conn=conn,
            )
        except submission_repository.SubmissionNotFound:
            raise NotFoundError(
                f"Submission con id {submission_id} no existe."
            )

        if current["user_id"] != user["id"]:
            raise ForbiddenError(
                "No tienes permiso para modificar este envío."
            )

        try:
            if "note" in updates and "is_pinned" in updates:
                updated = submission_repository.update_submission_metadata(
                    submission_id,
                    note=updates["note"],
                    is_pinned=updates["is_pinned"],
                    conn=conn,
                )
            elif "note" in updates:
                updated = submission_repository.update_submission_note(
                    submission_id,
                    note=updates["note"],
                    conn=conn,
                )
            else:
                updated = submission_repository.set_submission_pinned(
                    submission_id,
                    is_pinned=updates["is_pinned"],
                    conn=conn,
                )
        except submission_repository.SubmissionNotFound:
            raise NotFoundError(
                f"Submission con id {submission_id} no existe."
            )

        conn.commit()

        return jsonify(
            {
                "id": updated["id"],
                **_serialize_submission_metadata(updated),
            }
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ==========================
# GET /api/submissions/<id>/executions
# ==========================

@submissions_bp.route(
    "/submissions/<int:submission_id>/executions",
    methods=["GET"],
)
@login_required
@handle_api_errors
def get_submission_executions(submission_id: int):
    status_param = request.args.get("status", "all", type=str)
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 200."
        )

    try:
        filter_sql, filter_params = execution_status_filter_sql(
            status_param,
            alias="e",
        )
    except ValueError:
        raise BadRequestError("Valor inválido para 'status'.")

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        _assert_current_user_can_view_submission(submission_id, conn)

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            base_sql = """
            FROM executions e
            JOIN submissions s
              ON s.id = e.submission_id
            LEFT JOIN hardware_profiles hp
              ON hp.id = e.hardware_profile_id
            WHERE e.submission_id = %s
            """ + filter_sql

            params = [submission_id] + filter_params

            cur.execute(
                "SELECT COUNT(*) AS total " + base_sql,
                params,
            )
            total_row = cur.fetchone() or {"total": 0}
            total = total_row["total"] or 0

            data_sql = """
            SELECT
              e.id AS execution_id,
              e.public_id::text AS public_id,
              e.codename,
              e.submission_id,
              e.benchmark,
              e.execution_state,
              e.failure_stage,
              e.error_code,
              e.error_message,
              e.started_at,
              e.processing_at,
              e.finished_at,
              e.duration_ms,
              e.result_available,
              e.execution_config->>'original_filename' AS original_filename,
              s.title AS submission_title,
              hp.name AS hardware_name
            """ + base_sql + """
            ORDER BY e.id DESC
            LIMIT %s OFFSET %s;
            """

            cur.execute(
                data_sql,
                params + [page_size, offset],
            )
            rows = cur.fetchall()

        return jsonify(
            {
                "items": [
                    serialize_execution_history_row(row)
                    for row in rows
                ],
                "page": page,
                "pageSize": page_size,
                "total": total,
            }
        ), 200
    finally:
        conn.close()


# ==========================
# GET /api/submissions/<id>/repeat
# ==========================

@submissions_bp.route(
    "/submissions/<int:submission_id>/repeat",
    methods=["GET"],
)
@login_required
@handle_api_errors
def get_submission_repeat(submission_id: int):
    """Describe una repetición segura sin crear ni ejecutar nada."""
    conn = get_connection()
    try:
        access_row = _assert_current_user_can_view_submission(
            submission_id,
            conn,
        )
        if not is_submission_owner(
            access_row,
            g.current_user["id"],
        ):
            raise ForbiddenError(
                "Solo el propietario puede repetir este Experimento."
            )
    finally:
        conn.close()

    try:
        descriptor = get_submission_repeat_for_user(
            submission_id=submission_id,
            current_user_id=g.current_user["id"],
        )
    except SubmissionRepeatNotFound:
        raise NotFoundError("El Experimento solicitado no existe.")
    except SubmissionRepeatForbidden:
        raise ForbiddenError(
            "Solo el propietario puede repetir este Experimento."
        )
    except SubmissionRepeatConfigurationInvalid as error:
        raise APIError(
            str(error),
            status_code=409,
            code="REPEAT_CONFIGURATION_INCONSISTENT",
        )
    except SourceProvenanceError as error:
        raise APIError(
            error.message,
            status_code=error.status_code,
            code=error.code,
        )

    return jsonify({"repeat": descriptor}), 200


# ==========================
# POST /api/submissions/<id>/rerun
# ==========================

@submissions_bp.route(
    "/submissions/<int:submission_id>/rerun",
    methods=["POST"],
)
@login_required
@handle_api_errors
def rerun_submission(submission_id: int):
    user = g.current_user

    with db_cursor() as (conn, cur):
        cur.execute(
            "SELECT id, user_id FROM submissions WHERE id = %s;",
            (submission_id,),
        )
        srow = cur.fetchone()

        if srow is None:
            raise NotFoundError(
                f"Submission con id {submission_id} no existe."
            )
        if srow["user_id"] != user["id"]:
            raise ForbiddenError(
                "No tienes permiso para re-ejecutar este envío."
            )

        cur.execute(
            """
            INSERT INTO audit_log (
                user_id,
                action,
                description,
                created_at
            )
            VALUES (%s, %s, %s, NOW());
            """,
            (
                user["id"],
                "rerun_submission",
                (
                    "Usuario solicitó re-ejecución de "
                    f"submission_id={submission_id}"
                ),
            ),
        )

        return jsonify(
            {
                "message": "Re-ejecución solicitada.",
                "submissionId": submission_id,
            }
        ), 202


# ==========================
# GET /api/executions/<id>
# ==========================

@submissions_bp.route(
    "/executions/<int:execution_id>",
    methods=["GET"],
)
@login_required
@handle_api_errors
def get_execution_detail(execution_id: int):
    user = g.current_user
    conn = get_connection()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  e.id AS execution_id,
                  e.public_id::text AS public_id,
                  e.codename,
                  e.submission_id,
                  e.execution_state,
                  e.failure_stage,
                  e.error_code,
                  e.error_message,
                  e.started_at,
                  e.processing_at,
                  e.finished_at,
                  e.duration_ms,
                  e.result_available,
                  hp.name AS hardware_name,
                  s.user_id,
                  s.title AS submission_title
                FROM executions e
                JOIN submissions s
                  ON s.id = e.submission_id
                LEFT JOIN hardware_profiles hp
                  ON hp.id = e.hardware_profile_id
                WHERE e.id = %s;
                """,
                (execution_id,),
            )
            row = cur.fetchone()

            if row is None:
                raise NotFoundError(
                    f"Ejecución con id {execution_id} no existe."
                )

            if row["user_id"] != user["id"]:
                raise ForbiddenError(
                    "No tienes permiso para ver esta ejecución."
                )

        execution = serialize_execution_history_row(row)
        execution["id"] = execution["executionId"]

        return jsonify(
            {"execution": execution}
        ), 200
    finally:
        conn.close()
