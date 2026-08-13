# server/webapp/routes/admin_users_routes.py

from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection  # conexión a PostgreSQL
from ..utils.auth_decorators import login_required, admin_required
from ..utils.api_errors import handle_api_errors, NotFoundError, BadRequestError
from ..services.execution_history_service import (
    execution_status_filter_sql,
    map_execution_state_label,
    serialize_execution_history_row,
    summary_from_aggregate,
)

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/api/admin")


# ==========================
# Helpers locales
# ==========================

def map_user_status_label(is_active: bool) -> str:
    """
    Convierte el booleano users.is_active a etiqueta de UI.
    """
    return "Activo" if is_active else "Inactivo"


def map_submission_status_from_counts(
    ok_count: int, timeout_count: int, error_count: int
) -> str:
    """
    Devuelve una etiqueta amigable de estado para un submission
    a partir de sus ejecuciones.

    Reglas sugeridas (puedes ajustarlas luego):

    - ok > 0 y timeout/error = 0       -> "Con ejecuciones aprobadas"
    - ok = 0 y (timeout > 0 o error>0) -> "Con errores recurrentes"
    - ok > 0 y (timeout>0 o error>0)   -> "Mixto"
    - todo 0                           -> "En revisión"
    """
    ok = ok_count or 0
    to = timeout_count or 0
    er = error_count or 0

    if ok > 0 and to == 0 and er == 0:
        return "Con ejecuciones aprobadas"
    if ok == 0 and (to > 0 or er > 0):
        return "Con errores recurrentes"
    if ok > 0 and (to > 0 or er > 0):
        return "Mixto"
    return "En revisión"


# ==========================
# GET /api/admin/users  (LISTADO)
# ==========================

