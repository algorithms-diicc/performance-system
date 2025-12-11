# server/webapp/routes/admin_users_routes.py

from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection  # conexión a PostgreSQL
from ..utils.auth_decorators import login_required, admin_required
from ..utils.api_errors import handle_api_errors, NotFoundError, BadRequestError

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/api/admin")


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
    return raw_status  # fallback: mostramos tal cual


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
    Lista consolidada de usuarios + resumen de actividad.

    Devuelve:
      - items: lista de usuarios con métricas agregadas
      - summary: totales para los badges (total, activos, bloqueados, inactivos)
      - page, pageSize: para futura paginación

    V1:
      - Cargamos hasta page_size usuarios y filtramos en frontend.
      - El estado de usuario se basa en users.is_active (boolean).

    Ejemplo (navegador):

      GET http://localhost:5000/api/admin/users

    Si estás logueado como Admin → JSON con items y summary.
    Si no → 401 / 403 con error estándar.
    """

    # Parámetros de query (para futura V2 con filtros en servidor)
    search = request.args.get("search", "", type=str).strip().lower()
    role = request.args.get("role", "all", type=str)
    status = request.args.get("status", "all", type=str)  # "Activo" / "Inactivo" / "Bloqueado"
    sort_by = request.args.get("sort_by", "lastActivity", type=str)
    sort_dir = request.args.get("sort_dir", "desc", type=str)
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 1000, type=int)  # V1: carga grande

    if page < 1:
        page = 1
    if page_size <= 0 or page_size > 10000:
        page_size = 1000

    # Mapa de campos de orden
    sort_map = {
        "name": "u.full_name",
        "createdAt": "u.created_at",
        "lastActivity": "last_execution_at",  # calculado con MAX(s.created_at)
    }
    order_column = sort_map.get(sort_by, "last_execution_at")
    order_dir = "ASC" if sort_dir.lower() == "asc" else "DESC"

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # ==========================
            # 1) Query principal
            # ==========================
            sql = """
            WITH user_submissions AS (
              SELECT
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                u.created_at,
                r.name AS role_name,
                COUNT(s.id) AS submissions_count,
                SUM(CASE WHEN s.status = 'OK'  THEN 1 ELSE 0 END) AS passed_count,
                SUM(CASE WHEN s.status = 'ERR' THEN 1 ELSE 0 END) AS failed_count,
                MAX(s.created_at) AS last_execution_at
              FROM users u
              LEFT JOIN roles r ON r.id = u.role_id
              LEFT JOIN submissions s ON s.user_id = u.id
              WHERE 1=1
            """

            params = []

            # --- Filtro por búsqueda (nombre/correo) ---
            if search:
                sql += " AND (LOWER(u.full_name) LIKE %s OR LOWER(u.email) LIKE %s) "
                like = f"%{search}%"
                params.extend([like, like])

            # --- Filtro por rol ---
            if role and role != "all":
                sql += " AND r.name = %s "
                params.append(role)

            # --- Filtro por estado de usuario (is_active) ---
            # Mapeamos los textos de la UI a booleanos de BD
            if status and status != "all":
                if status == "Activo":
                    sql += " AND u.is_active = TRUE "
                elif status == "Inactivo":
                    sql += " AND u.is_active = FALSE "
                elif status == "Bloqueado":
                    # Todavía no hay columna de bloqueado: por ahora lo ignoramos
                    pass

            sql += """
              GROUP BY u.id, u.full_name, u.email, u.is_active, u.created_at, r.name
            )
            SELECT
              id,
              full_name,
              email,
              is_active,
              role_name,
              created_at,
              submissions_count,
              passed_count,
              failed_count,
              last_execution_at
            FROM user_submissions
            ORDER BY """ + order_column + " " + order_dir + " NULLS LAST " + """
            LIMIT %s OFFSET %s;
            """

            params.extend([page_size, offset])

            cur.execute(sql, params)
            rows = cur.fetchall()

        # ==========================
        # 2) Summary (totales)
        # ==========================
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  COUNT(*) AS total,
                  SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active,
                  SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) AS inactive,
                  0 AS blocked  -- por ahora sin soporte real para bloqueados
                FROM users;
                """
            )
            summary_row = cur.fetchone() or {
                "total": 0,
                "active": 0,
                "inactive": 0,
                "blocked": 0,
            }

        # ==========================
        # 3) Adaptar al formato frontend
        # ==========================
        items = []
        for r in rows:
            submissions_count = r["submissions_count"] or 0
            passed_count = r["passed_count"] or 0
            failed_count = r["failed_count"] or 0

            is_active = bool(r["is_active"]) if r["is_active"] is not None else False
            user_status = map_user_status_label(is_active)

            # "lastExecutionStatus" derivado (muy simple, sólo para badge)
            if submissions_count == 0:
                last_status = "Sin ejecuciones"
            elif failed_count > 0 and passed_count == 0:
                last_status = "Falló"
            elif passed_count > 0 and failed_count == 0:
                last_status = "OK"
            elif passed_count > 0 and failed_count > 0:
                last_status = "Mixto"
            else:
                last_status = "Desconocido"

            items.append(
                {
                    "id": r["id"],
                    "name": r["full_name"],
                    "email": r["email"],
                    "role": r["role_name"],
                    "status": user_status,  # ← string para la tabla
                    "createdAt": (
                        r["created_at"].isoformat()
                        if r["created_at"] is not None
                        else None
                    ),
                    "submissionsCount": submissions_count,
                    "passedCount": passed_count,
                    "failedCount": failed_count,
                    "lastExecutionStatus": last_status,
                    "lastExecutionAt": (
                        r["last_execution_at"].isoformat()
                        if r["last_execution_at"] is not None
                        else None
                    ),
                }
            )

        response = {
            "items": items,
            "summary": {
                "total": summary_row["total"],
                "active": summary_row["active"],
                "inactive": summary_row["inactive"],
                "blocked": summary_row["blocked"],
            },
            "page": page,
            "pageSize": page_size,
        }
        return jsonify(response), 200

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
    Devuelve el perfil consolidado de un usuario para la vista AdminUserDetail.

    Incluye:
      - profile: datos básicos (id, nombre, email, rol, activo, created_at, last_login)
      - summary: resumen de actividad (submissions, ejecuciones, promedio duración, etc.)

    Ejemplo (navegador):

      GET http://localhost:5000/api/admin/users/15
    """

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) Perfil + agregados de submissions / executions
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

            if row is None:
                # Usuario no existe
                raise NotFoundError(f"Usuario con id {user_id} no existe.")

            # 2) Obtener status de la última ejecución (para etiqueta)
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

        # === Adaptar respuesta ===
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
# GET /api/admin/users/<user_id>/executions  (TABLA EJECUCIONES)
# ==========================

@admin_users_bp.route("/users/<int:user_id>/executions", methods=["GET"])
@handle_api_errors
@login_required
@admin_required
def get_admin_user_executions(user_id: int):
    """
    Lista paginada de ejecuciones de un usuario para la tabla de AdminUserDetail.

    Parámetros de query:
      - status: 'Aprobado' | 'Rechazado' | 'Error' | 'all'
      - problem: filtro por título de submission (ej: 'LCS')
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplo:

      GET http://localhost:5000/api/admin/users/15/executions?status=Aprobado&problem=LCS&page=1&page_size=10
    """

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
            # 1) Verificar que el usuario exista
            cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
            user_row = cur.fetchone()
            if user_row is None:
                raise NotFoundError(f"Usuario con id {user_id} no existe.")

            # 2) Query base para ejecuciones
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

            # 2.a) Total para paginación
            count_sql = "SELECT COUNT(*) AS total " + base_sql
            cur.execute(count_sql, params)
            total_row = cur.fetchone()
            total = (
                total_row["total"]
                if total_row and total_row["total"] is not None
                else 0
            )

            # 2.b) Items paginados
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
    Lista paginada de submissions de un usuario para el tab 'Submissions'
    de la vista AdminUserDetail.

    Parámetros de query:
      - problem: filtro por título de submission (texto libre)
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)
    """

    problem = request.args.get("problem", "", type=str).strip().lower()
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

            # ==========================
            # 2) Base SQL (submissions + agregados de ejecuciones)
            # ==========================
            base_sql = """
            FROM submissions s
            LEFT JOIN executions e ON e.submission_id = s.id
            WHERE s.user_id = %s
            """
            params = [user_id]

            if problem:
                base_sql += " AND LOWER(s.title) LIKE %s "
                params.append(f"%{problem}%")

            # 2.a) Total de submissions (DISTINCT s.id)
            count_sql = "SELECT COUNT(DISTINCT s.id) AS total " + base_sql
            cur.execute(count_sql, params)
            total_row = cur.fetchone()
            total = total_row["total"] if total_row and total_row["total"] else 0

            # 2.b) Datos paginados + agregados de ejecuciones
            data_sql = """
            SELECT
              s.id,
              s.title,
              s.created_at,
              SUM(CASE WHEN e.status = 'ok' THEN 1 ELSE 0 END)          AS ok_executions,
              SUM(CASE WHEN e.status = 'timeout' THEN 1 ELSE 0 END)     AS timeout_executions,
              SUM(CASE WHEN e.status = 'runtime_error' THEN 1 ELSE 0 END) AS error_executions
            """ + base_sql + """
            GROUP BY
              s.id, s.title, s.created_at
            ORDER BY s.created_at DESC NULLS LAST
            LIMIT %s OFFSET %s;
            """

            data_params = params + [page_size, offset]
            cur.execute(data_sql, data_params)
            rows = cur.fetchall()

        # ==========================
        # 3) Adaptar respuesta para el front
        # ==========================
        items = []
        for r in rows:
            ok_count = r["ok_executions"] or 0
            timeout_count = r["timeout_executions"] or 0
            error_count = r["error_executions"] or 0

            status_label = map_submission_status_from_counts(
                ok_count, timeout_count, error_count
            )

            items.append(
                {
                    "id": r["id"],
                    "title": r["title"],
                    # Por ahora usamos el mismo título como "problema" visual.
                    "problem": r["title"],
                    "status": status_label,
                    "createdAt": r["created_at"].isoformat()
                    if r["created_at"]
                    else None,
                    "okExecutions": ok_count,
                    "timeoutExecutions": timeout_count,
                    "errorExecutions": error_count,
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
    Devuelve el detalle de una ejecución concreta, visto desde el contexto Admin.

    Es un alias administrativo de /api/executions/<id>, pero:
      - No verifica que el usuario actual sea el dueño de la submission.
      - Requiere rol Admin (@admin_required).

    Respuesta (200, formato compatible con get_execution_detail de submissions_routes):
      {
        "execution": {
          "id": 123,
          "submissionId": 10,
          "status": "ok",
          "statusLabel": "Aprobado",
          "startedAt": "...",
          "finishedAt": "...",
          "durationMs": 183,
          "hardwareProfile": "Lab EdD piso 2",
          "submissionTitle": "LCS - solución final"
        }
      }
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  e.id,
                  e.submission_id,
                  e.status AS raw_status,
                  e.started_at,
                  e.finished_at,
                  e.duration_ms,
                  hp.name AS hardware_name,
                  s.user_id,
                  s.title AS submission_title
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
                LEFT JOIN hardware_profiles hp ON hp.id = e.hardware_profile_id
                WHERE e.id = %s;
                """,
                (execution_id,),
            )
            row = cur.fetchone()

            if row is None:
                raise NotFoundError(f"Ejecución con id {execution_id} no existe.")

        status_label = map_execution_status_label(row["raw_status"])

        execution = {
            "id": row["id"],
            "submissionId": row["submission_id"],
            "status": row["raw_status"],
            "statusLabel": status_label,
            "startedAt": row["started_at"].isoformat()
            if row.get("started_at")
            else None,
            "finishedAt": row["finished_at"].isoformat()
            if row.get("finished_at")
            else None,
            "durationMs": row.get("duration_ms"),
            "hardwareProfile": row.get("hardware_name"),
            "submissionTitle": row.get("submission_title"),
        }

        return jsonify({"execution": execution}), 200

    finally:
        conn.close()
