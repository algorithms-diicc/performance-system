# server/webapp/routes/admin_access_requests_routes.py

import logging

from flask import Blueprint, request, jsonify, g

from ..utils.auth_decorators import login_required, admin_required
from ..utils.api_errors import (
    handle_api_errors,
    NotFoundError,
    BadRequestError,
    ValidationError,
)
from ..utils.db_utils import db_cursor
from ..services import mail_service


LOGGER = logging.getLogger(__name__)

admin_access_requests_bp = Blueprint(
    "admin_access_requests",
    __name__,
    url_prefix="/api/admin/access-requests",
)


# ============================================
# GET /api/admin/access-requests
# ============================================

@admin_access_requests_bp.route("", methods=["GET"])
@login_required
@admin_required
@handle_api_errors
def list_access_requests():
    """
    Lista paginada de solicitudes de acceso.

    Parámetros de query:
      - status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'all' (por defecto 'PENDING')
      - search: filtro por nombre/email/curso
      - page: página (1 por defecto)
      - page_size: tamaño de página (20 por defecto)

    Ejemplo (navegador):
      GET http://localhost:5000/api/admin/access-requests?status=PENDING

    Respuesta típica (200):
      {
        "items": [
          {
            "id": 10,
            "status": "PENDING",
            "user": {
              "id": 42,
              "fullName": "Juan Pérez",
              "email": "juan.perez@udec.cl",
              "roleName": "Student"
            },
            "professorEmail": "prof@inf.udec.cl",
            "courseCode": "INF-123",
            "message": "Quiero usar Performance System",
            "createdAt": "2025-11-20T10:33:12.123456",
            "resolvedAt": null,
            "resolvedBy": null
          }
        ],
        "summary": {
          "pending": 3,
          "approved": 5,
          "rejected": 1
        },
        "page": 1,
        "pageSize": 20,
        "total": 3
      }
    """
    status = request.args.get("status", "PENDING").upper()
    search = request.args.get("search", "", type=str).strip().lower()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    if page < 1:
        raise BadRequestError("El parámetro 'page' debe ser >= 1.")
    if page_size <= 0 or page_size > 200:
        raise BadRequestError("El parámetro 'page_size' debe estar entre 1 y 200.")

    # Validar status
    allowed_status = {"PENDING", "APPROVED", "REJECTED", "ALL"}
    if status not in allowed_status:
        raise BadRequestError("Valor inválido para 'status'.")

    offset = (page - 1) * page_size

    with db_cursor() as (conn, cur):
        # Base SQL
        base_sql = """
        FROM access_requests ar
        JOIN users u ON u.id = ar.user_id
        LEFT JOIN roles r ON r.id = ar.requested_role_id
        LEFT JOIN users admin ON admin.id = ar.resolved_by
        WHERE 1=1
        """

        params = []

        if status != "ALL":
            base_sql += " AND ar.status = %s "
            params.append(status)

        if search:
            base_sql += """
              AND (
                LOWER(u.full_name) LIKE %s OR
                LOWER(u.email) LIKE %s OR
                LOWER(ar.course_code) LIKE %s
              )
            """
            like = f"%{search}%"
            params.extend([like, like, like])

        # 1) Total para paginación
        count_sql = "SELECT COUNT(*) AS total " + base_sql
        cur.execute(count_sql, params)
        total_row = cur.fetchone()
        total = total_row["total"] if total_row and total_row["total"] is not None else 0

        # 2) Items paginados
        data_sql = """
        SELECT
          ar.id,
          ar.status,
          ar.professor_email,
          ar.course_code,
          ar.message,
          ar.created_at,
          ar.resolved_at,
          ar.resolved_by,
          u.id AS user_id,
          u.full_name,
          u.email,
          r.name AS role_name,
          admin.full_name AS resolved_by_name
        """ + base_sql + """
        ORDER BY
          CASE ar.status
            WHEN 'PENDING' THEN 0
            WHEN 'APPROVED' THEN 1
            WHEN 'REJECTED' THEN 2
            ELSE 3
          END,
          ar.created_at DESC
        LIMIT %s OFFSET %s;
        """

        data_params = params + [page_size, offset]
        cur.execute(data_sql, data_params)
        rows = cur.fetchall()

        # 3) Summary global por estado (para mostrar badges)
        cur.execute(
            """
            SELECT
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
              SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
            FROM access_requests;
            """
        )
        summary_row = cur.fetchone() or {
            "pending": 0,
            "approved": 0,
            "rejected": 0,
        }

    items = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "status": r["status"],
                "user": {
                    "id": r["user_id"],
                    "fullName": r["full_name"],
                    "email": r["email"],
                    "roleName": r["role_name"],
                },
                "professorEmail": r["professor_email"],
                "courseCode": r["course_code"],
                "message": r["message"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
                "resolvedAt": r["resolved_at"].isoformat() if r["resolved_at"] else None,
                "resolvedBy": {
                    "id": r["resolved_by"],
                    "fullName": r["resolved_by_name"],
                }
                if r["resolved_by"]
                else None,
            }
        )

    return jsonify(
        {
            "items": items,
            "summary": {
                "pending": summary_row["pending"] or 0,
                "approved": summary_row["approved"] or 0,
                "rejected": summary_row["rejected"] or 0,
            },
            "page": page,
            "pageSize": page_size,
            "total": total,
        }
    ), 200