@admin_users_bp.route("/users", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def list_users():
    """
    Lista administrativa paginada de usuarios.

    Los filtros y el ordenamiento se aplican en PostgreSQL para que la
    interfaz no dependa de cargar el universo completo de usuarios.
    """
    search = request.args.get(
        "search",
        "",
        type=str,
    ).strip().lower()
    role = request.args.get("role", "all", type=str)
    status = request.args.get("status", "all", type=str)
    sort_by = request.args.get(
        "sort_by",
        "lastActivity",
        type=str,
    )
    sort_dir = request.args.get(
        "sort_dir",
        "desc",
        type=str,
    )
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get(
        "page_size",
        1000,
        type=int,
    )

    if page < 1:
        page = 1
    if page_size <= 0 or page_size > 10000:
        page_size = 1000

    sort_map = {
        "name": "full_name",
        "createdAt": "created_at",
        "lastActivity": "last_execution_at",
    }
    order_column = sort_map.get(
        sort_by,
        "last_execution_at",
    )
    order_dir = (
        "ASC"
        if sort_dir.lower() == "asc"
        else "DESC"
    )

    offset = (page - 1) * page_size

    filters = []
    params = []

    if search:
        filters.append(
            "(LOWER(u.full_name) LIKE %s "
            "OR LOWER(u.email) LIKE %s)"
        )
        like = f"%{search}%"
        params.extend([like, like])

    if role and role != "all":
        filters.append("r.name = %s")
        params.append(role)

    if status and status != "all":
        if status == "Activo":
            filters.append("u.is_active = TRUE")
        elif status == "Inactivo":
            filters.append("u.is_active = FALSE")
        else:
            raise BadRequestError(
                "Valor inválido para 'status'."
            )

    where_sql = (
        "WHERE " + " AND ".join(filters)
        if filters
        else ""
    )

    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM users u
                LEFT JOIN roles r
                  ON r.id = u.role_id
                {where_sql};
                """,
                params,
            )
            filtered_row = cur.fetchone()
            filtered_total = (
                filtered_row["total"]
                if filtered_row
                and filtered_row["total"] is not None
                else 0
            )

            sql = f"""
            WITH activity AS (
              SELECT
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                u.created_at,
                r.name AS role_name,
                COUNT(DISTINCT s.id) AS submissions_count,
                COUNT(DISTINCT e.id) AS executions_count,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'COMPLETED'
                ) AS completed_executions,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'FAILED'
                ) AS failed_executions,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'QUEUED'
                ) AS queued_executions,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'RUNNING'
                ) AS running_executions,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'PROCESSING'
                ) AS processing_executions,
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.execution_state = 'CANCELLED'
                ) AS cancelled_executions
              FROM users u
              LEFT JOIN roles r
                ON r.id = u.role_id
              LEFT JOIN submissions s
                ON s.user_id = u.id
              LEFT JOIN executions e
                ON e.submission_id = s.id
              {where_sql}
              GROUP BY
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                u.created_at,
                r.name
            ),
            latest AS (
              SELECT DISTINCT ON (s.user_id)
                s.user_id,
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
              JOIN submissions s
                ON s.id = e.submission_id
              ORDER BY s.user_id, e.id DESC
            )
            SELECT
              a.*,
              l.execution_state AS last_execution_state,
              l.public_id AS last_execution_public_id,
              l.codename AS last_execution_codename,
              l.activity_at AS last_execution_at
            FROM activity a
            LEFT JOIN latest l
              ON l.user_id = a.id
            ORDER BY {order_column} {order_dir} NULLS LAST
            LIMIT %s OFFSET %s;
            """

            cur.execute(
                sql,
                params + [page_size, offset],
            )
            rows = cur.fetchall()

        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            cur.execute(
                """
                SELECT
                  COUNT(*) AS total,
                  COUNT(*) FILTER (
                    WHERE is_active = TRUE
                  ) AS active,
                  COUNT(*) FILTER (
                    WHERE is_active = FALSE
                  ) AS inactive,
                  0 AS blocked
                FROM users;
                """
            )
            summary_row = cur.fetchone() or {
                "total": 0,
                "active": 0,
                "inactive": 0,
                "blocked": 0,
            }

        items = []
        for row in rows:
            state = row.get(
                "last_execution_state"
            )
            completed = (
                row.get("completed_executions")
                or 0
            )
            failed = (
                row.get("failed_executions")
                or 0
            )

            items.append(
                {
                    "id": row["id"],
                    "name": row["full_name"],
                    "email": row["email"],
                    "role": row["role_name"],
                    "status": map_user_status_label(
                        bool(row["is_active"])
                    ),
                    "createdAt": (
                        row["created_at"].isoformat()
                        if row.get("created_at")
                        else None
                    ),
                    "submissionsCount": (
                        row["submissions_count"] or 0
                    ),
                    "executionsCount": (
                        row["executions_count"] or 0
                    ),
                    "completedExecutions": completed,
                    "failedExecutions": failed,
                    "queuedExecutions": (
                        row["queued_executions"] or 0
                    ),
                    "runningExecutions": (
                        row["running_executions"] or 0
                    ),
                    "processingExecutions": (
                        row["processing_executions"]
                        or 0
                    ),
                    "cancelledExecutions": (
                        row["cancelled_executions"]
                        or 0
                    ),
                    # Compatibilidad temporal.
                    "passedCount": completed,
                    "failedCount": failed,
                    "lastExecutionState": state,
                    "lastExecutionStatus": (
                        map_execution_state_label(
                            state
                        )
                        if state
                        else "Sin ejecuciones"
                    ),
                    "lastExecutionPublicId": row.get(
                        "last_execution_public_id"
                    ),
                    "lastExecutionCodename": row.get(
                        "last_execution_codename"
                    ),
                    "lastExecutionAt": (
                        row[
                            "last_execution_at"
                        ].isoformat()
                        if row.get(
                            "last_execution_at"
                        )
                        else None
                    ),
                }
            )

        total_pages = (
            (filtered_total + page_size - 1)
            // page_size
            if filtered_total
            else 0
        )

        return jsonify(
            {
                "items": items,
                "summary": {
                    "total": summary_row["total"],
                    "active": summary_row["active"],
                    "inactive": summary_row[
                        "inactive"
                    ],
                    # Se conserva por compatibilidad.
                    "blocked": summary_row[
                        "blocked"
                    ],
                },
                "page": page,
                "pageSize": page_size,
                "total": filtered_total,
                "filteredTotal": filtered_total,
                "totalPages": total_pages,
            }
        ), 200

    finally:
        conn.close()


# ==========================
# GET /api/admin/users/<user_id>  (DETALLE PERFIL CONSOLIDADO)
# ==========================

@admin_users_bp.route("/users/<int:user_id>", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_user_detail(user_id: int):
    """
    Perfil administrativo consolidado de un usuario usando execution_state.
    """
    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            cur.execute(
                """
                SELECT
                  u.id,
                  u.full_name,
                  u.email,
                  u.is_active,
                  u.created_at,
                  u.last_login,
                  r.name AS role_name,
                  COUNT(DISTINCT s.id) AS submissions_count,
                  COUNT(DISTINCT e.id) AS executions_count,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'COMPLETED'
                  ) AS completed_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'FAILED'
                  ) AS failed_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'FAILED'
                      AND e.error_code = 'EXECUTION_TIMEOUT'
                  ) AS timeout_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'FAILED'
                      AND COALESCE(e.error_code, '') <>
                          'EXECUTION_TIMEOUT'
                  ) AS error_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'QUEUED'
                  ) AS queued_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'RUNNING'
                  ) AS running_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'PROCESSING'
                  ) AS processing_executions,
                  COUNT(DISTINCT e.id) FILTER (
                    WHERE e.execution_state = 'CANCELLED'
                  ) AS cancelled_executions,
                  AVG(
                    COALESCE(
                      e.duration_ms::numeric,
                      CASE
                        WHEN e.started_at IS NOT NULL
                         AND e.finished_at IS NOT NULL
                        THEN EXTRACT(
                          EPOCH FROM (
                            e.finished_at - e.started_at
                          )
                        ) * 1000.0
                        ELSE NULL
                      END
                    )
                  ) AS avg_duration_ms
                FROM users u
                LEFT JOIN roles r
                  ON r.id = u.role_id
                LEFT JOIN submissions s
                  ON s.user_id = u.id
                LEFT JOIN executions e
                  ON e.submission_id = s.id
                WHERE u.id = %s
                GROUP BY
                  u.id,
                  u.full_name,
                  u.email,
                  u.is_active,
                  u.created_at,
                  u.last_login,
                  r.name;
                """,
                (user_id,),
            )
            row = cur.fetchone()

            if row is None:
                raise NotFoundError(
                    f"Usuario con id {user_id} no existe."
                )

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
                JOIN submissions s
                  ON s.id = e.submission_id
                WHERE s.user_id = %s
                ORDER BY e.id DESC
                LIMIT 1;
                """,
                (user_id,),
            )
            last_exec = cur.fetchone()

        is_active = (
            bool(row["is_active"])
            if row["is_active"] is not None
            else False
        )

        profile = {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": row["email"],
            "role": row["role_name"],
            "isActive": is_active,
            "statusLabel": map_user_status_label(
                is_active
            ),
            "createdAt": (
                row["created_at"].isoformat()
                if row["created_at"]
                else None
            ),
            "lastLogin": (
                row["last_login"].isoformat()
                if row["last_login"]
                else None
            ),
        }

        summary = summary_from_aggregate(row)
        summary["submissionsCount"] = (
            row["submissions_count"] or 0
        )
        summary["avgDurationMs"] = (
            float(row["avg_duration_ms"])
            if row["avg_duration_ms"] is not None
            else None
        )

        if last_exec:
            state = last_exec[
                "execution_state"
            ]
            summary.update(
                {
                    "lastExecutionAt": (
                        last_exec[
                            "activity_at"
                        ].isoformat()
                        if last_exec.get(
                            "activity_at"
                        )
                        else None
                    ),
                    "lastExecutionState": state,
                    "lastExecutionStatus":
                        map_execution_state_label(
                            state
                        ),
                    "lastExecutionPublicId":
                        last_exec.get(
                            "public_id"
                        ),
                    "lastExecutionCodename":
                        last_exec.get(
                            "codename"
                        ),
                }
            )
        else:
            summary.update(
                {
                    "lastExecutionAt": None,
                    "lastExecutionState": None,
                    "lastExecutionStatus":
                        "Sin ejecuciones",
                    "lastExecutionPublicId": None,
                    "lastExecutionCodename": None,
                }
            )

        return jsonify(
            {
                "profile": profile,
                "summary": summary,
            }
        ), 200

    finally:
        conn.close()


