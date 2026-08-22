#!/usr/bin/env python3
from pathlib import Path
import os
import py_compile


def find_root():
    candidates = [Path.cwd().resolve()]
    configured = os.environ.get("PERF_SYSTEM_ROOT")
    if configured:
        candidates.insert(0, Path(configured).expanduser().resolve())

    for candidate in candidates:
        for root in (candidate, *candidate.parents):
            if (
                (root / "Client/my-app/src/screens/TeacherCourseDetail.js").is_file()
                and (root / "Server/webapp/routes/teacher_courses_routes.py").is_file()
            ):
                return root

    raise SystemExit("No pude localizar performance-system.")


ROOT = find_root()
checks = []


def check(label, condition):
    ok = bool(condition)
    checks.append(ok)
    print("{:<72} {}".format(label, "PASS" if ok else "FAIL"))


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


app = read("Client/my-app/src/App.js")
courses = read("Client/my-app/src/screens/TeacherCourses.js")
detail = read("Client/my-app/src/screens/TeacherCourseDetail.js")
teacher_css = read("Client/my-app/src/screens/TeacherDashboard.css")
email_model = read("Client/my-app/src/screens/teacherEmailPreviewModel.js")
audit_model = read("Client/my-app/src/screens/adminAuditActionModel.js")
admin_detail = read("Client/my-app/src/screens/AdminUserDetail.js")
es = read("Client/my-app/src/i18n/locales/es.js")
en = read("Client/my-app/src/i18n/locales/en.js")
teacher_backend = read("Server/webapp/routes/teacher_courses_routes.py")
admin_backend = read("Server/webapp/routes/admin_users_routes.py")

detail_compact = "".join(detail.split())
courses_compact = "".join(courses.split())
admin_compact = "".join(admin_backend.split())
teacher_compact = "".join(teacher_backend.split())

try:
    py_compile.compile(
        str(ROOT / "Server/webapp/routes/admin_users_routes.py"),
        doraise=True,
    )
    py_compile.compile(
        str(ROOT / "Server/webapp/routes/teacher_courses_routes.py"),
        doraise=True,
    )
    check("rutas Python modificadas compilan", True)
except Exception as exc:
    print(exc)
    check("rutas Python modificadas compilan", False)

check(
    "formularios docentes usan tokens de tema, placeholder y focus",
    ".teacher-page .form-control" in teacher_css
    and ".teacher-page .form-select" in teacher_css
    and "::placeholder" in teacher_css
    and ":focus" in teacher_css
    and "var(--ps-surface" in teacher_css
    and "var(--ps-text" in teacher_css,
)
check(
    "currentUser llega a las dos superficies docentes",
    "<TeacherCourses" in app
    and "<TeacherCourseDetail" in app
    and app.count("currentUser={currentUser}") >= 5,
)
check(
    "selector responsable es exclusivo de Admin y envía ID técnico",
    "isAdminUser(currentUser)" in courses
    and "isAdminUser(currentUser)" in detail
    and "loadResponsibleCandidates" in courses
    and "loadResponsibleCandidates" in detail
    and "payload.teacherUserId" in courses
    and "payload.teacherUserId" in detail,
)
check(
    "transferencia real usa auditoría distinguible",
    "teacher_changed" in teacher_backend
    and '"transfer_course_teacher"' in teacher_backend
    and "if teacher_changed:" in teacher_backend,
)
check(
    "cambio Student/Teacher bloquea todos los cursos y protege Admin",
    '@admin_users_bp.route("/users/<int:user_id>/role"' in admin_backend
    and "FORUPDATE" in admin_compact
    and "FROMcoursesWHEREteacher_user_id=%s" in admin_compact
    and "coursesWHEREteacher_user_id=%sAND" not in admin_compact
    and 'current_role=="Admin"' in admin_compact
    and '"change_user_role"' in admin_backend,
)
check(
    "UI de rol usa ConfirmActionModal y no expone transición Admin",
    "<ConfirmActionModal" in admin_detail
    and 'if(role==="Student")' in "".join(admin_detail.split())
    and 'if(role==="Teacher")' in "".join(admin_detail.split())
    and "USER_HAS_ASSIGNED_COURSES" in admin_detail,
)
check(
    "históricos usan totalStudents y etiquetas registradas",
    "activeView?course.activeStudents:course.totalStudents" in courses_compact
    and "registeredStudents" in courses
    and "Registered students" in en
    and "Estudiantes registrados" in es,
)
check(
    "completion rate conserva valor y explicita ejecuciones completadas",
    "kpis.completionRate" in read(
        "Client/my-app/src/screens/TeacherCourseAnalytics.js"
    )
    and "Completed executions rate" in en
    and "Tasa de ejecuciones completadas" in es,
)
check(
    "tabla docente usa Completed/Completadas y no encabezado OK",
    '"Completed"' in en
    and '"Completadas"' in es
    and 't("teacherCourseDetail.students.table.completed")' in detail_compact
    and ">OK<" not in detail,
)
check(
    "preview de emails deduplica y bloquea sobre 200",
    "MAX_TEACHER_EMAILS = 200" in email_model
    and "new Set" in email_model
    and "overLimit" in email_model
    and "emailPreview.overLimit" in detail,
)
check(
    "acciones docentes eliminan diálogos nativos",
    all(
        token not in detail
        for token in (
            "window.confirm",
            "window.alert",
            "window.prompt",
        )
    )
    and detail.count("<ConfirmActionModal") >= 3,
)

clone_helper = teacher_backend.split(
    "def clone_course_in_transaction",
    1,
)[1].split(
    '@teacher_courses_bp.route("/student/courses"',
    1,
)[0]

check(
    "clone crea curso activo y solo copia memberships activas",
    '"/teacher/courses/<int:course_id>/clone"' in teacher_backend
    and "TRUE, NOW(), NOW()" in clone_helper
    and "cm.is_active = TRUE" in clone_helper
    and "copy_students" in clone_helper,
)
check(
    "clone no copia submissions/ejecuciones/resultados y queda auditado",
    "from submissions" not in clone_helper.casefold()
    and "insert into submissions" not in clone_helper.casefold()
    and "from executions" not in clone_helper.casefold()
    and "insert into executions" not in clone_helper.casefold()
    and "from results" not in clone_helper.casefold()
    and "insert into results" not in clone_helper.casefold()
    and '"clone_course"' in clone_helper,
)
check(
    "auditoría Admin humaniza las tres acciones nuevas",
    all(
        code in audit_model
        and label_key in es
        and label_key in en
        for code, label_key in (
            ("transfer_course_teacher", "transferCourseTeacher"),
            ("change_user_role", "changeUserRole"),
            ("clone_course", "cloneCourse"),
        )
    ),
)

passed = sum(checks)
total = len(checks)

print("")
print("ITERACIÓN 3 — SUPERVISIÓN")
print("=========================")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
