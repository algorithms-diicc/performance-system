#!/usr/bin/env python3
from pathlib import Path
import os
import py_compile
import sys


def find_root():
    candidates = [Path.cwd().resolve()]
    env = os.environ.get("PERF_SYSTEM_ROOT")
    if env:
        candidates.insert(
            0,
            Path(env).expanduser().resolve(),
        )

    for candidate in candidates:
        for root in [candidate, *candidate.parents]:
            if (
                (root / "Client/my-app/src/screens/AdminUserDetail.js").is_file()
                and (root / "Server/webapp/routes/admin_users_routes.py").is_file()
            ):
                return root

    raise SystemExit("No pude localizar performance-system.")


ROOT = find_root()
checks = []


def check(label, condition):
    ok = bool(condition)
    checks.append(ok)
    print(
        "{:<72} {}".format(
            label,
            "PASS" if ok else "FAIL",
        )
    )


backend_path = ROOT / "Server/webapp/routes/admin_users_routes.py"
js_path = ROOT / "Client/my-app/src/screens/AdminUserDetail.js"
css_path = ROOT / "Client/my-app/src/screens/AdminUserDetail.css"

try:
    py_compile.compile(
        str(backend_path),
        doraise=True,
    )
    check("admin_users_routes.py compila", True)
except Exception as exc:
    print(exc)
    check("admin_users_routes.py compila", False)

backend = backend_path.read_text(encoding="utf-8")
frontend = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
frontend_compact = "".join(frontend.split())

check(
    "endpoint detalle expone benchmark/configuración/hardware",
    "e.benchmark" in backend
    and "e.execution_config" in backend
    and "e.hardware_snapshot" in backend
    and '"hardwareSnapshot"' in backend,
)
check(
    "endpoint no inventa métricas de energía",
    '"energy"' not in backend.lower()
    and "energy (mock)" not in backend.lower(),
)
check(
    "frontend usa endpoint canónico de detalle",
    "`/api/admin/executions/${executionId}`" in frontend,
)
check(
    "frontend elimina mocks",
    "(mock)" not in frontend
    and "Re-ejecutar" not in frontend
    and "Ver como estudiante" not in frontend
    and "Bloquear usuario" not in frontend,
)
check(
    "ejecuciones usan paginación backend",
    "page_size:String(PAGE_SIZE)" in frontend_compact
    and "/executions?" in frontend
    and "setPage" in frontend,
)
check(
    "submissions usan paginación backend",
    "/submissions?" in frontend
    and "SubmissionsTab" in frontend,
)
check(
    "auditoría usa paginación backend",
    "/audit-log?" in frontend
    and "AuditTab" in frontend,
)
check(
    "estado administrativo usa vocabulario canónico",
    "Aprobadas" not in frontend
    and "Rechazadas" not in frontend
    and "localizedExecutionStateLabel" in frontend,
)
check(
    "modal muestra configuración persistida",
    "samples_per_point" in frontend
    and "warmup_rounds" in frontend
    and "compiler_flags" in frontend,
)
check(
    "modal muestra snapshot de hardware persistido",
    "hardwareSnapshot" in frontend
    and "cpu_model" in frontend
    and "requested_perf_scope" in frontend,
)
check(
    "resultado real enlaza a /code/:codename",
    "to={`/code/${detail.codename}`}" in frontend,
)
check(
    "detalle usa tokens de tema claro/oscuro",
    "var(--color-text-main)" in css
    and "var(--color-surface)" in css
    and "#0f172a !important" not in css,
)
check(
    "detalle elimina scroll vertical fijo de tablas",
    "admin-table-wrapper" not in css
    and "overflow-y: scroll" not in css,
)
check(
    "gestión de rol usa contrato explícito y confirmación in-app",
    "`/api/admin/users/${id}/role`" in frontend
    and 'role:roleDecision.nextRole' in frontend_compact
    and "<ConfirmActionModal" in frontend
    and "window.confirm" not in frontend
    and "window.alert" not in frontend,
)
check(
    "usuarios Admin no exponen degradación rutinaria",
    'if(role==="Student")' in frontend_compact
    and 'if(role==="Teacher")' in frontend_compact
    and "returnnull;" in frontend_compact,
)

passed = sum(checks)
total = len(checks)

print("")
print("CORE-07C-1")
print("===========")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