# ==========================
# GET /api/admin/users/<user_id>/executions  (TABLA EJECUCIONES)
# ==========================

@admin_users_bp.route("/users/<int:user_id>/executions", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_user_executions(user_id: int):
    """
    Historial administrativo de ejecuciones basado en execution_state.
    """
    status_param = request.args.get(
        "status",
        "all",
        type=str,
    )
    problem = request.args.get(
        "problem",
        "",
        type=str,
    ).strip().lower()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get(
        "page_size",
        20,
        type=int,
    )

    if page < 1:
        raise BadRequestError(
            "El parámetro 'page' debe ser >= 1."
        )
    if page_size <= 0 or page_size > 200:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 200."
        )

    try:
        filter_sql, filter_params = (
            execution_status_filter_sql(
                status_param,
                alias="e",
            )
        )
    except ValueError:
        raise BadRequestError(
            "Valor inválido para 'status'."
        )

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            cur.execute(
                "SELECT id FROM users WHERE id = %s;",
                (user_id,),
            )
            if cur.fetchone() is None:
                raise NotFoundError(
                    f"Usuario con id {user_id} no existe."
                )

            base_sql = """
            FROM executions e
            JOIN submissions s
              ON s.id = e.submission_id
            LEFT JOIN hardware_profiles hp
              ON hp.id = e.hardware_profile_id
            WHERE s.user_id = %s
            """ + filter_sql

            params = [user_id] + filter_params

            if problem:
                base_sql += (
                    " AND LOWER(s.title) LIKE %s "
                )
                params.append(f"%{problem}%")

            cur.execute(
                "SELECT COUNT(*) AS total "
                + base_sql,
                params,
            )
            total_row = cur.fetchone()
            total = (
                total_row["total"]
                if total_row
                and total_row["total"] is not None
                else 0
            )

            data_sql = """
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
                    serialize_execution_history_row(
                        row
                    )
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
# GET /api/admin/users/<user_id>/audit-log  (HISTORIAL ACCIONES)
# ==========================

@admin_users_bp.route("/users/<int:user_id>/audit-log", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_user_audit_log(user_id: int):
    """
    Lista de entradas de audit_log para un usuario (historial de acciones).

    Parámetros de query:
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplo:

      GET http://localhost:5000/api/admin/users/15/audit-log?page=1&page_size=20
    """

    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError("El parámetro 'page_size' debe estar entre 1 y 200.")

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) Verificar que el usuario exista
            cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
            user_row = cur.fetchone()
            if user_row is None:
                raise NotFoundError(f"Usuario con id {user_id} no existe.")

            # 2) Total de registros de log para este usuario
            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM audit_log
                WHERE user_id = %s;
                """,
                (user_id,),
            )
            total_row = cur.fetchone()
            total = (
                total_row["total"]
                if total_row and total_row["total"] is not None
                else 0
            )

            # 3) Registros paginados
            cur.execute(
                """
                SELECT
                  id,
                  action,
                  description,
                  created_at
                FROM audit_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s;
                """,
                (user_id, page_size, offset),
            )
            rows = cur.fetchall()

        items = []
        for r in rows:
            items.append(
                {
                    "id": r["id"],
                    "action": r["action"],
                    "description": r["description"],
                    "createdAt": r["created_at"].isoformat()
                    if r["created_at"]
                    else None,
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
# GET /api/admin/users/<user_id>/submissions  (TABLA SUBMISSIONS)
# ==========================


@admin_users_bp.route("/users/<int:user_id>/submissions", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_user_submissions(user_id: int):
    """
    Submissions administrativas con agregados derivados de execution_state.
    """
    problem = request.args.get(
        "problem",
        "",
        type=str,
    ).strip().lower()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get(
        "page_size",
        20,
        type=int,
    )

    if page < 1:
        raise BadRequestError(
            "El parámetro 'page' debe ser >= 1."
        )
    if page_size <= 0 or page_size > 200:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 200."
        )

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            cur.execute(
                "SELECT id FROM users WHERE id = %s;",
                (user_id,),
            )
            if cur.fetchone() is None:
                raise NotFoundError(
                    f"Usuario con id {user_id} no existe."
                )

            where_extra = ""
            params = [user_id]

            if problem:
                where_extra = (
                    " AND LOWER(s.title) LIKE %s "
                )
                params.append(f"%{problem}%")

            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM submissions s
                WHERE s.user_id = %s
                """
                + where_extra,
                params,
            )
            total_row = cur.fetchone()
            total = (
                total_row["total"]
                if total_row
                and total_row["total"] is not None
                else 0
            )

            data_sql = """
            SELECT
              s.id,
              s.title,
              s.created_at,
              COUNT(e.id) AS executions_count,
              COUNT(e.id) FILTER (
                WHERE e.execution_state = 'COMPLETED'
              ) AS completed_executions,
              COUNT(e.id) FILTER (
                WHERE e.execution_state = 'FAILED'
              ) AS failed_executions,
              COUNT(e.id) FILTER (
                WHERE e.execution_state = 'FAILED'
                  AND e.error_code = 'EXECUTION_TIMEOUT'
              ) AS timeout_executions,
              COUNT(e.id) FILTER (
                WHERE e.execution_state = 'FAILED'
                  AND COALESCE(e.error_code, '') <>
                      'EXECUTION_TIMEOUT'
              ) AS error_executions,
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
              ) AS cancelled_executions
            FROM submissions s
            LEFT JOIN executions e
              ON e.submission_id = s.id
            WHERE s.user_id = %s
            """ + where_extra + """
            GROUP BY
              s.id,
              s.title,
              s.created_at
            ORDER BY s.created_at DESC NULLS LAST
            LIMIT %s OFFSET %s;
            """

            cur.execute(
                data_sql,
                params + [page_size, offset],
            )
            rows = cur.fetchall()

        items = []
        for row in rows:
            completed = (
                row["completed_executions"]
                or 0
            )
            timeout = (
                row["timeout_executions"]
                or 0
            )
            errors = (
                row["error_executions"]
                or 0
            )

            items.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "problem": row["title"],
                    # Etiqueta legacy, ya derivada
                    # de execution_state.
                    "status":
                        map_submission_status_from_counts(
                            completed,
                            timeout,
                            errors,
                        ),
                    "createdAt": (
                        row["created_at"].isoformat()
                        if row["created_at"]
                        else None
                    ),
                    "executionsCount": (
                        row["executions_count"]
                        or 0
                    ),
                    "completedExecutions":
                        completed,
                    "failedExecutions": (
                        row["failed_executions"]
                        or 0
                    ),
                    "queuedExecutions": (
                        row["queued_executions"]
                        or 0
                    ),
                    "runningExecutions": (
                        row["running_executions"]
                        or 0
                    ),
                    "processingExecutions": (
                        row[
                            "processing_executions"
                        ]
                        or 0
                    ),
                    "cancelledExecutions": (
                        row["cancelled_executions"]
                        or 0
                    ),
                    # Compatibilidad temporal.
                    "okExecutions": completed,
                    "timeoutExecutions": timeout,
                    "errorExecutions": errors,
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
# GET /api/admin/executions/<execution_id>  (DETALLE EJECUCIÓN PARA ADMIN)
# ==========================

@admin_users_bp.route("/executions/<int:execution_id>", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_execution_detail(execution_id: int):
    """
    Detalle administrativo canónico de una ejecución.

    Expone configuración, snapshot de hardware y trazabilidad persistida.
    No inventa disponibilidad de métricas ni datos de energía.
    """
    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
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
                  e.queued_at,
                  e.started_at,
                  e.processing_at,
                  e.finished_at,
                  e.created_at,
                  e.duration_ms,
                  e.result_available,
                  e.benchmark,
                  e.input_size,
                  e.samples,
                  e.execution_profile,
                  e.execution_config,
                  e.hardware_snapshot,
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

        execution = serialize_execution_history_row(row)
        execution.update(
            {
                "id": row["execution_id"],
                "userId": row["user_id"],
                "benchmark": row.get("benchmark"),
                "inputSize": row.get("input_size"),
                "samples": row.get("samples"),
                "executionProfile": row.get(
                    "execution_profile"
                ),
                "executionConfig": row.get(
                    "execution_config"
                )
                or {},
                "hardwareSnapshot": row.get(
                    "hardware_snapshot"
                )
                or {},
                "hardwareProfile": row.get(
                    "hardware_name"
                ),
                "queuedAt": (
                    row["queued_at"].isoformat()
                    if row.get("queued_at")
                    else None
                ),
                "createdAt": (
                    row["created_at"].isoformat()
                    if row.get("created_at")
                    else None
                ),
            }
        )

        return jsonify(
            {"execution": execution}
        ), 200

    finally:
        conn.close()
