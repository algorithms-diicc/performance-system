# server/webapp/routes/teacher_courses_routes.py

import csv
import io
import re

from flask import Blueprint, Response, g, jsonify, request
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from ..utils.api_errors import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    handle_api_errors,
)
from ..utils.auth_decorators import (
    get_user_role_name,
    login_required,
    teacher_or_admin_required,
)
from ..utils.audit_descriptions import (
    student_batch_audit_description,
)
from ..utils.db_utils import db_cursor
from ..services.execution_creation_service import (
    InvalidExecutionRequest,
    get_submission_course_context,
)
from ..services.execution_history_service import (
    execution_status_filter_sql,
    map_execution_state_label,
    serialize_execution_history_row,
)


teacher_courses_bp = Blueprint(
    "teacher_courses",
    __name__,
    url_prefix="/api",
)


def _iso(value):
    return value.isoformat() if value is not None else None


def _as_int(value, field, minimum=None, maximum=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValidationError(
            "{} debe ser un número entero.".format(field),
            extra={"field": field},
        )

    if minimum is not None and parsed < minimum:
        raise ValidationError(
            "{} debe ser >= {}.".format(field, minimum),
            extra={"field": field},
        )

    if maximum is not None and parsed > maximum:
        raise ValidationError(
            "{} debe ser <= {}.".format(field, maximum),
            extra={"field": field},
        )

    return parsed


def _parse_bool(value, field):
    if isinstance(value, bool):
        return value

    normalized = str(value).strip().casefold()
    if normalized in {"true", "1", "yes", "si", "sí"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False

    raise ValidationError(
        "{} debe ser booleano.".format(field),
        extra={"field": field},
    )


def _serialize_course(row):
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "academicYear": row["academic_year"],
        "academicTerm": row["academic_term"],
        "teacher": {
            "id": row["teacher_user_id"],
            "fullName": row.get("teacher_full_name"),
            "email": row.get("teacher_email"),
        },
        "isActive": bool(row["is_active"]),
        "createdAt": _iso(row.get("created_at")),
        "updatedAt": _iso(row.get("updated_at")),
        "activeStudents": int(row.get("active_students") or 0),
        "totalStudents": int(row.get("total_students") or 0),
        "submissions": int(row.get("submissions_count") or 0),
        "executions": int(row.get("executions_count") or 0),
        "lastActivityAt": _iso(row.get("last_activity_at")),
    }


def _actor_role():
    role_name = getattr(g, "current_role_name", None)
    if role_name:
        return role_name
    return get_user_role_name(g.current_user)


def _course_scope_sql(alias="c"):
    if (_actor_role() or "").casefold() == "admin":
        return "TRUE", []
    return "{}.teacher_user_id = %s".format(alias), [
        g.current_user["id"]
    ]


def _load_course(cur, course_id, require_active=False):
    scope_sql, scope_params = _course_scope_sql("c")
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
            c.is_active,
            c.created_at,
            c.updated_at,
            u.full_name AS teacher_full_name,
            u.email AS teacher_email
        FROM courses c
        JOIN users u
          ON u.id = c.teacher_user_id
        WHERE c.id = %s
          AND ({scope_sql})
          {active_sql};
        """.format(
            scope_sql=scope_sql,
            active_sql=active_sql,
        ),
        [course_id] + scope_params,
    )
    row = cur.fetchone()
    if row is None:
        raise NotFoundError(
            "Curso con id {} no existe o no está disponible.".format(
                course_id
            )
        )
    return row


def _course_student_summary_sql(where_sql, pagination_sql=""):
    """Agregación canónica para tabla docente, CSV y último resultado."""
    return """
        SELECT
            cm.id AS membership_id,
            cm.user_id,
            cm.is_active AS membership_active,
            cm.membership_source,
            cm.created_at AS membership_created_at,
            cm.updated_at AS membership_updated_at,
            cm.removed_at,
            u.full_name,
            u.email,
            u.is_active AS user_active,
            COUNT(DISTINCT s.id) AS submissions_count,
            COUNT(DISTINCT e.id) AS executions_count,
            COUNT(DISTINCT e.id) FILTER (
                WHERE e.execution_state = 'COMPLETED'
            ) AS completed_count,
            COUNT(DISTINCT e.id) FILTER (
                WHERE e.execution_state = 'FAILED'
            ) AS failed_count,
            COUNT(DISTINCT e.id) FILTER (
                WHERE e.execution_state IN (
                    'QUEUED',
                    'RUNNING',
                    'PROCESSING'
                )
            ) AS active_count,
            MAX(
                COALESCE(
                    e.finished_at,
                    e.processing_at,
                    e.started_at,
                    e.queued_at,
                    e.created_at,
                    s.created_at
                )
            ) AS last_activity_at,
            (
                ARRAY_AGG(
                    e.codename
                    ORDER BY e.id DESC
                ) FILTER (
                    WHERE e.execution_state = 'COMPLETED'
                      AND e.result_available = TRUE
                      AND NULLIF(BTRIM(e.codename), '') IS NOT NULL
                )
            )[1] AS last_result_codename
        FROM course_memberships cm
        JOIN users u
          ON u.id = cm.user_id
        LEFT JOIN submissions s
          ON s.course_id = cm.course_id
         AND s.user_id = cm.user_id
        LEFT JOIN executions e
          ON e.submission_id = s.id
        WHERE {where_sql}
        GROUP BY
            cm.id,
            cm.user_id,
            cm.is_active,
            cm.membership_source,
            cm.created_at,
            cm.updated_at,
            cm.removed_at,
            u.full_name,
            u.email,
            u.is_active
        ORDER BY
            cm.is_active DESC,
            LOWER(u.full_name),
            cm.user_id
        {pagination_sql};
    """.format(
        where_sql=where_sql,
        pagination_sql=pagination_sql,
    )


def _validate_teacher_target(cur, teacher_user_id):
    cur.execute(
        """
        SELECT
            u.id,
            u.full_name,
            u.email,
            u.is_active,
            r.name AS role_name
        FROM users u
        JOIN roles r
          ON r.id = u.role_id
        WHERE u.id = %s;
        """,
        (teacher_user_id,),
    )
    row = cur.fetchone()

    if row is None:
        raise ValidationError(
            "El usuario seleccionado como profesor no existe.",
            extra={"field": "teacherUserId"},
        )

    if not row["is_active"]:
        raise ValidationError(
            "El usuario seleccionado como profesor está inactivo.",
            extra={"field": "teacherUserId"},
        )

    if row["role_name"] not in ("Teacher", "Admin"):
        raise ValidationError(
            "El responsable del curso debe tener rol Teacher o Admin.",
            extra={"field": "teacherUserId"},
        )

    return row


def _audit(cur, action, description, actor=None):
    actor = actor or g.current_user
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
            actor["id"],
            action,
            description,
        ),
    )


def clone_course_in_transaction(
    cur,
    source,
    teacher,
    academic_year,
    academic_term,
    copy_students,
    actor,
):
    """Crea una instancia nueva y, opcionalmente, su nómina activa."""
    cur.execute(
        """
        SELECT id
        FROM courses
        WHERE code = %s
          AND academic_year = %s
          AND academic_term = %s
          AND teacher_user_id = %s;
        """,
        (
            source["code"],
            academic_year,
            academic_term,
            source["teacher_user_id"],
        ),
    )
    if cur.fetchone() is not None:
        raise BadRequestError(
            "Ya existe este curso para el profesor y período indicados."
        )

    cur.execute(
        """
        INSERT INTO courses (
            code,
            name,
            academic_year,
            academic_term,
            teacher_user_id,
            is_active,
            created_at,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, TRUE, NOW(), NOW())
        RETURNING *;
        """,
        (
            source["code"],
            source["name"],
            academic_year,
            academic_term,
            source["teacher_user_id"],
        ),
    )
    cloned = cur.fetchone()
    cloned["teacher_full_name"] = teacher.get("full_name")
    cloned["teacher_email"] = teacher.get("email")
    cloned["active_students"] = 0
    cloned["total_students"] = 0
    cloned["submissions_count"] = 0
    cloned["executions_count"] = 0
    cloned["last_activity_at"] = None

    students_copied = 0
    if copy_students:
        cur.execute(
            """
            INSERT INTO course_memberships (
                course_id,
                user_id,
                is_active,
                membership_source,
                source_access_request_id,
                added_by_user_id,
                created_at,
                updated_at,
                removed_at
            )
            SELECT
                %s,
                cm.user_id,
                TRUE,
                'BULK_IMPORT',
                NULL,
                %s,
                NOW(),
                NOW(),
                NULL
            FROM course_memberships cm
            WHERE cm.course_id = %s
              AND cm.is_active = TRUE
            RETURNING id;
            """,
            (
                cloned["id"],
                actor["id"],
                source["id"],
            ),
        )
        students_copied = len(cur.fetchall())
        cloned["active_students"] = students_copied
        cloned["total_students"] = students_copied

    _audit(
        cur,
        "clone_course",
        (
            "Curso #{source_id} clonado como #{target_id} para "
            "{year}-{term}; estudiantesCopiados={students}; actor={actor}."
        ).format(
            source_id=source["id"],
            target_id=cloned["id"],
            year=academic_year,
            term=academic_term,
            students=students_copied,
            actor=actor.get("email"),
        ),
        actor=actor,
    )

    return cloned, students_copied


def _serialize_analysis_course(row):
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "academicYear": row["academic_year"],
        "academicTerm": row["academic_term"],
        "teacher": {
            "fullName": row.get("teacher_full_name"),
            "email": row.get("teacher_email"),
        },
        "membershipCreatedAt": _iso(
            row.get("membership_created_at")
        ),
    }


@teacher_courses_bp.route("/analysis/courses", methods=["GET"])
@login_required
@handle_api_errors
def list_analysis_courses():
    """
    Contextos académicos que el usuario puede asignar a un nuevo análisis.

    No reutiliza el scope global de supervisión de Admin:
    Teacher/Admin solo reciben cursos donde son responsables académicos.
    """
    user = g.current_user
    conn = get_connection()

    try:
        try:
            context = get_submission_course_context(
                user_id=user["id"],
                role_name=get_user_role_name(user),
                conn=conn,
            )
        except InvalidExecutionRequest as exc:
            raise ValidationError(str(exc))

        items = [
            _serialize_analysis_course(row)
            for row in context["courses"]
        ]

        return jsonify(
            {
                "items": items,
                "total": len(items),
                "selectionRequired": context[
                    "selection_required"
                ],
                "autoSelectedCourseId": context[
                    "auto_selected_course_id"
                ],
                "personalAllowed": context[
                    "personal_allowed"
                ],
            }
        ), 200

    finally:
        conn.close()


@teacher_courses_bp.route("/student/courses", methods=["GET"])
@login_required
@handle_api_errors
def list_student_courses():
    user = g.current_user
    conn = get_connection()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    c.id,
                    c.code,
                    c.name,
                    c.academic_year,
                    c.academic_term,
                    c.is_active,
                    u.full_name AS teacher_full_name,
                    u.email AS teacher_email,
                    cm.created_at AS membership_created_at
                FROM course_memberships cm
                JOIN courses c
                  ON c.id = cm.course_id
                JOIN users u
                  ON u.id = c.teacher_user_id
                WHERE cm.user_id = %s
                  AND cm.is_active = TRUE
                  AND c.is_active = TRUE
                ORDER BY
                    c.academic_year DESC,
                    c.academic_term DESC,
                    c.code,
                    c.id;
                """,
                (user["id"],),
            )
            rows = cur.fetchall()

        items = [
            {
                "id": row["id"],
                "code": row["code"],
                "name": row["name"],
                "academicYear": row["academic_year"],
                "academicTerm": row["academic_term"],
                "teacher": {
                    "fullName": row.get("teacher_full_name"),
                    "email": row.get("teacher_email"),
                },
                "membershipCreatedAt": _iso(
                    row.get("membership_created_at")
                ),
            }
            for row in rows
        ]

        return jsonify(
            {
                "items": items,
                "total": len(items),
                "selectionRequired": len(items) > 1,
                "autoSelectedCourseId": (
                    items[0]["id"] if len(items) == 1 else None
                ),
            }
        ), 200

    finally:
        conn.close()


