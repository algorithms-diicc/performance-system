# server/webapp/routes/submissions_routes.py

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection  # conexión a PostgreSQL
from ..utils.db_utils import db_cursor
from ..utils.auth_decorators import login_required
from ..utils.api_errors import (
    handle_api_errors,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    BadRequestError,
)

# Usamos el mismo blueprint para /api/submissions y /api/executions
submissions_bp = Blueprint("submissions", __name__, url_prefix="/api")


# ==========================
# Helpers de mapeo de estados
# ==========================

def map_submission_status_label(raw_status: str) -> str:
    """
    Mapea el status crudo de submissions.status a algo entendible en UI.

    - 'QUEUED' / 'PENDING'   -> 'En cola'
    - 'RUNNING'              -> 'En ejecución'
    - 'OK'                   -> 'Aprobado'
    - 'ERR' / 'ERROR'        -> 'Error'
    - otros / None           -> 'Desconocido'
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


def map_execution_status_label(raw_status: str) -> str:
    """
    Mapea el status crudo de executions.status a etiqueta de UI.

    - 'ok'             -> 'Aprobado'
    - 'timeout'        -> 'Rechazado'
    - 'runtime_error'  -> 'Error'
    - otros / None     -> 'Desconocido'
    """
    if not raw_status:
        return "Desconocido"

    s = str(raw_status).lower()
    if s == "ok":
        return "Aprobado"
    if s == "timeout":
        return "Rechazado"
    if s == "runtime_error":
        return "Error"
    return raw_status


# ==========================
# GET /api/submissions
# ==========================

@submissions_bp.route("/submissions", methods=["GET"])
@login_required
@handle_api_errors
def list_my_submissions():
    """
    Lista paginada de submissions del usuario actual.

    Pensado para la vista principal de historial del estudiante/docente
    (no la vista de Admin, que usa /api/admin/users/...).

    Parámetros de query:
      - page: número de página (1 por defecto)
      - page_size: tamaño de página (20 por defecto, máx 200)

    Ejemplo (navegador, estando logueado):
      GET http://localhost:5000/api/submissions?page=1&page_size=10

    Respuesta (200):
      {
        "items": [
          {
            "id": 5,
            "title": "LCS - solución final",
            "status": "OK",
            "statusLabel": "Aprobado",
            "createdAt": "2025-11-18T02:45:00.530525",
            "executionsCount": 3,
            "lastExecutionStatus": "Aprobado",
            "lastExecutionAt": "2025-11-18T03:00:10.000000"
          },
          ...
        ],
        "page": 1,
        "pageSize": 10,
        "total": 7
      }
    """
    user = g.current_user

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
            # 1) Total de submissions del usuario
            cur.execute(
                "SELECT COUNT(*) AS total FROM submissions WHERE user_id = %s;",
                (user["id"],),
            )
            total_row = cur.fetchone() or {"total": 0}
            total = total_row["total"] or 0

            # 2) Datos paginados con resumen de ejecuciones
            #    Usamos un CTE para obtener la última ejecución por submission.
            sql = """
            WITH last_exec AS (
              SELECT DISTINCT ON (e.submission_id)
                e.submission_id,
                e.status,
                e.finished_at
              FROM executions e
              JOIN submissions s2 ON s2.id = e.submission_id
              WHERE s2.user_id = %s
              ORDER BY e.submission_id, e.finished_at DESC NULLS LAST
            )
            SELECT
              s.id,
              s.title,
              s.status,
              s.created_at,
              COALESCE(le.status, NULL)      AS last_execution_status,
              COALESCE(le.finished_at, NULL) AS last_execution_at,
              COUNT(e.id)                    AS executions_count
            FROM submissions s
            LEFT JOIN executions e ON e.submission_id = s.id
            LEFT JOIN last_exec le ON le.submission_id = s.id
            WHERE s.user_id = %s
            GROUP BY
              s.id, s.title, s.status, s.created_at,
              le.status, le.finished_at
            ORDER BY s.created_at DESC
            LIMIT %s OFFSET %s;
            """
            cur.execute(sql, (user["id"], user["id"], page_size, offset))
            rows = cur.fetchall()

        items = []
        for r in rows:
            status_label = map_submission_status_label(r["status"])
            last_status_label = (
                map_execution_status_label(r["last_execution_status"])
                if r["last_execution_status"] is not None
                else "Sin ejecuciones"
            )

            items.append(
                {
                    "id": r["id"],
                    "title": r.get("title"),
                    "status": r.get("status"),
                    "statusLabel": status_label,
                    "createdAt": r["created_at"].isoformat()
                    if r.get("created_at")
                    else None,
                    "executionsCount": r["executions_count"] or 0,
                    "lastExecutionStatus": last_status_label,
                    "lastExecutionAt": r["last_execution_at"].isoformat()
                    if r.get("last_execution_at")
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
# POST /api/submissions
# ==========================

@submissions_bp.route("/submissions", methods=["POST"])
@login_required
@handle_api_errors
def create_submission():
    """
    Crea un nuevo registro en la tabla submissions para el usuario actual.

    ⚠️ Versión *mínima* a nivel de BD:
       - Inserta sólo user_id, title, status, created_at.
       - No maneja todavía el archivo ZIP ni la cola real hacia el Slave.
       - Más adelante puedes extenderla (problem_id, language, parámetros…).

    Ejemplo (curl):
      curl -X POST http://localhost:5000/api/submissions \\
        -H "Content-Type: application/json" \\
        --cookie "session_id=..." \\
        -d '{
          "title": "LCS - intento 3"
        }'

    Respuesta (201):
      {
        "id": 12,
        "title": "LCS - intento 3",
        "status": "QUEUED",
        "statusLabel": "En cola",
        "createdAt": "2025-11-18T11:20:00.000000"
      }
    """
    user = g.current_user
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()

    if not title:
        raise ValidationError(
            "Debe indicar un título para la entrega.",
            extra={"field": "title"},
        )

    # Ajusta este estado según tu modelo real ('PENDING', etc.)
    initial_status = "QUEUED"

    with db_cursor() as (conn, cur):
        cur.execute(
            """
            INSERT INTO submissions (user_id, title, status, created_at)
            VALUES (%s, %s, %s, NOW())
            RETURNING id, user_id, title, status, created_at;
            """,
            (user["id"], title, initial_status),
        )
        row = cur.fetchone()

        status_label = map_submission_status_label(row["status"])

        return jsonify(
            {
                "id": row["id"],
                "title": row["title"],
                "status": row["status"],
                "statusLabel": status_label,
                "createdAt": row["created_at"].isoformat()
                if row.get("created_at")
                else None,
            }
        ), 201


# ==========================
# GET /api/submissions/<id>
# ==========================

@submissions_bp.route("/submissions/<int:submission_id>", methods=["GET"])
@login_required
@handle_api_errors
def get_submission_detail(submission_id: int):
    """
    Obtiene datos básicos de una submission + resumen de sus ejecuciones.

    Reglas de acceso:
      - El propietario (user_id == current_user.id) puede ver su envío.
      - Más adelante se puede ampliar para permitir acceso a Admin.

    Ejemplo:
      GET http://localhost:5000/api/submissions/10

    Respuesta (200):
      {
        "submission": {
          "id": 10,
          "title": "LCS - solución final",
          "status": "OK",
          "statusLabel": "Aprobado",
          "createdAt": "2025-11-18T02:45:00.530525"
        },
        "summary": {
          "executionsCount": 5,
          "okExecutions": 3,
          "timeoutExecutions": 1,
          "errorExecutions": 1,
          "lastExecutionAt": "2025-11-18T03:00:10.000000",
          "lastExecutionStatus": "Aprobado"
        }
      }
    """
    user = g.current_user
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) Cargar submission
            cur.execute(
                """
                SELECT
                  s.id,
                  s.user_id,
                  s.title,
                  s.status,
                  s.created_at
                FROM submissions s
                WHERE s.id = %s;
                """,
                (submission_id,),
            )
            srow = cur.fetchone()
            if srow is None:
                raise NotFoundError(f"Submission con id {submission_id} no existe.")

            if srow["user_id"] != user["id"]:
                raise ForbiddenError("No tienes permiso para ver este envío.")

            # 2) Agregados de ejecuciones
            cur.execute(
                """
                SELECT
                  COUNT(*) AS executions_count,
                  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_executions,
                  SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) AS timeout_executions,
                  SUM(CASE WHEN status = 'runtime_error' THEN 1 ELSE 0 END) AS error_executions,
                  MAX(finished_at) AS last_execution_at
                FROM executions
                WHERE submission_id = %s;
                """,
                (submission_id,),
            )
            agg = cur.fetchone() or {}

            # 3) Última ejecución para obtener el status real
            last_status_label = "Sin ejecuciones"
            if agg.get("last_execution_at"):
                cur.execute(
                    """
                    SELECT status
                    FROM executions
                    WHERE submission_id = %s
                    ORDER BY finished_at DESC NULLS LAST
                    LIMIT 1;
                    """,
                    (submission_id,),
                )
                last = cur.fetchone()
                if last:
                    last_status_label = map_execution_status_label(last["status"])

        status_label = map_submission_status_label(srow["status"])

        submission = {
            "id": srow["id"],
            "title": srow["title"],
            "status": srow["status"],
            "statusLabel": status_label,
            "createdAt": srow["created_at"].isoformat()
            if srow.get("created_at")
            else None,
        }

        summary = {
            "executionsCount": agg.get("executions_count") or 0,
            "okExecutions": agg.get("ok_executions") or 0,
            "timeoutExecutions": agg.get("timeout_executions") or 0,
            "errorExecutions": agg.get("error_executions") or 0,
            "lastExecutionAt": agg.get("last_execution_at").isoformat()
            if agg.get("last_execution_at")
            else None,
            "lastExecutionStatus": last_status_label,
        }

        return jsonify(
            {
                "submission": submission,
                "summary": summary,
            }
        ), 200

    finally:
        conn.close()


# ==========================
# GET /api/submissions/<id>/executions
# ==========================

@submissions_bp.route("/submissions/<int:submission_id>/executions", methods=["GET"])
@login_required
@handle_api_errors
def get_submission_executions(submission_id: int):
    """
    Lista paginada de ejecuciones asociadas a una submission.

    Parámetros de query:
      - status: 'Aprobado' | 'Rechazado' | 'Error' | 'all'
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplo:
      GET http://localhost:5000/api/submissions/10/executions?page=1&page_size=10

    Respuesta (200):
      {
        "items": [
          {
            "executionId": 123,
            "status": "Aprobado",
            "rawStatus": "ok",
            "startedAt": "2025-11-10T15:39:00",
            "finishedAt": "2025-11-10T15:39:00",
            "durationMs": 183,
            "hardwareProfile": "Lab EdD piso 2"
          },
          ...
        ],
        "page": 1,
        "pageSize": 10,
        "total": 4
      }
    """
    user = g.current_user

    status_param = request.args.get("status", "all", type=str)
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
            # 1) Verificar que la submission exista y sea del usuario
            cur.execute(
                "SELECT id, user_id FROM submissions WHERE id = %s;",
                (submission_id,),
            )
            srow = cur.fetchone()
            if srow is None:
                raise NotFoundError(f"Submission con id {submission_id} no existe.")
            if srow["user_id"] != user["id"]:
                raise ForbiddenError("No tienes permiso para ver este envío.")

            # 2) Base SQL
            base_sql = """
            FROM executions e
            LEFT JOIN hardware_profiles hp ON hp.id = e.hardware_profile_id
            WHERE e.submission_id = %s
            """
            params = [submission_id]

            if execution_status_filter:
                base_sql += " AND e.status = %s "
                params.append(execution_status_filter)

            # 2.a) Total
            count_sql = "SELECT COUNT(*) AS total " + base_sql
            cur.execute(count_sql, params)
            total_row = cur.fetchone() or {"total": 0}
            total = total_row["total"] or 0

            # 2.b) Datos paginados
            data_sql = """
            SELECT
              e.id AS execution_id,
              e.status AS raw_status,
              e.started_at,
              e.finished_at,
              e.duration_ms,
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
                    "status": label,
                    "rawStatus": r["raw_status"],
                    "startedAt": r["started_at"].isoformat()
                    if r.get("started_at")
                    else None,
                    "finishedAt": r["finished_at"].isoformat()
                    if r.get("finished_at")
                    else None,
                    "durationMs": r.get("duration_ms"),
                    "hardwareProfile": r.get("hardware_name"),
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
# POST /api/submissions/<id>/rerun
# ==========================