# ============================================
# POST /api/admin/access-requests/<req_id>/approve
# ============================================

@admin_access_requests_bp.route("/<int:req_id>/approve", methods=["POST"])
@login_required
@admin_required
@handle_api_errors
def approve_access_request(req_id: int):
    """
    Aprueba una solicitud de acceso.

    Qué hace:
      - Verifica que la solicitud exista y esté en estado PENDING.
      - Marca access_requests.status = 'APPROVED',
        resolved_at = NOW(), resolved_by = admin actual.
      - Activa el usuario (users.is_active = TRUE).
      - Si requested_role_id no es NULL → setea ese rol.
      - Registra la acción en audit_log.

    Ejemplo (curl):
      curl -X POST \
        http://localhost:5000/api/admin/access-requests/10/approve \
        -b "session_id=<cookie_admin>"

    Respuesta (200):
      {
        "request": { ... },
        "user": { ... },
        "notification": {
          "email": {"sent": false, "status": "DISABLED"}
        }
      }
    """
    admin_user = g.current_user

    with db_cursor() as (conn, cur):
        # 1) Cargar solicitud + usuario asociado (lock FOR UPDATE)
        cur.execute(
            """
            SELECT
              ar.*,
              u.full_name,
              u.email,
              u.is_active,
              u.role_id AS current_role_id
            FROM access_requests ar
            JOIN users u ON u.id = ar.user_id
            WHERE ar.id = %s
            FOR UPDATE;
            """,
            (req_id,),
        )
        req = cur.fetchone()
        if req is None:
            raise NotFoundError(f"Solicitud con id {req_id} no existe.")

        if req["status"] != "PENDING":
            raise BadRequestError("La solicitud ya fue procesada.")

        user_id = req["user_id"]
        requested_role_id = req["requested_role_id"]

        # 2) Actualizar usuario: activar y opcionalmente ajustar rol
        cur.execute(
            """
            UPDATE users
            SET
              is_active = TRUE,
              role_id = COALESCE(%s, role_id)
            WHERE id = %s
            RETURNING id, full_name, email, role_id, is_active, created_at, last_login;
            """,
            (requested_role_id, user_id),
        )
        user_row = cur.fetchone()

        # 3) Actualizar solicitud
        cur.execute(
            """
            UPDATE access_requests
            SET
              status = 'APPROVED',
              resolved_at = NOW(),
              resolved_by = %s
            WHERE id = %s
            RETURNING *;
            """,
            (admin_user["id"], req_id),
        )
        updated_req = cur.fetchone()

        # 4) Registrar en audit_log
        description = (
            f"Solicitud de acceso #{req_id} APROBADA para el usuario "
            f"{user_row['email']} por {admin_user.get('email')}."
        )
        cur.execute(
            """
            INSERT INTO audit_log (user_id, action, description, created_at)
            VALUES (%s, %s, %s, NOW());
            """,
            (admin_user["id"], "approve_access_request", description),
        )

    # db_cursor confirma la aprobación antes de intentar el correo.
    try:
        email_notification = mail_service.send_access_approval_email(
            recipient_name=user_row["full_name"],
            recipient_email=user_row["email"],
        )
    except Exception as exc:
        # Defensa adicional: una falla inesperada de notificación nunca debe
        # convertir una aprobación confirmada en un error de la operación.
        LOGGER.warning(
            "Falló la notificación posterior a la aprobación (tipo=%s).",
            type(exc).__name__,
        )
        email_notification = {
            "sent": False,
            "status": mail_service.EMAIL_STATUS_FAILED,
        }

    # Adaptar respuesta
    request_json = {
        "id": updated_req["id"],
        "status": updated_req["status"],
        "userId": updated_req["user_id"],
        "requestedRoleId": updated_req["requested_role_id"],
        "professorEmail": updated_req["professor_email"],
        "courseCode": updated_req["course_code"],
        "message": updated_req["message"],
        "createdAt": updated_req["created_at"].isoformat()
        if updated_req.get("created_at")
        else None,
        "resolvedAt": updated_req["resolved_at"].isoformat()
        if updated_req.get("resolved_at")
        else None,
        "resolvedBy": updated_req["resolved_by"],
    }

    user_json = {
        "id": user_row["id"],
        "fullName": user_row["full_name"],
        "email": user_row["email"],
        "roleId": user_row["role_id"],
        "isActive": bool(user_row["is_active"]),
        "createdAt": user_row["created_at"].isoformat()
        if user_row.get("created_at")
        else None,
        "lastLogin": user_row["last_login"].isoformat()
        if user_row.get("last_login")
        else None,
    }

    return jsonify(
        {
            "request": request_json,
            "user": user_json,
            "notification": {
                "email": email_notification,
            },
        }
    ), 200