@teacher_courses_bp.route("/teacher/courses", methods=["GET"])
@login_required
@teacher_or_admin_required
@handle_api_errors
def list_teacher_courses():
    active = request.args.get("active", "all", type=str).strip().casefold()
    search = request.args.get("search", "", type=str).strip()

    if active not in {"all", "true", "false"}:
        raise BadRequestError(
            "El parámetro 'active' debe ser all, true o false."
        )

    where = []
    params = []

    scope_sql, scope_params = _course_scope_sql("c")
    where.append("({})".format(scope_sql))
    params.extend(scope_params)

    if active == "true":
        where.append("c.is_active = TRUE")
    elif active == "false":
        where.append("c.is_active = FALSE")

    if search:
        where.append(
            """
            (
                LOWER(c.code) LIKE %s
                OR LOWER(c.name) LIKE %s
                OR LOWER(t.full_name) LIKE %s
                OR LOWER(t.email) LIKE %s
            )
            """
        )
        like = "%{}%".format(search.casefold())
        params.extend([like, like, like, like])

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    c.id,
                    c.code,
                    c.name,
                    c.academic_year,
                    c.academic_term,
                    c.teacher_user_id,
                    c.is_active,
                    c.created_at,
                    c.updated_at,
                    t.full_name AS teacher_full_name,
                    t.email AS teacher_email,
                    COUNT(DISTINCT cm.user_id) FILTER (
                        WHERE cm.is_active = TRUE
                    ) AS active_students,
                    COUNT(DISTINCT cm.user_id) AS total_students,
                    COUNT(DISTINCT s.id) AS submissions_count,
                    COUNT(DISTINCT e.id) AS executions_count,
                    MAX(
                        COALESCE(
                            e.finished_at,
                            e.processing_at,
                            e.started_at,
                            e.queued_at,
                            e.created_at,
                            s.created_at
                        )
                    ) AS last_activity_at
                FROM courses c
                JOIN users t
                  ON t.id = c.teacher_user_id
                LEFT JOIN course_memberships cm
                  ON cm.course_id = c.id
                LEFT JOIN submissions s
                  ON s.course_id = c.id
                LEFT JOIN executions e
                  ON e.submission_id = s.id
                WHERE {where_sql}
                GROUP BY
                    c.id,
                    c.code,
                    c.name,
                    c.academic_year,
                    c.academic_term,
                    c.teacher_user_id,
                    c.is_active,
                    c.created_at,
                    c.updated_at,
                    t.full_name,
                    t.email
                ORDER BY
                    c.is_active DESC,
                    c.academic_year DESC,
                    c.academic_term DESC,
                    c.code,
                    c.id DESC;
                """.format(
                    where_sql=" AND ".join(where)
                ),
                params,
            )
            rows = cur.fetchall()

        return jsonify(
            {
                "items": [_serialize_course(row) for row in rows],
                "total": len(rows),
            }
        ), 200
    finally:
        conn.close()


@teacher_courses_bp.route("/teacher/courses", methods=["POST"])
@login_required
@teacher_or_admin_required
@handle_api_errors
def create_course():
    data = request.get_json(silent=True) or {}

    code = str(data.get("code") or "").strip().upper()
    name = str(data.get("name") or "").strip()

    if not code:
        raise ValidationError(
            "Debe indicar el código del curso.",
            extra={"field": "code"},
        )
    if not name:
        raise ValidationError(
            "Debe indicar el nombre del curso.",
            extra={"field": "name"},
        )

    academic_year = _as_int(
        data.get("academicYear", data.get("academic_year")),
        "academicYear",
        2000,
        9999,
    )
    academic_term = _as_int(
        data.get("academicTerm", data.get("academic_term")),
        "academicTerm",
        1,
        2,
    )

    role_name = (_actor_role() or "").casefold()
    requested_teacher = data.get(
        "teacherUserId",
        data.get("teacher_user_id"),
    )

    if role_name == "admin" and requested_teacher not in (None, ""):
        teacher_user_id = _as_int(
            requested_teacher,
            "teacherUserId",
            1,
        )
    else:
        teacher_user_id = int(g.current_user["id"])
        if role_name != "admin" and requested_teacher not in (None, ""):
            requested_teacher_id = _as_int(
                requested_teacher,
                "teacherUserId",
                1,
            )
            if requested_teacher_id != teacher_user_id:
                raise ForbiddenError(
                    "Un profesor no puede crear cursos para otro usuario."
                )

    with db_cursor() as (conn, cur):
        _validate_teacher_target(cur, teacher_user_id)

        cur.execute(
            """
            SELECT id
            FROM courses
            WHERE code = %s
              AND academic_year = %s
              AND academic_term = %s
              AND teacher_user_id = %s;
            """,
            (
                code,
                academic_year,
                academic_term,
                teacher_user_id,
            ),
        )
        if cur.fetchone() is not None:
            raise BadRequestError(
                "Ya existe este curso para el profesor y período indicados."
            )

        cur.execute(
            """
            INSERT INTO courses (
                code,
                name,
                academic_year,
                academic_term,
                teacher_user_id,
                is_active,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, TRUE, NOW(), NOW())
            RETURNING *;
            """,
            (
                code,
                name,
                academic_year,
                academic_term,
                teacher_user_id,
            ),
        )
        course = cur.fetchone()

        cur.execute(
            """
            SELECT full_name, email
            FROM users
            WHERE id = %s;
            """,
            (teacher_user_id,),
        )
        teacher = cur.fetchone()
        course["teacher_full_name"] = teacher["full_name"]
        course["teacher_email"] = teacher["email"]

        _audit(
            cur,
            "create_course",
            (
                "Curso #{id} {code} {year}-{term} creado por {actor}."
            ).format(
                id=course["id"],
                code=course["code"],
                year=course["academic_year"],
                term=course["academic_term"],
                actor=g.current_user.get("email"),
            ),
        )

    return jsonify({"course": _serialize_course(course)}), 201


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/clone",
    methods=["POST"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def clone_course(course_id):
    data = request.get_json(silent=True) or {}
    academic_year = _as_int(
        data.get("academicYear", data.get("academic_year")),
        "academicYear",
        2000,
        9999,
    )
    academic_term = _as_int(
        data.get("academicTerm", data.get("academic_term")),
        "academicTerm",
        1,
        2,
    )
    copy_students = _parse_bool(
        data.get("copyStudents", data.get("copy_students", False)),
        "copyStudents",
    )

    with db_cursor() as (_conn, cur):
        source = _load_course(cur, course_id)
        teacher = _validate_teacher_target(
            cur,
            source["teacher_user_id"],
        )
        cloned, students_copied = clone_course_in_transaction(
            cur,
            source,
            teacher,
            academic_year,
            academic_term,
            copy_students,
            g.current_user,
        )

    return jsonify(
        {
            "course": _serialize_course(cloned),
            "studentsCopied": students_copied,
        }
    ), 201


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course(course_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            course = _load_course(cur, course_id)

            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT cm.user_id) FILTER (
                        WHERE cm.is_active = TRUE
                    ) AS active_students,
                    COUNT(DISTINCT cm.user_id) AS total_students,
                    COUNT(DISTINCT s.id) AS submissions_count,
                    COUNT(DISTINCT e.id) AS executions_count,
                    COUNT(DISTINCT e.id) FILTER (
                        WHERE e.execution_state = 'COMPLETED'
                    ) AS completed_executions,
                    COUNT(DISTINCT e.id) FILTER (
                        WHERE e.execution_state = 'FAILED'
                    ) AS failed_executions,
                    COUNT(DISTINCT e.id) FILTER (
                        WHERE e.execution_state IN (
                            'QUEUED',
                            'RUNNING',
                            'PROCESSING'
                        )
                    ) AS active_executions,
                    COUNT(DISTINCT e.id) FILTER (
                        WHERE e.execution_state = 'CANCELLED'
                    ) AS cancelled_executions,
                    MAX(
                        COALESCE(
                            e.finished_at,
                            e.processing_at,
                            e.started_at,
                            e.queued_at,
                            e.created_at,
                            s.created_at
                        )
                    ) AS last_activity_at
                FROM courses c
                LEFT JOIN course_memberships cm
                  ON cm.course_id = c.id
                LEFT JOIN submissions s
                  ON s.course_id = c.id
                LEFT JOIN executions e
                  ON e.submission_id = s.id
                WHERE c.id = %s;
                """,
                (course_id,),
            )
            summary = cur.fetchone() or {}

        course.update(summary)

        return jsonify(
            {
                "course": _serialize_course(course),
                "summary": {
                    "activeStudents": int(
                        summary.get("active_students") or 0
                    ),
                    "totalStudents": int(
                        summary.get("total_students") or 0
                    ),
                    "submissions": int(
                        summary.get("submissions_count") or 0
                    ),
                    "executions": int(
                        summary.get("executions_count") or 0
                    ),
                    "completedExecutions": int(
                        summary.get("completed_executions") or 0
                    ),
                    "failedExecutions": int(
                        summary.get("failed_executions") or 0
                    ),
                    "activeExecutions": int(
                        summary.get("active_executions") or 0
                    ),
                    "cancelledExecutions": int(
                        summary.get("cancelled_executions") or 0
                    ),
                    "lastActivityAt": _iso(
                        summary.get("last_activity_at")
                    ),
                },
            }
        ), 200

    finally:
        conn.close()


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/analytics",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course_analytics(course_id):
    """Entrega agregados docentes sin comparar hardware ni rendimiento."""
    conn = get_connection()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_course(cur, course_id)

            cur.execute(
                """
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM course_memberships cm
                        WHERE cm.course_id = %s
                          AND cm.is_active = TRUE
                    ) AS active_students,
                    (
                        SELECT COUNT(*)
                        FROM submissions s
                        WHERE s.course_id = %s
                    ) AS submissions_count,
                    (
                        SELECT COUNT(*)
                        FROM executions e
                        JOIN submissions s
                          ON s.id = e.submission_id
                        WHERE s.course_id = %s
                    ) AS executions_count,
                    (
                        SELECT COUNT(*)
                        FROM executions e
                        JOIN submissions s
                          ON s.id = e.submission_id
                        WHERE s.course_id = %s
                          AND e.execution_state = 'COMPLETED'
                    ) AS completed_executions;
                """,
                (course_id, course_id, course_id, course_id),
            )
            kpi_row = cur.fetchone() or {}

            cur.execute(
                """
                WITH per_student AS (
                    SELECT
                        cm.user_id,
                        COUNT(e.id) AS executions_count
                    FROM course_memberships cm
                    LEFT JOIN submissions s
                      ON s.course_id = cm.course_id
                     AND s.user_id = cm.user_id
                    LEFT JOIN executions e
                      ON e.submission_id = s.id
                    WHERE cm.course_id = %s
                      AND cm.is_active = TRUE
                    GROUP BY cm.user_id
                )
                SELECT
                    COUNT(*) FILTER (
                        WHERE executions_count = 0
                    ) AS zero_executions,
                    COUNT(*) FILTER (
                        WHERE executions_count BETWEEN 1 AND 4
                    ) AS one_to_four,
                    COUNT(*) FILTER (
                        WHERE executions_count BETWEEN 5 AND 9
                    ) AS five_to_nine,
                    COUNT(*) FILTER (
                        WHERE executions_count >= 10
                    ) AS ten_or_more
                FROM per_student;
                """,
                (course_id,),
            )
            participation_row = cur.fetchone() or {}

            cur.execute(
                """
                SELECT
                    UPPER(TRIM(e.benchmark)) AS benchmark,
                    COUNT(*) AS executions_count
                FROM executions e
                JOIN submissions s
                  ON s.id = e.submission_id
                WHERE s.course_id = %s
                  AND UPPER(TRIM(COALESCE(e.benchmark, ''))) IN (
                      'LCS',
                      'CAMM',
                      'SIZE'
                  )
                GROUP BY UPPER(TRIM(e.benchmark));
                """,
                (course_id,),
            )
            benchmark_rows = cur.fetchall()

            cur.execute(
                """
                WITH last_day AS (
                    SELECT COALESCE(
                        MAX(e.created_at)::date,
                        CURRENT_DATE
                    ) AS end_date
                    FROM executions e
                    JOIN submissions s
                      ON s.id = e.submission_id
                    WHERE s.course_id = %s
                ),
                calendar AS (
                    SELECT GENERATE_SERIES(
                        end_date - INTERVAL '29 days',
                        end_date,
                        INTERVAL '1 day'
                    )::date AS activity_date
                    FROM last_day
                ),
                daily_counts AS (
                    SELECT
                        e.created_at::date AS activity_date,
                        COUNT(*) AS executions_count
                    FROM executions e
                    JOIN submissions s
                      ON s.id = e.submission_id
                    CROSS JOIN last_day
                    WHERE s.course_id = %s
                      AND e.created_at::date BETWEEN
                          end_date - INTERVAL '29 days'
                          AND end_date
                    GROUP BY e.created_at::date
                )
                SELECT
                    calendar.activity_date,
                    COALESCE(
                        daily_counts.executions_count,
                        0
                    ) AS executions_count
                FROM calendar
                LEFT JOIN daily_counts
                  USING (activity_date)
                ORDER BY calendar.activity_date;
                """,
                (course_id, course_id),
            )
            activity_rows = cur.fetchall()

        active_students = int(kpi_row.get("active_students") or 0)
        submissions = int(kpi_row.get("submissions_count") or 0)
        executions = int(kpi_row.get("executions_count") or 0)
        completed = int(kpi_row.get("completed_executions") or 0)
        completion_rate = (
            round((completed * 100.0) / executions, 1)
            if executions
            else 0.0
        )

        benchmark_counts = {"LCS": 0, "CAMM": 0, "SIZE": 0}
        for row in benchmark_rows:
            benchmark = row.get("benchmark")
            if benchmark in benchmark_counts:
                benchmark_counts[benchmark] = int(
                    row.get("executions_count") or 0
                )

        participation = [
            {
                "key": "zero",
                "label": "0 ejecuciones",
                "students": int(
                    participation_row.get("zero_executions") or 0
                ),
            },
            {
                "key": "oneToFour",
                "label": "1–4",
                "students": int(
                    participation_row.get("one_to_four") or 0
                ),
            },
            {
                "key": "fiveToNine",
                "label": "5–9",
                "students": int(
                    participation_row.get("five_to_nine") or 0
                ),
            },
            {
                "key": "tenOrMore",
                "label": "10+",
                "students": int(
                    participation_row.get("ten_or_more") or 0
                ),
            },
        ]

        activity = [
            {
                "date": row["activity_date"].isoformat(),
                "executions": int(row.get("executions_count") or 0),
            }
            for row in activity_rows
        ]

        return jsonify(
            {
                "courseId": course_id,
                "kpis": {
                    "activeStudents": active_students,
                    "submissions": submissions,
                    "executions": executions,
                    "completedExecutions": completed,
                    "completionRate": completion_rate,
                },
                "participation": participation,
                "benchmarks": [
                    {
                        "key": benchmark,
                        "label": benchmark,
                        "executions": benchmark_counts[benchmark],
                    }
                    for benchmark in ("LCS", "CAMM", "SIZE")
                ],
                "activity": {
                    "granularity": "day",
                    "windowDays": 30,
                    "startDate": activity[0]["date"] if activity else None,
                    "endDate": activity[-1]["date"] if activity else None,
                    "items": activity,
                },
            }
        ), 200

    finally:
        conn.close()


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>",
    methods=["PATCH"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def update_course(course_id):
    data = request.get_json(silent=True) or {}

    allowed = {
        "code",
        "name",
        "academicYear",
        "academic_year",
        "academicTerm",
        "academic_term",
        "isActive",
        "is_active",
        "teacherUserId",
        "teacher_user_id",
    }
    if not any(key in data for key in allowed):
        raise ValidationError(
            "No se recibieron campos modificables."
        )

    with db_cursor() as (conn, cur):
        current = _load_course(cur, course_id)

        code = str(data.get("code", current["code"])).strip().upper()
        name = str(data.get("name", current["name"])).strip()

        if not code:
            raise ValidationError(
                "El código no puede quedar vacío.",
                extra={"field": "code"},
            )
        if not name:
            raise ValidationError(
                "El nombre no puede quedar vacío.",
                extra={"field": "name"},
            )

        academic_year = current["academic_year"]
        if "academicYear" in data or "academic_year" in data:
            academic_year = _as_int(
                data.get(
                    "academicYear",
                    data.get("academic_year"),
                ),
                "academicYear",
                2000,
                9999,
            )

        academic_term = current["academic_term"]
        if "academicTerm" in data or "academic_term" in data:
            academic_term = _as_int(
                data.get(
                    "academicTerm",
                    data.get("academic_term"),
                ),
                "academicTerm",
                1,
                2,
            )

        is_active = current["is_active"]
        if "isActive" in data or "is_active" in data:
            is_active = _parse_bool(
                data.get(
                    "isActive",
                    data.get("is_active"),
                ),
                "isActive",
            )

        teacher_user_id = current["teacher_user_id"]
        if "teacherUserId" in data or "teacher_user_id" in data:
            if (_actor_role() or "").casefold() != "admin":
                raise ForbiddenError(
                    "Solo Admin puede transferir un curso a otro profesor."
                )

            teacher_user_id = _as_int(
                data.get(
                    "teacherUserId",
                    data.get("teacher_user_id"),
                ),
                "teacherUserId",
                1,
            )
            if teacher_user_id != current["teacher_user_id"]:
                _validate_teacher_target(cur, teacher_user_id)

        teacher_changed = (
            teacher_user_id != current["teacher_user_id"]
        )

        cur.execute(
            """
            SELECT id
            FROM courses
            WHERE code = %s
              AND academic_year = %s
              AND academic_term = %s
              AND teacher_user_id = %s
              AND id <> %s;
            """,
            (
                code,
                academic_year,
                academic_term,
                teacher_user_id,
                course_id,
            ),
        )
        if cur.fetchone() is not None:
            raise BadRequestError(
                "Ya existe otro curso con esa combinación "
                "de código, período y profesor."
            )

        cur.execute(
            """
            UPDATE courses
            SET
                code = %s,
                name = %s,
                academic_year = %s,
                academic_term = %s,
                teacher_user_id = %s,
                is_active = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *;
            """,
            (
                code,
                name,
                academic_year,
                academic_term,
                teacher_user_id,
                is_active,
                course_id,
            ),
        )
        course = cur.fetchone()

        cur.execute(
            """
            SELECT full_name, email
            FROM users
            WHERE id = %s;
            """,
            (teacher_user_id,),
        )
        teacher = cur.fetchone()
        course["teacher_full_name"] = teacher["full_name"]
        course["teacher_email"] = teacher["email"]

        cur.execute(
            """
            SELECT
                COUNT(DISTINCT cm.user_id) FILTER (
                    WHERE cm.is_active = TRUE
                ) AS active_students,
                COUNT(DISTINCT cm.user_id) AS total_students,
                COUNT(DISTINCT s.id) AS submissions_count,
                COUNT(DISTINCT e.id) AS executions_count,
                MAX(
                    COALESCE(
                        e.finished_at,
                        e.processing_at,
                        e.started_at,
                        e.queued_at,
                        e.created_at,
                        s.created_at
                    )
                ) AS last_activity_at
            FROM courses c
            LEFT JOIN course_memberships cm
              ON cm.course_id = c.id
            LEFT JOIN submissions s
              ON s.course_id = c.id
            LEFT JOIN executions e
              ON e.submission_id = s.id
            WHERE c.id = %s;
            """,
            (course_id,),
        )
        aggregates = cur.fetchone() or {}
        course.update(aggregates)

        if teacher_changed:
            _audit(
                cur,
                "transfer_course_teacher",
                (
                    "Curso #{id} transferido de {old_teacher} a "
                    "{new_teacher} por {actor}."
                ).format(
                    id=course_id,
                    old_teacher=current.get("teacher_email"),
                    new_teacher=teacher.get("email"),
                    actor=g.current_user.get("email"),
                ),
            )
        else:
            _audit(
                cur,
                "update_course",
                (
                    "Curso #{id} actualizado por {actor}; activo={active}."
                ).format(
                    id=course_id,
                    actor=g.current_user.get("email"),
                    active=bool(is_active),
                ),
            )

    return jsonify({"course": _serialize_course(course)}), 200


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def list_course_students(course_id):
    membership = request.args.get(
        "membership",
        "active",
        type=str,
    ).strip().casefold()
    search = request.args.get("search", "", type=str).strip()
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 50, type=int)

    if membership not in {"active", "inactive", "all"}:
        raise BadRequestError(
            "membership debe ser active, inactive o all."
        )
    if page < 1:
        raise BadRequestError("page debe ser >= 1.")
    if page_size < 1 or page_size > 200:
        raise BadRequestError(
            "page_size debe estar entre 1 y 200."
        )

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _load_course(cur, course_id)

            where = ["cm.course_id = %s"]
            params = [course_id]

            if membership == "active":
                where.append("cm.is_active = TRUE")
            elif membership == "inactive":
                where.append("cm.is_active = FALSE")

            if search:
                where.append(
                    """
                    (
                        LOWER(u.full_name) LIKE %s
                        OR LOWER(u.email) LIKE %s
                    )
                    """
                )
                like = "%{}%".format(search.casefold())
                params.extend([like, like])

            where_sql = " AND ".join(where)

            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM course_memberships cm
                JOIN users u
                  ON u.id = cm.user_id
                WHERE {where_sql};
                """.format(where_sql=where_sql),
                params,
            )
            total = int((cur.fetchone() or {}).get("total") or 0)

            cur.execute(
                _course_student_summary_sql(
                    where_sql,
                    pagination_sql="LIMIT %s OFFSET %s",
                ),
                params + [page_size, offset],
            )
            rows = cur.fetchall()

        items = []
        for row in rows:
            completed = int(row.get("completed_count") or 0)
            failed = int(row.get("failed_count") or 0)
            executions = int(row.get("executions_count") or 0)

            items.append(
                {
                    "membershipId": row["membership_id"],
                    "userId": row["user_id"],
                    "fullName": row.get("full_name"),
                    "email": row.get("email"),
                    "userActive": bool(row.get("user_active")),
                    "membershipActive": bool(
                        row.get("membership_active")
                    ),
                    "membershipSource": row.get(
                        "membership_source"
                    ),
                    "membershipCreatedAt": _iso(
                        row.get("membership_created_at")
                    ),
                    "membershipUpdatedAt": _iso(
                        row.get("membership_updated_at")
                    ),
                    "removedAt": _iso(row.get("removed_at")),
                    "submissions": int(
                        row.get("submissions_count") or 0
                    ),
                    "executions": executions,
                    "completed": completed,
                    "failed": failed,
                    "activeExecutions": int(
                        row.get("active_count") or 0
                    ),
                    "lastActivityAt": _iso(
                        row.get("last_activity_at")
                    ),
                    "lastResultCodename": row.get(
                        "last_result_codename"
                    ),
                    "attention": {
                        "noExecutions": executions == 0,
                        "failedMoreThanCompleted": (
                            failed > completed
                        ),
                    },
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


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/export.csv",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def export_course_students_csv(course_id):
    """Exporta el resumen de todos los estudiantes activos del curso."""
    with db_cursor() as (conn, cur):
        course = _load_course(cur, course_id)
        cur.execute(
            _course_student_summary_sql(
                "cm.course_id = %s AND cm.is_active = TRUE"
            ),
            (course_id,),
        )
        rows = cur.fetchall()

    output = io.StringIO(newline="")
    output.write("\ufeff")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(
        [
            "Alumno",
            "Correo",
            "Experimentos",
            "Ejecuciones",
            "Completadas",
            "Fallidas",
            "Última actividad",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row.get("full_name") or "",
                row.get("email") or "",
                int(row.get("submissions_count") or 0),
                int(row.get("executions_count") or 0),
                int(row.get("completed_count") or 0),
                int(row.get("failed_count") or 0),
                _iso(row.get("last_activity_at")) or "",
            ]
        )

    safe_code = re.sub(
        r"[^A-Za-z0-9_-]+",
        "-",
        str(course.get("code") or "curso"),
    ).strip("-") or "curso"
    response = Response(
        output.getvalue(),
        content_type="text/csv; charset=utf-8",
    )
    response.headers["Content-Disposition"] = (
        'attachment; filename="{}-resumen.csv"'.format(
            safe_code.lower()
        )
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def _normalize_emails(data):
    raw = data.get("emails")
    if raw is None:
        raw = data.get("email")

    if isinstance(raw, str):
        values = re.split(r"[\s,;]+", raw.strip())
    elif isinstance(raw, list):
        values = raw
    else:
        raise ValidationError(
            "Debe indicar email o emails.",
            extra={"field": "emails"},
        )

    emails = []
    seen = set()
    for value in values:
        email = str(value or "").strip().casefold()
        if not email or email in seen:
            continue
        seen.add(email)
        emails.append(email)

    if not emails:
        raise ValidationError(
            "No se recibieron correos válidos.",
            extra={"field": "emails"},
        )

    if len(emails) > 200:
        raise ValidationError(
            "Puede agregar como máximo 200 estudiantes por operación.",
            extra={"field": "emails"},
        )

    return emails


def _is_enrollable_student(role_name, is_active):
    """Solo una cuenta Student activa puede tener membresía académica activa."""
    return (
        str(role_name or "").strip() == "Student"
        and bool(is_active)
    )


def _privacy_safe_enrollment_rejection(email, user):
    """
    Devuelve un rechazo indistinguible para candidatos no elegibles.

    No revela si el correo existe, si corresponde a otro rol ni si la cuenta
    está inactiva. También conserva el correo solicitado en vez de devolver
    datos canónicos de una cuenta ajena.
    """
    if (
        user is not None
        and _is_enrollable_student(
            user.get("role_name"),
            user.get("is_active"),
        )
    ):
        return None

    return {
        "email": str(email or "").strip().casefold(),
        "reason": "NOT_ELIGIBLE",
    }


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students",
    methods=["POST"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def add_course_students(course_id):
    data = request.get_json(silent=True) or {}
    emails = _normalize_emails(data)
    source = "BULK_IMPORT" if len(emails) > 1 else "MANUAL"

    added = []
    reactivated = []
    already_active = []
    rejected = []

    with db_cursor() as (conn, cur):
        course = _load_course(
            cur,
            course_id,
            require_active=True,
        )

        for email in emails:
            cur.execute(
                """
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.is_active,
                    r.name AS role_name
                FROM users u
                JOIN roles r
                  ON r.id = u.role_id
                WHERE LOWER(u.email) = %s;
                """,
                (email,),
            )
            user = cur.fetchone()

            rejection = _privacy_safe_enrollment_rejection(
                email,
                user,
            )
            if rejection is not None:
                rejected.append(rejection)
                continue

            cur.execute(
                """
                SELECT id, is_active
                FROM course_memberships
                WHERE course_id = %s
                  AND user_id = %s
                FOR UPDATE;
                """,
                (course_id, user["id"]),
            )
            membership = cur.fetchone()

            item = {
                "userId": user["id"],
                "fullName": user["full_name"],
                "email": user["email"],
            }

            if membership is None:
                cur.execute(
                    """
                    INSERT INTO course_memberships (
                        course_id,
                        user_id,
                        is_active,
                        membership_source,
                        added_by_user_id,
                        created_at,
                        updated_at,
                        removed_at
                    )
                    VALUES (
                        %s, %s, TRUE, %s, %s, NOW(), NOW(), NULL
                    )
                    RETURNING id;
                    """,
                    (
                        course_id,
                        user["id"],
                        source,
                        g.current_user["id"],
                    ),
                )
                item["membershipId"] = cur.fetchone()["id"]
                added.append(item)
                continue

            item["membershipId"] = membership["id"]

            if membership["is_active"]:
                already_active.append(item)
                continue

            cur.execute(
                """
                UPDATE course_memberships
                SET
                    is_active = TRUE,
                    membership_source = %s,
                    added_by_user_id = %s,
                    updated_at = NOW(),
                    removed_at = NULL
                WHERE id = %s;
                """,
                (
                    source,
                    g.current_user["id"],
                    membership["id"],
                ),
            )
            reactivated.append(item)

        _audit(
            cur,
            "add_course_students",
            student_batch_audit_description(
                course_id=course_id,
                actor=g.current_user.get("email"),
                added_count=len(added),
                reactivated_count=len(reactivated),
                already_active_count=len(already_active),
                rejected_count=len(rejected),
            ),
        )

    return jsonify(
        {
            "courseId": course["id"],
            "added": added,
            "reactivated": reactivated,
            "alreadyActive": already_active,
            "rejected": rejected,
            "summary": {
                "requested": len(emails),
                "added": len(added),
                "reactivated": len(reactivated),
                "alreadyActive": len(already_active),
                "rejected": len(rejected),
            },
        }
    ), 200


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>",
    methods=["DELETE"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def remove_course_student(course_id, user_id):
    with db_cursor() as (conn, cur):
        _load_course(cur, course_id)

        cur.execute(
            """
            SELECT
                cm.id,
                cm.is_active,
                u.email
            FROM course_memberships cm
            JOIN users u
              ON u.id = cm.user_id
            WHERE cm.course_id = %s
              AND cm.user_id = %s
            FOR UPDATE;
            """,
            (course_id, user_id),
        )
        membership = cur.fetchone()

        if membership is None:
            raise NotFoundError(
                "El estudiante no pertenece a este curso."
            )

        if membership["is_active"]:
            cur.execute(
                """
                UPDATE course_memberships
                SET
                    is_active = FALSE,
                    updated_at = NOW(),
                    removed_at = NOW()
                WHERE id = %s;
                """,
                (membership["id"],),
            )

        _audit(
            cur,
            "remove_course_student",
            (
                "Usuario {email} retirado del curso #{course_id} "
                "por {actor}."
            ).format(
                email=membership["email"],
                course_id=course_id,
                actor=g.current_user.get("email"),
            ),
        )

    return jsonify(
        {
            "courseId": course_id,
            "userId": user_id,
            "membershipActive": False,
        }
    ), 200


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>/restore",
    methods=["POST"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def restore_course_student(course_id, user_id):
    with db_cursor() as (conn, cur):
        _load_course(
            cur,
            course_id,
            require_active=True,
        )

        cur.execute(
            """
            SELECT
                cm.id,
                cm.is_active,
                u.email,
                u.is_active AS user_active,
                r.name AS role_name
            FROM course_memberships cm
            JOIN users u
              ON u.id = cm.user_id
            JOIN roles r
              ON r.id = u.role_id
            WHERE cm.course_id = %s
              AND cm.user_id = %s
            FOR UPDATE;
            """,
            (course_id, user_id),
        )
        membership = cur.fetchone()

        if membership is None:
            raise NotFoundError(
                "El estudiante no pertenece a este curso."
            )

        if not _is_enrollable_student(
            membership.get("role_name"),
            membership.get("user_active"),
        ):
            raise ValidationError(
                "La cuenta ya no está disponible para reactivación "
                "como estudiante."
            )

        if not membership["is_active"]:
            cur.execute(
                """
                UPDATE course_memberships
                SET
                    is_active = TRUE,
                    membership_source = 'MANUAL',
                    added_by_user_id = %s,
                    updated_at = NOW(),
                    removed_at = NULL
                WHERE id = %s;
                """,
                (
                    g.current_user["id"],
                    membership["id"],
                ),
            )

        _audit(
            cur,
            "restore_course_student",
            (
                "Usuario {email} restaurado en curso #{course_id} "
                "por {actor}."
            ).format(
                email=membership["email"],
                course_id=course_id,
                actor=g.current_user.get("email"),
            ),
        )

    return jsonify(
        {
            "courseId": course_id,
            "userId": user_id,
            "membershipActive": True,
        }
    ), 200

# =========================================================================
# CORE-07F-6 — FICHA DOCENTE DE ESTUDIANTE DENTRO DE UN CURSO
# =========================================================================

def _load_course_student(cur, course_id, user_id):
    """
    Verifica simultáneamente:
    - que el curso esté dentro del scope del Teacher/Admin autenticado;
    - que el usuario tenga o haya tenido membresía en ese curso.

    La ficha puede consultarse aunque el curso o la membresía estén
    finalizados/inactivos, preservando supervisión histórica.
    """
    course = _load_course(
        cur,
        course_id,
        require_active=False,
    )

    cur.execute(
        """
        SELECT
            cm.id AS membership_id,
            cm.is_active AS membership_active,
            cm.membership_source,
            cm.created_at AS membership_created_at,
            cm.updated_at AS membership_updated_at,
            cm.removed_at,
            u.id AS user_id,
            u.full_name,
            u.email,
            u.is_active AS user_active,
            u.created_at AS user_created_at,
            u.last_login,
            r.name AS role_name
        FROM course_memberships cm
        JOIN users u
          ON u.id = cm.user_id
        LEFT JOIN roles r
          ON r.id = u.role_id
        WHERE cm.course_id = %s
          AND cm.user_id = %s;
        """,
        (course_id, user_id),
    )
    student = cur.fetchone()

    if student is None:
        raise NotFoundError(
            "El estudiante no pertenece a este curso."
        )

    return course, student


def _course_student_summary(cur, course_id, user_id):
    cur.execute(
        """
        SELECT
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
            ) AS cancelled_executions,
            MAX(
                COALESCE(
                    e.finished_at,
                    e.processing_at,
                    e.started_at,
                    e.queued_at,
                    e.created_at,
                    s.created_at
                )
            ) AS last_activity_at
        FROM submissions s
        LEFT JOIN executions e
          ON e.submission_id = s.id
        WHERE s.course_id = %s
          AND s.user_id = %s;
        """,
        (course_id, user_id),
    )

    row = cur.fetchone() or {}

    return {
        "submissions": int(
            row.get("submissions_count") or 0
        ),
        "executions": int(
            row.get("executions_count") or 0
        ),
        "completedExecutions": int(
            row.get("completed_executions") or 0
        ),
        "failedExecutions": int(
            row.get("failed_executions") or 0
        ),
        "queuedExecutions": int(
            row.get("queued_executions") or 0
        ),
        "runningExecutions": int(
            row.get("running_executions") or 0
        ),
        "processingExecutions": int(
            row.get("processing_executions") or 0
        ),
        "cancelledExecutions": int(
            row.get("cancelled_executions") or 0
        ),
        "lastActivityAt": _iso(
            row.get("last_activity_at")
        ),
    }


def _teacher_submission_status(row):
    executions = int(
        row.get("executions_count") or 0
    )
    completed = int(
        row.get("completed_executions") or 0
    )
    failed = int(
        row.get("failed_executions") or 0
    )
    active = (
        int(row.get("queued_executions") or 0)
        + int(row.get("running_executions") or 0)
        + int(row.get("processing_executions") or 0)
    )

    if executions == 0:
        return "Sin ejecuciones"
    if active > 0:
        return "Con ejecuciones activas"
    if completed > 0 and failed == 0:
        return "Completada"
    if failed > 0 and completed == 0:
        return "Con fallos"
    if completed > 0 and failed > 0:
        return "Mixta"

    return "Sin estado derivado"


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course_student_detail(course_id, user_id):
    """
    Ficha docente acotada a una única instancia de curso.

    No expone auditoría administrativa ni actividad perteneciente
    a otros cursos/semestres del estudiante.
    """
    conn = get_connection()

    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            course, student = _load_course_student(
                cur,
                course_id,
                user_id,
            )

            summary = _course_student_summary(
                cur,
                course_id,
                user_id,
            )

        profile = {
            "id": student["user_id"],
            "fullName": student.get("full_name"),
            "email": student.get("email"),
            "userActive": bool(
                student.get("user_active")
            ),
            "role": student.get("role_name"),
            "createdAt": _iso(
                student.get("user_created_at")
            ),
            "lastLogin": _iso(
                student.get("last_login")
            ),
            "membership": {
                "id": student.get("membership_id"),
                "isActive": bool(
                    student.get("membership_active")
                ),
                "source": student.get(
                    "membership_source"
                ),
                "createdAt": _iso(
                    student.get(
                        "membership_created_at"
                    )
                ),
                "updatedAt": _iso(
                    student.get(
                        "membership_updated_at"
                    )
                ),
                "removedAt": _iso(
                    student.get("removed_at")
                ),
            },
        }

        course_payload = {
            "id": course["id"],
            "code": course["code"],
            "name": course["name"],
            "academicYear": course["academic_year"],
            "academicTerm": course["academic_term"],
            "isActive": bool(course["is_active"]),
            "teacher": {
                "id": course["teacher_user_id"],
                "fullName": course.get(
                    "teacher_full_name"
                ),
                "email": course.get(
                    "teacher_email"
                ),
            },
        }

        return jsonify(
            {
                "course": course_payload,
                "profile": profile,
                "summary": summary,
            }
        ), 200

    finally:
        conn.close()


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>/executions",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course_student_executions(course_id, user_id):
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
    page = request.args.get(
        "page",
        1,
        type=int,
    )
    page_size = request.args.get(
        "page_size",
        15,
        type=int,
    )

    if page < 1:
        raise BadRequestError(
            "El parámetro 'page' debe ser >= 1."
        )
    if page_size < 1 or page_size > 200:
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
            _load_course_student(
                cur,
                course_id,
                user_id,
            )

            base_sql = """
            FROM executions e
            JOIN submissions s
              ON s.id = e.submission_id
            LEFT JOIN hardware_profiles hp
              ON hp.id = e.hardware_profile_id
            WHERE s.course_id = %s
              AND s.user_id = %s
            """ + filter_sql

            params = [
                course_id,
                user_id,
            ] + filter_params

            if problem:
                base_sql += (
                    " AND LOWER(COALESCE(s.title, '')) LIKE %s "
                )
                params.append(
                    "%{}%".format(problem)
                )

            cur.execute(
                "SELECT COUNT(*) AS total "
                + base_sql,
                params,
            )
            total = int(
                (cur.fetchone() or {}).get("total")
                or 0
            )

            cur.execute(
                """
                SELECT
                    e.id AS execution_id,
                    e.public_id::text AS public_id,
                    e.codename,
                    e.execution_config ->> 'original_filename'
                      AS original_filename,
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
                    e.hardware_snapshot,
                    s.title AS submission_title,
                    hp.name AS hardware_name
                """
                + base_sql
                + """
                ORDER BY e.id DESC
                LIMIT %s OFFSET %s;
                """,
                params + [
                    page_size,
                    offset,
                ],
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


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>/submissions",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course_student_submissions(course_id, user_id):
    problem = request.args.get(
        "problem",
        "",
        type=str,
    ).strip().lower()
    page = request.args.get(
        "page",
        1,
        type=int,
    )
    page_size = request.args.get(
        "page_size",
        15,
        type=int,
    )

    if page < 1:
        raise BadRequestError(
            "El parámetro 'page' debe ser >= 1."
        )
    if page_size < 1 or page_size > 200:
        raise BadRequestError(
            "El parámetro 'page_size' debe estar entre 1 y 200."
        )

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            _load_course_student(
                cur,
                course_id,
                user_id,
            )

            where_extra = ""
            params = [
                course_id,
                user_id,
            ]

            if problem:
                where_extra = (
                    " AND LOWER(COALESCE(s.title, '')) LIKE %s "
                )
                params.append(
                    "%{}%".format(problem)
                )

            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM submissions s
                WHERE s.course_id = %s
                  AND s.user_id = %s
                """
                + where_extra,
                params,
            )
            total = int(
                (cur.fetchone() or {}).get("total")
                or 0
            )

            cur.execute(
                """
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
                WHERE s.course_id = %s
                  AND s.user_id = %s
                """
                + where_extra
                + """
                GROUP BY
                    s.id,
                    s.title,
                    s.created_at
                ORDER BY s.created_at DESC NULLS LAST,
                         s.id DESC
                LIMIT %s OFFSET %s;
                """,
                params + [
                    page_size,
                    offset,
                ],
            )

            rows = cur.fetchall()

        items = []
        for row in rows:
            item = {
                "id": row["id"],
                "title": row.get("title"),
                "createdAt": _iso(
                    row.get("created_at")
                ),
                "executions": int(
                    row.get("executions_count") or 0
                ),
                "completed": int(
                    row.get("completed_executions")
                    or 0
                ),
                "failed": int(
                    row.get("failed_executions") or 0
                ),
                "queued": int(
                    row.get("queued_executions") or 0
                ),
                "running": int(
                    row.get("running_executions") or 0
                ),
                "processing": int(
                    row.get("processing_executions")
                    or 0
                ),
                "cancelled": int(
                    row.get("cancelled_executions")
                    or 0
                ),
            }
            item["status"] = (
                _teacher_submission_status(row)
            )
            items.append(item)

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


