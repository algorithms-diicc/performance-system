# server/webapp/routes/admin_audit_log_routes.py

from datetime import datetime

from flask import Blueprint, request, jsonify

from ..utils.auth_decorators import login_required, admin_required
from ..utils.api_errors import handle_api_errors, BadRequestError
from ..utils.db_utils import db_cursor

admin_audit_log_bp = Blueprint(
    "admin_audit_log",
    __name__,
    url_prefix="/api/admin/audit-log",
)


def _parse_iso_datetime(value: str, field_name: str):
    """
    Parsea una fecha/hora en formato ISO simple.

    Aceptamos típicamente:
      - '2025-11-20'
      - '2025-11-20T10:30:00'

    Si es inválida → BadRequestError.
    """
    if not value:
        return None
    try:
        # Si viene sólo fecha (YYYY-MM-DD), datetime la interpreta igual
        return datetime.fromisoformat(value)
    except ValueError:
        raise BadRequestError(
            f"El parámetro '{field_name}' debe estar en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS)."
        )


@admin_audit_log_bp.route("", methods=["GET"])
@login_required
@admin_required
@handle_api_errors
def list_audit_log():
    """
    Lista global de audit_log con filtros.

    Parámetros de query:
      - user_id: filtra por usuario específico (opcional)
      - action: filtra por tipo de acción exacta (opcional)
      - from: fecha/hora mínima (ISO) para created_at (opcional)
      - to: fecha/hora máxima (ISO) para created_at (opcional)
      - page: página (1 por defecto)
      - page_size: tamaño página (20 por defecto)

    Ejemplos (navegador):

      1) Ver últimos registros de todos:
         GET http://localhost:5000/api/admin/audit-log

      2) Filtrar por usuario:
         GET http://localhost:5000/api/admin/audit-log?user_id=42

      3) Filtrar por rango de fechas:
         GET http://localhost:5000/api/admin/audit-log?from=2025-11-01&to=2025-11-30

      4) Filtrar por acción:
         GET http://localhost:5000/api/admin/audit-log?action=approve_access_request

    Respuesta 200:
      {
        "items": [
          {
            "id": 101,
            "userId": 1,
            "userName": "Admin INF",
            "userEmail": "admin@inf.udec.cl",
            "action": "approve_access_request",
            "description": "Solicitud de acceso #10 APROBADA ...",
            "createdAt": "2025-11-20T10:45:00.123456"
          },
          ...
        ],
        "page": 1,
        "pageSize": 20,
        "total": 57
      }
    """
    user_id = request.args.get("user_id", type=int)
    action = request.args.get("action", "", type=str).strip() or None
    from_raw = request.args.get("from", "", type=str).strip() or None
    to_raw = request.args.get("to", "", type=str).strip() or None
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError("El parámetro 'page_size' debe estar entre 1 y 200.")

    from_dt = _parse_iso_datetime(from_raw, "from") if from_raw else None
    to_dt = _parse_iso_datetime(to_raw, "to") if to_raw else None

    offset = (page - 1) * page_size

    with db_cursor() as (conn, cur):
        base_sql = """
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE 1=1
        """

        params = []

        if user_id is not None:
            base_sql += " AND al.user_id = %s "
            params.append(user_id)

        if action:
            base_sql += " AND al.action = %s "
            params.append(action)

        if from_dt:
            base_sql += " AND al.created_at >= %s "
            params.append(from_dt)

        if to_dt:
            base_sql += " AND al.created_at <= %s "
            params.append(to_dt)

        # 1) Total para paginación
        count_sql = "SELECT COUNT(*) AS total " + base_sql
        cur.execute(count_sql, params)
        total_row = cur.fetchone()
        total = total_row["total"] if total_row and total_row["total"] is not None else 0

        # 2) Items paginados
        data_sql = """
        SELECT
          al.id,
          al.user_id,
          al.action,
          al.description,
          al.created_at,
          u.full_name,
          u.email
        """ + base_sql + """
        ORDER BY al.created_at DESC
        LIMIT %s OFFSET %s;
        """

        data_params = params + [page_size, offset]
        cur.execute(data_sql, data_params)
        rows = cur.fetchall()

    items = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "userId": r["user_id"],
                "userName": r["full_name"],
                "userEmail": r["email"],
                "action": r["action"],
                "description": r["description"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
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