# ============================================
# POST /api/admin/access-requests/<req_id>/reject
# ============================================

@admin_access_requests_bp.route("/<int:req_id>/reject", methods=["POST"])
@login_required
@admin_required
@handle_api_errors
def reject_access_request(req_id: int):
    """
    Rechaza una solicitud de acceso.

    Qué hace:
      - Verifica que la solicitud exista y esté en estado PENDING.
      - Marca access_requests.status = 'REJECTED',
        resolved_at = NOW(), resolved_by = admin actual.
      - Garantiza que users.is_active = FALSE.
      - Registra la acción en audit_log.
      - Opcionalmente recibe un campo JSON "reason" para la bitácora.

    Ejemplo (curl):
      curl -X POST \
        http://localhost:5000/api/admin/access-requests/10/reject \
        -H "Content-Type: application/json" \
        -d '{"reason": "No pertenece al curso"}' \
        -b "session_id=<cookie_admin>"
    """
    admin_user = g.current_user
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip() or None

    with db_cursor() as (conn, cur):
        # 1) Cargar solicitud + usuario asociado (lock FOR UPDATE)
        cur.execute(
            """
            SELECT
              ar.*,
              u.full_name,
              u.email,
              u.is_active
            FROM access_requests ar
            JOIN users u ON u.id = ar.user_id
            WHERE ar.id = %s
            FOR UPDATE;
            """,
            (req_id,),
        )
        req = cur.fetchone()
        if req is None:
            raise NotFoundError(f"Solicitud con id {req_id} no existe.")

        if req["status"] != "PENDING":
            raise BadRequestError("La solicitud ya fue procesada.")

        user_id = req["user_id"]

        # 2) Asegurar que el usuario quede inactivo
        cur.execute(
            """
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s
            RETURNING id, full_name, email, role_id, is_active, created_at, last_login;
            """,
            (user_id,),
        )
        user_row = cur.fetchone()

        # 3) Actualizar solicitud
        cur.execute(
            """
            UPDATE access_requests
            SET
              status = 'REJECTED',
              resolved_at = NOW(),
              resolved_by = %s
            WHERE id = %s
            RETURNING *;
            """,
            (admin_user["id"], req_id),
        )
        updated_req = cur.fetchone()

        # 4) Registrar en audit_log
        base_description = (
            f"Solicitud de acceso #{req_id} RECHAZADA para el usuario "
            f"{user_row['email']} por {admin_user.get('email')}."
        )
        if reason:
            base_description += f" Motivo: {reason}"

        cur.execute(
            """
            INSERT INTO audit_log (user_id, action, description, created_at)
            VALUES (%s, %s, %s, NOW());
            """,
            (admin_user["id"], "reject_access_request", base_description),
        )

    request_json = {
        "id": updated_req["id"],
        "status": updated_req["status"],
        "userId": updated_req["user_id"],
        "requestedRoleId": updated_req["requested_role_id"],
        "professorEmail": updated_req["professor_email"],
        "courseCode": updated_req["course_code"],
        "message": updated_req["message"],
        "createdAt": updated_req["created_at"].isoformat()
        if updated_req.get("created_at")
        else None,
        "resolvedAt": updated_req["resolved_at"].isoformat()
        if updated_req.get("resolved_at")
        else None,
        "resolvedBy": updated_req["resolved_by"],
    }

    user_json = {
        "id": user_row["id"],
        "fullName": user_row["full_name"],
        "email": user_row["email"],
        "roleId": user_row["role_id"],
        "isActive": bool(user_row["is_active"]),
        "createdAt": user_row["created_at"].isoformat()
        if user_row.get("created_at")
        else None,
        "lastLogin": user_row["last_login"].isoformat()
        if user_row.get("last_login")
        else None,
    }

    return jsonify({"request": request_json, "user": user_json}), 200
