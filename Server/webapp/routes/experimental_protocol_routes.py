"""API de protocolos experimentales asociados a cursos."""

from flask import Blueprint, g, jsonify, request
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..services.notification_service import (
    notify_protocol_published,
)
from ..services.experimental_protocol_service import (
    InvalidProtocolConfiguration,
    normalize_protocol_configuration,
    protocol_row_as_configuration,
)
from ..utils.api_errors import (
    BadRequestError,
    NotFoundError,
    handle_api_errors,
)
from ..utils.auth_decorators import (
    get_user_role_name,
    login_required,
    role_required,
    teacher_or_admin_required,
)


experimental_protocols_bp = Blueprint(
    "experimental_protocols",
    __name__,
    url_prefix="/api",
)


def _iso(value):
    return value.isoformat() if value is not None else None


def _actor_role():
    role_name = getattr(g, "current_role_name", None)
    if role_name:
        return str(role_name)
    return str(get_user_role_name(g.current_user) or "")


def _serialize_protocol(row):
    config = protocol_row_as_configuration(row)
    state = (
        "INACTIVE"
        if not row["is_active"]
        else "PUBLISHED"
        if row["is_published"]
        else "DRAFT"
    )
    return {
        "id": int(row["id"]),
        "courseId": int(row["course_id"]),
        **config,
        "isPublished": bool(row["is_published"]),
        "isActive": bool(row["is_active"]),
        "state": state,
        "publishedAt": _iso(row.get("published_at")),
        "deactivatedAt": _iso(row.get("deactivated_at")),
        "createdAt": _iso(row.get("created_at")),
        "updatedAt": _iso(row.get("updated_at")),
        "course": {
            "id": int(row["course_id"]),
            "code": row.get("course_code"),
            "name": row.get("course_name"),
            "academicYear": row.get("academic_year"),
            "academicTerm": row.get("academic_term"),
        },
    }


def _load_teacher_course(cur, course_id, require_active=False):
    params = [course_id]
    scope = "TRUE"
    if _actor_role().casefold() != "admin":
        scope = "c.teacher_user_id = %s"
        params.append(g.current_user["id"])

    active_sql = "AND c.is_active = TRUE" if require_active else ""
    cur.execute(
        """
        SELECT
            c.id,
            c.code,
            c.name,
            c.academic_year,
            c.academic_term,
            c.teacher_user_id,
            c.is_active
        FROM courses c
        WHERE c.id = %s
          AND ({scope})
          {active_sql};
        """.format(scope=scope, active_sql=active_sql),
        params,
    )
    course = cur.fetchone()
    if course is None:
        raise NotFoundError(
            "El curso no existe o no está disponible."
        )
    return course


def _load_protocol(cur, course_id, protocol_id):
    cur.execute(
        """
        SELECT
            p.*,
            c.code AS course_code,
            c.name AS course_name,
            c.academic_year,
            c.academic_term
        FROM experimental_protocols p
        JOIN courses c
          ON c.id = p.course_id
        WHERE p.id = %s
          AND p.course_id = %s;
        """,
        (protocol_id, course_id),
    )
    row = cur.fetchone()
    if row is None:
        raise NotFoundError(
            "El protocolo solicitado no existe en este curso."
        )
    return row


def _audit(cur, action, description):
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
            action,
            description,
        ),
    )


def _validated_payload(data, base=None):
    try:
        return normalize_protocol_configuration(data, base=base)
    except InvalidProtocolConfiguration as exc:
        raise BadRequestError(str(exc))