@submissions_bp.route("/submissions/<int:submission_id>/rerun", methods=["POST"])
@login_required
@handle_api_errors
def rerun_submission(submission_id: int):
    """
    Solicita una re-ejecución de una submission.

    Versión actual (simplificada):
      - Verifica que la submission existe y es del usuario.
      - Registra la intención en audit_log (action = 'rerun_submission').
      - NO crea todavía registros reales en executions (eso se integrará con el Slave).

    Ejemplo:
      POST http://localhost:5000/api/submissions/10/rerun
      Cookie: session_id=...

      Respuesta (202):
      {
        "message": "Re-ejecución solicitada.",
        "submissionId": 10
      }
    """
    user = g.current_user

    with db_cursor() as (conn, cur):
        # 1) Verificar que la submission exista y sea del usuario
        cur.execute(
            "SELECT id, user_id FROM submissions WHERE id = %s;",
            (submission_id,),
        )
        srow = cur.fetchone()
        if srow is None:
            raise NotFoundError(f"Submission con id {submission_id} no existe.")
        if srow["user_id"] != user["id"]:
            raise ForbiddenError("No tienes permiso para re-ejecutar este envío.")

        # 2) Registrar en audit_log
        cur.execute(
            """
            INSERT INTO audit_log (user_id, action, description, created_at)
            VALUES (%s, %s, %s, NOW());
            """,
            (
                user["id"],
                "rerun_submission",
                f"Usuario solicitó re-ejecución de submission_id={submission_id}",
            ),
        )

        # TODO: aquí más adelante se puede insertar en una cola o en executions
        # con status 'queued' para que el Slave lo procese.

        return jsonify(
            {
                "message": "Re-ejecución solicitada.",
                "submissionId": submission_id,
            }
        ), 202


# ==========================
# GET /api/executions/<id>
# ==========================

@submissions_bp.route("/executions/<int:execution_id>", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_detail(execution_id: int):
    """
    Devuelve el detalle de una ejecución concreta.

    Incluye:
      - datos básicos de la ejecución (status, tiempos, hardware_profile)
      - datos básicos de la submission asociada (title)
      - (opcional) en el futuro un resumen de métricas.

    Reglas de acceso:
      - Sólo el dueño de la submission asociada puede ver la ejecución.

    Ejemplo:
      GET http://localhost:5000/api/executions/123

      Respuesta (200, ejemplo mínimo):
      {
        "execution": {
          "id": 123,
          "submissionId": 10,
          "status": "ok",
          "statusLabel": "Aprobado",
          "startedAt": "2025-11-10T15:39:00",
          "finishedAt": "2025-11-10T15:39:00",
          "durationMs": 183,
          "hardwareProfile": "Lab EdD piso 2",
          "submissionTitle": "LCS - solución final"
        }
      }
    """
    user = g.current_user
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

            if row["user_id"] != user["id"]:
                raise ForbiddenError("No tienes permiso para ver esta ejecución.")

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
