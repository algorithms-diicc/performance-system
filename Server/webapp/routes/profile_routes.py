# server/webapp/routes/profile_routes.py

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..utils.auth_decorators import login_required
from ..utils.api_errors import (
    handle_api_errors,
    BadRequestError,
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


def map_execution_status_label(raw_status: str) -> str:
    """
    Mapea el status crudo de executions.status a algo entendible en UI.

    - 'ok'             -> 'Aprobado'
    - 'timeout'        -> 'Rechazado'
    - 'runtime_error'  -> 'Error'
    - otros / None     -> 'Desconocido'
    """
    if not raw_status:
        return "Desconocido"

    raw_status = raw_status.lower()
    if raw_status == "ok":
        return "Aprobado"
    if raw_status == "timeout":
        return "Rechazado"
    if raw_status == "runtime_error":
        return "Error"
    return raw_status  # fallback


# ==========================
# GET /api/profile  (perfil consolidado propio)
# ==========================

@profile_bp.route("/profile", methods=["GET"])
@handle_api_errors
@login_required
def get_my_profile():
    """
    Devuelve el perfil consolidado del usuario autenticado.

    Similar a /api/admin/users/<id>, pero siempre "yo mismo", según la cookie
    'session_id' → g.current_user.

    Incluye:
      - profile: datos básicos (id, nombre, email, rol, activo, created_at, last_login)
      - summary: resumen de actividad (submissions, ejecuciones, promedio duración, etc.)

    Ejemplo (navegador):

      GET http://localhost:5000/api/profile

    Respuesta típica (200):
      {
        "profile": { ... },
        "summary": { ... }
      }
    """
    current_user = g.current_user
    user_id = current_user["id"]

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Perfil + agregados de submissions / executions del usuario actual
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
                  SUM(CASE WHEN e.status = 'ok' THEN 1 ELSE 0 END) AS ok_executions,
                  SUM(CASE WHEN e.status = 'timeout' THEN 1 ELSE 0 END) AS timeout_executions,
                  SUM(CASE WHEN e.status = 'runtime_error' THEN 1 ELSE 0 END) AS error_executions,
                  AVG(e.duration_ms) AS avg_duration_ms,
                  MAX(e.finished_at) AS last_execution_at
                FROM users u
                LEFT JOIN roles r ON r.id = u.role_id
                LEFT JOIN submissions s ON s.user_id = u.id
                LEFT JOIN executions e ON e.submission_id = s.id
                WHERE u.id = %s
                GROUP BY
                  u.id, u.full_name, u.email, u.is_active, u.created_at, u.last_login, r.name;
                """,
                (user_id,),
            )
            row = cur.fetchone()

            # En teoría no debería pasar (si estás logueado, el usuario existe),
            # pero por seguridad devolvemos algo razonable.
            if row is None:
                # Perfil mínimo desde g.current_user
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
                    "okExecutions": 0,
                    "timeoutExecutions": 0,
                    "errorExecutions": 0,
                    "avgDurationMs": None,
                    "lastExecutionAt": None,
                    "lastExecutionStatus": "Sin ejecuciones",
                }
                return jsonify({"profile": profile, "summary": summary}), 200

            # 2) Última ejecución para etiquetar estado
            cur.execute(
                """
                SELECT e.status, e.finished_at
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
                WHERE s.user_id = %s
                ORDER BY e.finished_at DESC NULLS LAST
                LIMIT 1;
                """,
                (user_id,),
            )
            last_exec = cur.fetchone()

        is_active = bool(row["is_active"]) if row["is_active"] is not None else False
        status_label = map_user_status_label(is_active)

        if last_exec:
            last_status_label = map_execution_status_label(last_exec["status"])
        else:
            last_status_label = "Sin ejecuciones"

        profile = {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": row["email"],
            "role": row["role_name"],
            "isActive": is_active,
            "statusLabel": status_label,
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
            "lastLogin": row["last_login"].isoformat() if row["last_login"] else None,
        }

        summary = {
            "submissionsCount": row["submissions_count"] or 0,
            "executionsCount": row["executions_count"] or 0,
            "okExecutions": row["ok_executions"] or 0,
            "timeoutExecutions": row["timeout_executions"] or 0,
            "errorExecutions": row["error_executions"] or 0,
            "avgDurationMs": float(row["avg_duration_ms"])
            if row["avg_duration_ms"] is not None
            else None,
            "lastExecutionAt": row["last_execution_at"].isoformat()
            if row["last_execution_at"] is not None
            else None,
            "lastExecutionStatus": last_status_label,
        }

        return jsonify({"profile": profile, "summary": summary}), 200

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
    Lista paginada de ejecuciones del usuario autenticado.

    Parámetros de query:
      - status: 'Aprobado' | 'Rechazado' | 'Error' | 'all'
      - problem: filtro por título de submission (ej: 'LCS')
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplo:

      GET http://localhost:5000/api/profile/executions
      GET http://localhost:5000/api/profile/executions?status=Aprobado&page=1&page_size=10
      GET http://localhost:5000/api/profile/executions?problem=LCS
    """
    current_user = g.current_user
    user_id = current_user["id"]

    status_param = request.args.get("status", "all", type=str)
    problem = request.args.get("problem", "", type=str).strip().lower()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError("El parámetro 'page_size' debe estar entre 1 y 200.")

    # Mapear status de UI → status de BD
    execution_status_filter = None
    if status_param != "all":
        if status_param == "Aprobado":
            execution_status_filter = "ok"
        elif status_param == "Rechazado":
            execution_status_filter = "timeout"
        elif status_param == "Error":
            execution_status_filter = "runtime_error"
        else:
            raise BadRequestError("Valor inválido para 'status'.")

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Query base para ejecuciones del usuario actual
            base_sql = """
            FROM executions e
            JOIN submissions s ON s.id = e.submission_id
            LEFT JOIN hardware_profiles hp ON hp.id = e.hardware_profile_id
            WHERE s.user_id = %s
            """
            params = [user_id]

            if execution_status_filter:
                base_sql += " AND e.status = %s "
                params.append(execution_status_filter)

            if problem:
                base_sql += " AND LOWER(s.title) LIKE %s "
                params.append(f"%{problem}%")

            # 1) Total para paginación
            count_sql = "SELECT COUNT(*) AS total " + base_sql
            cur.execute(count_sql, params)
            total_row = cur.fetchone()
            total = (
                total_row["total"]
                if total_row and total_row["total"] is not None
                else 0
            )

            # 2) Items paginados
            data_sql = """
            SELECT
              e.id AS execution_id,
              e.submission_id,
              e.status AS raw_status,
              e.started_at,
              e.finished_at,
              e.duration_ms,
              s.title AS submission_title,
              hp.name AS hardware_name
            """ + base_sql + """
            ORDER BY e.started_at DESC NULLS LAST
            LIMIT %s OFFSET %s;
            """
            data_params = params + [page_size, offset]
            cur.execute(data_sql, data_params)
            rows = cur.fetchall()

        items = []
        for r in rows:
            label = map_execution_status_label(r["raw_status"])
            items.append(
                {
                    "executionId": r["execution_id"],
                    "submissionId": r["submission_id"],
                    "submissionTitle": r["submission_title"],
                    "status": label,
                    "rawStatus": r["raw_status"],
                    "startedAt": r["started_at"].isoformat()
                    if r["started_at"]
                    else None,
                    "finishedAt": r["finished_at"].isoformat()
                    if r["finished_at"]
                    else None,
                    "durationMs": r["duration_ms"],
                    "hardwareProfile": r["hardware_name"],
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