@experimental_protocols_bp.route(
    "/teacher/courses/<int:course_id>/protocols",
    methods=["GET"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def list_teacher_protocols(course_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_teacher_course(cur, course_id)
            cur.execute(
                """
                SELECT
                    p.*,
                    c.code AS course_code,
                    c.name AS course_name,
                    c.academic_year,
                    c.academic_term
                FROM experimental_protocols p
                JOIN courses c
                  ON c.id = p.course_id
                WHERE p.course_id = %s
                ORDER BY
                    p.is_active DESC,
                    p.is_published DESC,
                    p.updated_at DESC,
                    p.id DESC;
                """,
                (course_id,),
            )
            rows = cur.fetchall()
        return jsonify(
            {
                "items": [_serialize_protocol(row) for row in rows],
                "total": len(rows),
            }
        ), 200
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/teacher/courses/<int:course_id>/protocols",
    methods=["POST"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def create_teacher_protocol(course_id):
    config = _validated_payload(request.get_json(silent=True))
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            course = _load_teacher_course(
                cur,
                course_id,
                require_active=True,
            )
            cur.execute(
                """
                INSERT INTO experimental_protocols (
                    course_id,
                    title,
                    objective,
                    instructions,
                    benchmark,
                    input_size,
                    execution_profile,
                    samples,
                    data_type,
                    is_published,
                    is_active,
                    created_by_user_id,
                    updated_by_user_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    FALSE, TRUE, %s, %s, NOW(), NOW()
                )
                RETURNING *;
                """,
                (
                    course_id,
                    config["title"],
                    config["objective"],
                    config["instructions"],
                    config["benchmark"],
                    config["input_size"],
                    config["execution_profile"],
                    config["samples"],
                    config["data_type"],
                    g.current_user["id"],
                    g.current_user["id"],
                ),
            )
            row = cur.fetchone()
            row["course_code"] = course["code"]
            row["course_name"] = course["name"]
            row["academic_year"] = course["academic_year"]
            row["academic_term"] = course["academic_term"]

            _audit(
                cur,
                "create_experimental_protocol",
                "Protocolo #{} creado como borrador en curso #{}.".format(
                    row["id"],
                    course_id,
                ),
            )
        conn.commit()
        return jsonify(
            {"protocol": _serialize_protocol(row)}
        ), 201
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/teacher/courses/<int:course_id>/protocols/<int:protocol_id>",
    methods=["PATCH"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def update_teacher_protocol(course_id, protocol_id):
    data = request.get_json(silent=True)
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_teacher_course(cur, course_id)
            current = _load_protocol(cur, course_id, protocol_id)
            config = _validated_payload(
                data,
                base=protocol_row_as_configuration(current),
            )

            cur.execute(
                """
                UPDATE experimental_protocols
                SET title = %s,
                    objective = %s,
                    instructions = %s,
                    benchmark = %s,
                    input_size = %s,
                    execution_profile = %s,
                    samples = %s,
                    data_type = %s,
                    updated_by_user_id = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND course_id = %s
                RETURNING *;
                """,
                (
                    config["title"],
                    config["objective"],
                    config["instructions"],
                    config["benchmark"],
                    config["input_size"],
                    config["execution_profile"],
                    config["samples"],
                    config["data_type"],
                    g.current_user["id"],
                    protocol_id,
                    course_id,
                ),
            )
            row = cur.fetchone()
            row["course_code"] = current["course_code"]
            row["course_name"] = current["course_name"]
            row["academic_year"] = current["academic_year"]
            row["academic_term"] = current["academic_term"]

            _audit(
                cur,
                "update_experimental_protocol",
                "Protocolo #{} actualizado en curso #{}.".format(
                    protocol_id,
                    course_id,
                ),
            )
        conn.commit()
        return jsonify(
            {"protocol": _serialize_protocol(row)}
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/teacher/courses/<int:course_id>/protocols/<int:protocol_id>/publish",
    methods=["POST"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def publish_teacher_protocol(course_id, protocol_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_teacher_course(
                cur,
                course_id,
                require_active=True,
            )
            current = _load_protocol(cur, course_id, protocol_id)
            cur.execute(
                """
                UPDATE experimental_protocols
                SET is_published = TRUE,
                    is_active = TRUE,
                    published_at = NOW(),
                    deactivated_at = NULL,
                    updated_by_user_id = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND course_id = %s
                RETURNING *;
                """,
                (
                    g.current_user["id"],
                    protocol_id,
                    course_id,
                ),
            )
            row = cur.fetchone()
            row["course_code"] = current["course_code"]
            row["course_name"] = current["course_name"]
            row["academic_year"] = current["academic_year"]
            row["academic_term"] = current["academic_term"]

            notify_protocol_published(
                cur,
                protocol_id=protocol_id,
                course_id=course_id,
                actor_user_id=g.current_user["id"],
                published_at=row["published_at"],
            )

            _audit(
                cur,
                "publish_experimental_protocol",
                "Protocolo #{} publicado en curso #{}.".format(
                    protocol_id,
                    course_id,
                ),
            )
        conn.commit()
        return jsonify(
            {"protocol": _serialize_protocol(row)}
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/teacher/courses/<int:course_id>/protocols/<int:protocol_id>/deactivate",
    methods=["POST"],
)
@handle_api_errors
@login_required
@teacher_or_admin_required
def deactivate_teacher_protocol(course_id, protocol_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_teacher_course(cur, course_id)
            current = _load_protocol(cur, course_id, protocol_id)
            cur.execute(
                """
                UPDATE experimental_protocols
                SET is_published = FALSE,
                    is_active = FALSE,
                    deactivated_at = NOW(),
                    updated_by_user_id = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND course_id = %s
                RETURNING *;
                """,
                (
                    g.current_user["id"],
                    protocol_id,
                    course_id,
                ),
            )
            row = cur.fetchone()
            row["course_code"] = current["course_code"]
            row["course_name"] = current["course_name"]
            row["academic_year"] = current["academic_year"]
            row["academic_term"] = current["academic_term"]
            _audit(
                cur,
                "deactivate_experimental_protocol",
                "Protocolo #{} desactivado en curso #{}.".format(
                    protocol_id,
                    course_id,
                ),
            )
        conn.commit()
        return jsonify(
            {"protocol": _serialize_protocol(row)}
        ), 200
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/student/protocols",
    methods=["GET"],
)
@handle_api_errors
@login_required
@role_required("Student")
def list_student_protocols():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.*,
                    c.code AS course_code,
                    c.name AS course_name,
                    c.academic_year,
                    c.academic_term
                FROM experimental_protocols p
                JOIN courses c
                  ON c.id = p.course_id
                JOIN course_memberships cm
                  ON cm.course_id = c.id
                 AND cm.user_id = %s
                WHERE p.is_active = TRUE
                  AND p.is_published = TRUE
                  AND c.is_active = TRUE
                  AND cm.is_active = TRUE
                ORDER BY
                    c.academic_year DESC,
                    c.academic_term DESC,
                    c.code,
                    p.updated_at DESC,
                    p.id DESC;
                """,
                (g.current_user["id"],),
            )
            rows = cur.fetchall()
        return jsonify(
            {
                "items": [_serialize_protocol(row) for row in rows],
                "total": len(rows),
            }
        ), 200
    finally:
        conn.close()


@experimental_protocols_bp.route(
    "/student/protocols/<int:protocol_id>",
    methods=["GET"],
)
@handle_api_errors
@login_required
@role_required("Student")
def get_student_protocol(protocol_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.*,
                    c.code AS course_code,
                    c.name AS course_name,
                    c.academic_year,
                    c.academic_term
                FROM experimental_protocols p
                JOIN courses c
                  ON c.id = p.course_id
                JOIN course_memberships cm
                  ON cm.course_id = c.id
                 AND cm.user_id = %s
                WHERE p.id = %s
                  AND p.is_active = TRUE
                  AND p.is_published = TRUE
                  AND c.is_active = TRUE
                  AND cm.is_active = TRUE;
                """,
                (
                    g.current_user["id"],
                    protocol_id,
                ),
            )
            row = cur.fetchone()

        if row is None:
            raise NotFoundError(
                "El protocolo no existe o no está disponible."
            )

        return jsonify(
            {"protocol": _serialize_protocol(row)}
        ), 200
    finally:
        conn.close()
