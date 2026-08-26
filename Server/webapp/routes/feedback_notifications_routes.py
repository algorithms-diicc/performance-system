"""Feedback docente por experimento y bandeja interna de notificaciones."""

from flask import Blueprint, g, jsonify, request
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..services.notification_service import notify_teacher_feedback
from ..services.submission_access_service import (
    SubmissionAccessForbidden,
    SubmissionAccessNotFound,
    assert_submission_viewer,
)
from ..utils.api_errors import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    handle_api_errors,
)
from ..utils.auth_decorators import (
    get_user_role_name,
    login_required,
    teacher_or_admin_required,
)


feedback_notifications_bp = Blueprint(
    "feedback_notifications",
    __name__,
    url_prefix="/api",
)

MAX_FEEDBACK_MESSAGE_CHARS = 2000
MAX_NOTIFICATION_PAGE_SIZE = 100
DEFAULT_NOTIFICATION_PAGE_SIZE = 25


def _iso(value):
    return value.isoformat() if value is not None else None


def _actor_role():
    role_name = getattr(g, "current_role_name", None)
    if role_name:
        return str(role_name)
    return str(get_user_role_name(g.current_user) or "")


def _assert_submission_access(submission_id, conn):
    try:
        return assert_submission_viewer(
            submission_id=submission_id,
            current_user_id=g.current_user["id"],
            current_role_name=_actor_role(),
            conn=conn,
        )
    except SubmissionAccessNotFound:
        raise NotFoundError(
            "El experimento solicitado no existe."
        )
    except SubmissionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a este experimento."
        )


def _parse_feedback_message():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequestError(
            "El cuerpo de la solicitud debe ser un objeto JSON."
        )

    if set(data) != {"message"}:
        raise BadRequestError(
            "El feedback docente sólo acepta el campo 'message'."
        )

    raw_message = data.get("message")
    if not isinstance(raw_message, str):
        raise BadRequestError(
            "El campo 'message' debe ser texto."
        )

    message = raw_message.strip()
    if not message:
        raise BadRequestError(
            "El feedback docente no puede estar vacío."
        )

    if len(message) > MAX_FEEDBACK_MESSAGE_CHARS:
        raise BadRequestError(
            "El feedback docente no puede superar 2000 caracteres."
        )

    return message


def _serialize_feedback(row):
    author_id = row.get("author_user_id")
    return {
        "id": int(row["id"]),
        "submissionId": int(row["submission_id"]),
        "message": row["message"],
        "createdAt": _iso(row.get("created_at")),
        "author": (
            {
                "id": int(author_id),
                "fullName": row.get("author_full_name"),
                "role": row.get("author_role_name"),
            }
            if author_id is not None
            else None
        ),
    }


def _serialize_notification(row):
    actor_id = row.get("actor_user_id")
    submission_id = row.get("submission_id")
    execution_id = row.get("execution_id")
    feedback_id = row.get("feedback_id")
    protocol_id = row.get("protocol_id")

    return {
        "id": int(row["id"]),
        "kind": row["kind"],
        "isRead": bool(row["is_read"]),
        "readAt": _iso(row.get("read_at")),
        "createdAt": _iso(row.get("created_at")),
        "actor": (
            {
                "id": int(actor_id),
                "fullName": row.get("actor_full_name"),
            }
            if actor_id is not None
            else None
        ),
        "submission": (
            {
                "id": int(submission_id),
                "title": row.get("submission_title"),
            }
            if submission_id is not None
            else None
        ),
        "execution": (
            {
                "id": int(execution_id),
                "publicId": row.get("execution_public_id"),
                "codename": row.get("execution_codename"),
                "errorCode": row.get("execution_error_code"),
            }
            if execution_id is not None
            else None
        ),
        "feedback": (
            {
                "id": int(feedback_id),
                "preview": (
                    str(row.get("feedback_message") or "")[:160]
                ),
            }
            if feedback_id is not None
            else None
        ),
        "protocol": (
            {
                "id": int(protocol_id),
                "title": row.get("protocol_title"),
                "course": {
                    "id": row.get("protocol_course_id"),
                    "code": row.get("protocol_course_code"),
                    "name": row.get("protocol_course_name"),
                },
            }
            if protocol_id is not None
            else None
        ),
    }


