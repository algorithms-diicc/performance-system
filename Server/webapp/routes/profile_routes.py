# server/webapp/routes/profile_routes.py

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..utils.auth_decorators import login_required
from ..utils.api_errors import (
    handle_api_errors,
    BadRequestError,
)
from ..services.execution_history_service import (
    execution_status_filter_sql,
    map_execution_state_label,
    serialize_execution_history_row,
    summary_from_aggregate,
)

profile_bp = Blueprint("profile", __name__, url_prefix="/api")


# ==========================
# Helpers locales
# ==========================

def map_user_status_label(is_active: bool) -> str:
    """
    Convierte el booleano users.is_active a etiqueta de UI.
    """
    return "Activo" if is_active else "Inactivo"


def last_execution_duration_ms(execution_row):
    """Duración real de la misma fila elegida como latest Execution."""
    row = execution_row or {}
    persisted_duration = row.get("duration_ms")

    if persisted_duration is not None:
        try:
            return float(persisted_duration)
        except (TypeError, ValueError):
            return None

    started_at = row.get("started_at")
    finished_at = row.get("finished_at")
    if started_at is None or finished_at is None:
        return None

    try:
        return float(
            (finished_at - started_at).total_seconds() * 1000.0
        )
    except (AttributeError, TypeError, ValueError):
        return None


# ==========================
# GET /api/profile  (perfil consolidado propio)
# ==========================

@profile_bp.route("/profile", methods=["GET"])
@handle_api_errors
@login_required
def get_my_profile():
    """
    Perfil consolidado del usuario autenticado.

    CORE-04E-2:
    - executions.execution_state es la fuente de verdad.
    - error_code separa timeout de otros FAILED.
    - la última ejecución se determina por e.id DESC, aunque siga activa.
    - se mantienen aliases legacy sólo por compatibilidad temporal.
    """
    current_user = g.current_user
    user_id = current_user["id"]

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
                      AND COALESCE(e.error_code, '') <> 'EXECUTION_TIMEOUT'
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
                          EPOCH FROM (e.finished_at - e.started_at)
                        ) * 1000.0
                        ELSE NULL
                      END
                    )
                  ) AS avg_duration_ms
                FROM users u
                LEFT JOIN roles r ON r.id = u.role_id
                LEFT JOIN submissions s ON s.user_id = u.id
                LEFT JOIN executions e ON e.submission_id = s.id
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
                is_active = bool(current_user.get("is_active", True))
                profile = {
                    "id": current_user["id"],
                    "full_name": current_user.get("full_name"),
                    "email": current_user.get("email"),
                    "role": None,
                    "isActive": is_active,
                    "statusLabel": map_user_status_label(is_active),
                    "createdAt": None,
                    "lastLogin": None,
                }
                summary = {
                    "submissionsCount": 0,
                    "executionsCount": 0,
                    "completedExecutions": 0,
                    "failedExecutions": 0,
                    "queuedExecutions": 0,
                    "runningExecutions": 0,
                    "processingExecutions": 0,
                    "cancelledExecutions": 0,
                    "okExecutions": 0,
                    "timeoutExecutions": 0,
                    "errorExecutions": 0,
                    "avgDurationMs": None,
                    "lastExecutionDurationMs": None,
                    "lastExecutionAt": None,
                    "lastExecutionState": None,
                    "lastExecutionStatus": "Sin ejecuciones",
                    "lastExecutionPublicId": None,
                    "lastExecutionCodename": None,
                    "lastSubmissionId": None,
                }
                return jsonify(
                    {"profile": profile, "summary": summary}
                ), 200

            cur.execute(
                """
                SELECT
                  e.execution_state,
                  e.public_id::text AS public_id,
                  e.codename,
                  e.submission_id,
                  e.duration_ms,
                  e.started_at,
                  e.finished_at,
                  COALESCE(
                    e.finished_at,
                    e.processing_at,
                    e.started_at,
                    e.queued_at,
                    e.created_at
                  ) AS activity_at
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
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
            "statusLabel": map_user_status_label(is_active),
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
        summary["submissionsCount"] = row["submissions_count"] or 0
        summary["avgDurationMs"] = (
            float(row["avg_duration_ms"])
            if row["avg_duration_ms"] is not None
            else None
        )

        if last_exec:
            last_state = last_exec["execution_state"]
            summary.update(
                {
                    "lastExecutionAt": (
                        last_exec["activity_at"].isoformat()
                        if last_exec.get("activity_at")
                        else None
                    ),
                    "lastExecutionState": last_state,
                    "lastExecutionDurationMs":
                        last_execution_duration_ms(last_exec),
                    "lastExecutionStatus":
                        map_execution_state_label(last_state),
                    "lastExecutionPublicId":
                        last_exec.get("public_id"),
                    "lastExecutionCodename":
                        last_exec.get("codename"),
                    "lastSubmissionId":
                        last_exec.get("submission_id"),
                }
            )
        else:
            summary.update(
                {
                    "lastExecutionAt": None,
                    "lastExecutionState": None,
                    "lastExecutionDurationMs": None,
                    "lastExecutionStatus": "Sin ejecuciones",
                    "lastExecutionPublicId": None,
                    "lastExecutionCodename": None,
                    "lastSubmissionId": None,
                }
            )

        return jsonify(
            {"profile": profile, "summary": summary}
        ), 200

    finally:
        conn.close()


# ==========================
# GET /api/profile/executions  (historial propio)
# ==========================

@profile_bp.route("/profile/executions", methods=["GET"])
@handle_api_errors
@login_required
def get_my_executions():
    """
    Historial propio basado en executions.execution_state.

    status acepta:
      QUEUED, RUNNING, PROCESSING, COMPLETED, FAILED, CANCELLED

    Compatibilidad temporal:
      Aprobado  -> COMPLETED
      Rechazado -> FAILED + EXECUTION_TIMEOUT
      Error     -> FAILED excepto EXECUTION_TIMEOUT
    """
    current_user = g.current_user
    user_id = current_user["id"]

    status_param = request.args.get("status", "all", type=str)
    problem = request.args.get(
        "problem",
        "",
        type=str,
    ).strip().lower()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError(
            "El parámetro 'page' debe ser >= 1."
        )
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
        raise BadRequestError(
            "Valor inválido para 'status'."
        )

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            base_sql = """
            FROM executions e
            JOIN submissions s ON s.id = e.submission_id
            LEFT JOIN hardware_profiles hp
              ON hp.id = e.hardware_profile_id
            WHERE s.user_id = %s
            """ + filter_sql

            params = [user_id] + filter_params

            if problem:
                base_sql += " AND LOWER(s.title) LIKE %s "
                params.append(f"%{problem}%")

            cur.execute(
                "SELECT COUNT(*) AS total " + base_sql,
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
# GET /api/profile/audit-log  (historial de acciones propio)
# ==========================

@profile_bp.route("/profile/audit-log", methods=["GET"])
@handle_api_errors
@login_required
def get_my_audit_log():
    """
    Lista de entradas de audit_log para el usuario autenticado.

    Parámetros de query:
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplo:

      GET http://localhost:5000/api/profile/audit-log
      GET http://localhost:5000/api/profile/audit-log?page=2&page_size=10
    """
    current_user = g.current_user
    user_id = current_user["id"]

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
            # 1) Total de registros de log para este usuario
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

            # 2) Registros paginados
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
