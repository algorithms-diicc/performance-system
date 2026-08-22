#!/usr/bin/env python3
from pathlib import Path
import os
import py_compile
import sys


def find_root():
    candidates = [Path.cwd().resolve()]
    env = os.environ.get("PERF_SYSTEM_ROOT")
    if env:
        candidates.insert(0, Path(env).expanduser().resolve())

    for candidate in candidates:
        for root in [candidate, *candidate.parents]:
            if (
                (root / "Server/webapp/routes/admin_users_routes.py").is_file()
                and (root / "Client/my-app/src/screens/AdminUser.js").is_file()
            ):
                return root

    raise SystemExit("No pude localizar performance-system.")


ROOT = find_root()
checks = []


def check(label, condition):
    ok = bool(condition)
    checks.append(ok)
    print("{:<68} {}".format(label, "PASS" if ok else "FAIL"))


backend_path = ROOT / "Server/webapp/routes/admin_users_routes.py"
frontend_path = ROOT / "Client/my-app/src/screens/AdminUser.js"
css_path = ROOT / "Client/my-app/src/screens/AdminUser.css"

try:
    py_compile.compile(str(backend_path), doraise=True)
    check("admin_users_routes.py compila", True)
except Exception as exc:
    print(exc)
    check("admin_users_routes.py compila", False)

backend = backend_path.read_text(encoding="utf-8")
frontend = frontend_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
frontend_compact = "".join(frontend.split())

check(
    "backend calcula total filtrado",
    "filtered_total" in backend
    and '"filteredTotal": filtered_total' in backend
    and '"total": filtered_total' in backend,
)
check(
    "backend mantiene paginación",
    "LIMIT %s OFFSET %s" in backend
    and '"totalPages": total_pages' in backend,
)
check(
    "backend rechaza estado administrativo inexistente",
    'raise BadRequestError(' in backend
    and "Valor inválido para 'status'." in backend,
)
check(
    "frontend consulta filtros/paginación en API",
    "URLSearchParams" in frontend
    and 'params.set("search",' in frontend_compact
    and 'params.set("role",' in frontend_compact
    and 'params.set("status",' in frontend_compact
    and "page_size:String(pageSize)" in frontend_compact,
)
check(
    "frontend no contiene acciones mock",
    "(mock)" not in frontend
    and "Re-ejecutar" not in frontend,
)
check(
    "frontend separa envíos y ejecuciones",
    "user.submissionsCount" in frontend
    and "user.executionsCount" in frontend
    and "completedExecutions" in frontend,
)
check(
    "frontend muestra inactivos y no bloqueados ficticios",
    '<option value="inactive">' in frontend
    and "adminUsers.summary.inactive" in frontend
    and "blocked" not in frontend.casefold(),
)
check(
    "frontend formatea fechas ISO",
    'from "../i18n/formatters"' in frontend
    and "formatDateTime(" in frontend
    and "user.lastExecutionAt" in frontend
    and "user.createdAt" in frontend,
)
check(
    "listado usa paginación explícita",
    '"adminUsers.pagination.page"' in frontend
    and "setPage" in frontend
    and "totalPages" in frontend
    and "PAGE_SIZES" in frontend,
)
check(
    "CSS evita colores forzados del antiguo dark-only",
    ".app-title {\n    color: #f9fafb !important;" not in css
    and "background: #0f172a !important" not in css
    and "var(--color-text-main)" in css
    and "var(--color-surface)" in css,
)
check(
    "tabla no tiene max-height/scroll vertical interno",
    "max-height:" not in css
    or ".admin-users-table" not in css.split("max-height:")[0][-200:],
)

passed = sum(checks)
total = len(checks)

print("")
print("CORE-07B-1")
print("===========")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