@feedback_notifications_bp.route(
    "/submissions/<int:submission_id>/feedback",
    methods=["GET"],
)
@handle_api_errors
@login_required
def list_submission_feedback(submission_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _assert_submission_access(submission_id, conn)
            cur.execute(
                """
                SELECT
                    f.id,
                    f.submission_id,
                    f.author_user_id,
                    f.message,
                    f.created_at,
                    u.full_name AS author_full_name,
                    r.name AS author_role_name
                FROM teacher_feedback f
                LEFT JOIN users u
                  ON u.id = f.author_user_id
                LEFT JOIN roles r
                  ON r.id = u.role_id
                WHERE f.submission_id = %s
                ORDER BY f.created_at ASC, f.id ASC;
                """,
                (submission_id,),
            )
            rows = cur.fetchall()

        return jsonify(
            {
                "items": [_serialize_feedback(row) for row in rows],
                "total": len(rows),
            }
        ), 200
    finally:
        conn.close()


@feedback_notifications_bp.route(
    "/submissions/<int:submission_id>/feedback",
    methods=["POST"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def create_submission_feedback(submission_id):
    message = _parse_feedback_message()
    conn = get_connection()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            access = _assert_submission_access(submission_id, conn)
            course_id = access.get("course_id")
            if course_id is None:
                raise BadRequestError(
                    "El feedback docente requiere un experimento asociado a un curso."
                )

            cur.execute(
                """
                INSERT INTO teacher_feedback (
                    submission_id,
                    author_user_id,
                    message,
                    created_at
                )
                VALUES (%s, %s, %s, NOW())
                RETURNING
                    id,
                    submission_id,
                    author_user_id,
                    message,
                    created_at;
                """,
                (
                    submission_id,
                    g.current_user["id"],
                    message,
                ),
            )
            row = cur.fetchone()
            row["author_full_name"] = g.current_user.get("full_name")
            row["author_role_name"] = _actor_role()

            notify_teacher_feedback(
                cur,
                feedback_id=row["id"],
                submission_id=submission_id,
                owner_user_id=access["owner_user_id"],
                actor_user_id=g.current_user["id"],
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
                    g.current_user["id"],
                    "create_teacher_feedback",
                    "Feedback docente #{} creado para Submission #{}.".format(
                        row["id"],
                        submission_id,
                    ),
                ),
            )

        conn.commit()
        return jsonify(
            {"feedback": _serialize_feedback(row)}
        ), 201
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@feedback_notifications_bp.route(
    "/notifications",
    methods=["GET"],
)
@handle_api_errors
@login_required
def list_notifications():
    page_size = request.args.get(
        "page_size",
        DEFAULT_NOTIFICATION_PAGE_SIZE,
        type=int,
    )
    if page_size < 1 or page_size > MAX_NOTIFICATION_PAGE_SIZE:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 100."
        )

    unread_raw = str(
        request.args.get("unread_only") or ""
    ).strip().casefold()
    if unread_raw not in {"", "0", "1", "false", "true"}:
        raise BadRequestError(
            "El parámetro 'unread_only' debe ser booleano."
        )
    unread_only = unread_raw in {"1", "true"}

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS unread_count
                FROM notifications
                WHERE user_id = %s
                  AND is_read = FALSE;
                """,
                (g.current_user["id"],),
            )
            count_row = cur.fetchone() or {"unread_count": 0}

            unread_sql = (
                "AND n.is_read = FALSE"
                if unread_only
                else ""
            )
            cur.execute(
                """
                SELECT
                    n.id,
                    n.kind,
                    n.submission_id,
                    n.execution_id,
                    n.feedback_id,
                    n.protocol_id,
                    n.actor_user_id,
                    n.is_read,
                    n.read_at,
                    n.created_at,

                    s.title AS submission_title,

                    e.public_id::text AS execution_public_id,
                    e.codename AS execution_codename,
                    e.error_code AS execution_error_code,

                    f.message AS feedback_message,

                    p.title AS protocol_title,
                    p.course_id AS protocol_course_id,
                    c.code AS protocol_course_code,
                    c.name AS protocol_course_name,

                    actor.full_name AS actor_full_name

                FROM notifications n
                LEFT JOIN submissions s
                  ON s.id = n.submission_id
                LEFT JOIN executions e
                  ON e.id = n.execution_id
                LEFT JOIN teacher_feedback f
                  ON f.id = n.feedback_id
                LEFT JOIN experimental_protocols p
                  ON p.id = n.protocol_id
                LEFT JOIN courses c
                  ON c.id = p.course_id
                LEFT JOIN users actor
                  ON actor.id = n.actor_user_id

                WHERE n.user_id = %s
                  {unread_sql}
                ORDER BY n.created_at DESC, n.id DESC
                LIMIT %s;
                """.format(unread_sql=unread_sql),
                (
                    g.current_user["id"],
                    page_size,
                ),
            )
            rows = cur.fetchall()

        return jsonify(
            {
                "items": [_serialize_notification(row) for row in rows],
                "unreadCount": int(count_row["unread_count"] or 0),
            }
        ), 200
    finally:
        conn.close()


@feedback_notifications_bp.route(
    "/notifications/<int:notification_id>/read",
    methods=["POST"],
)
@handle_api_errors
@login_required
def mark_notification_read(notification_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE notifications
                SET is_read = TRUE,
                    read_at = COALESCE(read_at, NOW())
                WHERE id = %s
                  AND user_id = %s
                RETURNING id, is_read, read_at;
                """,
                (
                    notification_id,
                    g.current_user["id"],
                ),
            )
            row = cur.fetchone()

        if row is None:
            raise NotFoundError(
                "La notificación no existe."
            )

        conn.commit()
        return jsonify(
            {
                "notification": {
                    "id": int(row["id"]),
                    "isRead": bool(row["is_read"]),
                    "readAt": _iso(row.get("read_at")),
                }
            }
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@feedback_notifications_bp.route(
    "/notifications/read-all",
    methods=["POST"],
)
@handle_api_errors
@login_required
def mark_all_notifications_read():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE notifications
                SET is_read = TRUE,
                    read_at = NOW()
                WHERE user_id = %s
                  AND is_read = FALSE
                RETURNING id;
                """,
                (g.current_user["id"],),
            )
            rows = cur.fetchall()

        conn.commit()
        return jsonify(
            {"updated": len(rows)}
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