@teacher_courses_bp.route(
    "/teacher/courses/<int:course_id>/students/<int:user_id>/executions/<int:execution_id>",
    methods=["GET"],
)
@login_required
@teacher_or_admin_required
@handle_api_errors
def get_course_student_execution_detail(
    course_id,
    user_id,
    execution_id,
):
    """
    Detalle técnico de ejecución con scope estricto
    curso + estudiante.
    """
    conn = get_connection()

    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cur:
            _load_course_student(
                cur,
                course_id,
                user_id,
            )

            cur.execute(
                """
                SELECT
                    e.id AS execution_id,
                    e.public_id::text AS public_id,
                    e.codename,
                    e.execution_config ->> 'original_filename'
                      AS original_filename,
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
                WHERE e.id = %s
                  AND s.user_id = %s
                  AND s.course_id = %s;
                """,
                (
                    execution_id,
                    user_id,
                    course_id,
                ),
            )

            row = cur.fetchone()

            if row is None:
                raise NotFoundError(
                    "La ejecución no pertenece a este "
                    "estudiante dentro del curso."
                )

        execution = (
            serialize_execution_history_row(
                row
            )
        )

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
                "queuedAt": _iso(
                    row.get("queued_at")
                ),
                "createdAt": _iso(
                    row.get("created_at")
                ),
            }
        )

        return jsonify(
            {
                "execution": execution,
            }
        ), 200

    finally:
        conn.close()
