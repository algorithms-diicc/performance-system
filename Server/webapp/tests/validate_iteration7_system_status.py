#!/usr/bin/env python3
"""Validador estructural focal de Iteración 7B (no sustituye tests)."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[3]
checks = []


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(label, condition):
    passed = bool(condition)
    checks.append(passed)
    print("{:<84} {}".format(label, "PASS" if passed else "FAIL"))


repository = read(
    "Server/webapp/repositories/system_status_repository.py"
)
service = read("Server/webapp/services/system_status_service.py")
route = read("Server/webapp/routes/admin_system_status_routes.py")
app = read("Server/webapp/app.py")
screen = read("Client/my-app/src/screens/AdminSystemStatus.js")
screen_css = read("Client/my-app/src/screens/AdminSystemStatus.css")
admin_layout = read("Client/my-app/src/screens/AdminLayout.js")
app_js = read("Client/my-app/src/App.js")
locale_es = read("Client/my-app/src/i18n/locales/es.js")
locale_en = read("Client/my-app/src/i18n/locales/en.js")

production_status_sources = "\n".join((repository, service, route, screen))

check(
    "Endpoint y blueprint nuevos están registrados",
    'url_prefix="/api/admin/system-status"' in route
    and "app.register_blueprint(admin_system_status_bp)" in app,
)
check(
    "Endpoint exige sesión y rol Admin",
    "@login_required\n@admin_required" in route,
)
check(
    "Ruta y subnav Admin existen sin entrada global Navbar",
    '<Route path="system-status" element={<AdminSystemStatus />} />' in app_js
    and 'to="/admin/system-status"' in admin_layout
    and "/admin/system-status" not in read(
        "Client/my-app/src/common/Navbar.js"
    ),
)
check(
    "Repository usa solo SELECT/CTE y no controla transacciones",
    "WITH operational AS" in repository
    and "FROM executions e" in repository
    and not re.search(
        r"\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b",
        repository,
    )
    and ".commit(" not in repository
    and ".rollback(" not in repository,
)
check(
    "Stale limita RUNNING/PROCESSING con frontera exacta <=",
    "e.execution_state IN ('RUNNING', 'PROCESSING')" in repository
    and "COALESCE(e.last_heartbeat_at, e.updated_at) <= %s"
    in repository,
)
check(
    "QUEUED se cuenta pero nunca participa en stale",
    "e.execution_state = 'QUEUED'" in repository
    and "e.execution_state = 'QUEUED'\n                  AND COALESCE"
    not in repository,
)
check(
    "pg_locks usa DB exacta, objsubid y mitades de signed bigint",
    "FROM pg_catalog.pg_locks l" in repository
    and "d.datname = current_database()" in repository
    and "l.objsubid = 1" in repository
    and "(r.lock_key >> 32) & 4294967295::bigint" in repository
    and "r.lock_key & 4294967295::bigint" in repository,
)
check(
    "No se adquieren ni liberan advisory locks",
    "pg_try_advisory" not in repository
    and "pg_advisory_unlock" not in repository
    and "pg_advisory_lock(" not in repository,
)
check(
    "Procesos auxiliares solo publican LOCK_* o UNKNOWN",
    all(
        token in production_status_sources
        for token in ("LOCK_OBSERVED", "LOCK_NOT_OBSERVED", "UNKNOWN")
    )
    and all(
        forbidden not in production_status_sources
        for forbidden in ("HEALTHY", "UNHEALTHY", "ONLINE", "OFFLINE")
    ),
)
check(
    "Fallo de pg_locks no degrada la consulta principal",
    "lock_signals = dict(UNKNOWN_LOCK_SIGNALS)" in repository
    and '"operational": dict(row)' in repository,
)
check(
    "Estados públicos de DB distinguen AVAILABLE/UNAVAILABLE/UNKNOWN",
    'DATABASE_AVAILABLE = "AVAILABLE"' in service
    and 'DATABASE_UNAVAILABLE = "UNAVAILABLE"' in service
    and 'DATABASE_UNKNOWN = "UNKNOWN"' in service
    and "except system_status_repository.DatabaseUnavailable" in service
    and "except system_status_repository.DiagnosticQueryUnavailable"
    in service,
)
check(
    "Sin DB, cola/snapshot son null y locks UNKNOWN",
    '"queued": None' in service
    and '"observedAt": None' in service
    and '"dispatcher": {"signal": signal_for("dispatcher")}' in service
    and 'LOCK_UNKNOWN = "UNKNOWN"' in service,
)
check(
    "Snapshot actual 1.0 se proyecta como histórico",
    "->> 'schema_version' = '1.0'" in repository
    and '"historical": True' in service
    and '"source": "LATEST_PERSISTED_EXECUTION"' in service,
)

public_snapshot_keys = (
    "observedAt",
    "snapshotSchemaVersion",
    "cpuModel",
    "architecture",
    "logicalCpus",
    "perfVersion",
    "perfEventParanoid",
    "eventExposed",
    "probeState",
    "measurementAvailable",
)
check(
    "Snapshot usa whitelist pública y no devuelve JSONB completo",
    all('"{}"'.format(key) in service for key in public_snapshot_keys)
    and "AS hardware_snapshot" not in repository
    and all(
        '"{}"'.format(forbidden) not in service
        for forbidden in (
            "hostname",
            "cpuVendor",
            "event",
            "powercap",
            "env",
            "path",
        )
    ),
)
check(
    "Energía mapea package/cores/ram y localiza probe states conocidos",
    all(
        marker in service
        for marker in (
            '("package", "package")',
            '("cores", "cores")',
            '("ram", "ram")',
        )
    )
    and all(
        marker in locale_es and marker in locale_en
        for marker in (
            "numeric:",
            "permission_denied:",
            "not_supported:",
            "not_counted:",
            "event_not_exposed:",
            "backend_error:",
            "no_numeric_sample:",
        )
    ),
)

allowed_environment_keys = {
    "EXECUTION_MODE",
    "EXECUTION_HEARTBEAT_SECONDS",
    "RECOVERY_ACTIVE_STALE_SECONDS",
    "EXECUTION_DISPATCHER_LOCK_KEY",
    "RECOVERY_WATCHDOG_LOCK_KEY",
}
observed_environment_keys = set(
    re.findall(r'environment\.get\("([A-Z0-9_]+)"', service)
)
check(
    "Runtime lee únicamente la whitelist de configuración segura",
    observed_environment_keys == allowed_environment_keys,
)
check(
    "Contrato no expone lock keys, secretos, IDs ni errores raw",
    '"lockKey"' not in service
    and '"lock_key"' not in service
    and '"pid"' not in service.casefold()
    and '"publicId"' not in service
    and '"user"' not in service.casefold()
    and "str(exc)" not in production_status_sources
    and "DB_PASSWORD" not in production_status_sources,
)
check(
    "Nueva vista no consume checkmeasurers ni afirma liveness del slave",
    "/checkmeasurers" not in production_status_sources
    and "slave" not in production_status_sources.casefold(),
)
check(
    "Endpoints legacy permanecen registrados",
    '@app.route("/hola", methods=["GET"])' in app
    and '@app.route("/checkmeasurers", methods=["GET"])' in app
    and '@app.route("/api/health/db", methods=["GET"])' in app,
)
check(
    "Refresh es manual y no existe polling/temporizador",
    "loadStatus();" in screen
    and 't("adminSystemStatus.actions.refresh")' in screen
    and "setInterval" not in screen
    and "setTimeout" not in screen,
)
check(
    "Refresh conserva la última respuesta válida y muestra error inline",
    "setData(null)" not in screen
    and "setData(response)" in screen
    and 'role="alert"' in screen
    and "setError(requestError)" in screen,
)
check(
    "Copy neutral obligatorio existe en ES/EN",
    "no garantiza progreso ni equivale a un health check" in locale_es
    and "does not guarantee progress and is not a health check" in locale_en
    and "no implica una falla global" in locale_es
    and "does not imply a global system failure" in locale_en
    and "no representan health en vivo" in locale_es
    and "do not represent live health" in locale_en,
)
check(
    "UI usa tokens de tema para dark/light y conserva valores técnicos raw",
    "var(--color-surface)" in screen_css
    and "var(--color-text-main)" in screen_css
    and "var(--ps-success-soft)" in screen_css
    and "technical={measurement.cpuModel != null}" in screen
    and "technical={measurement.perfVersion != null}" in screen
    and "technical={measurement.perfEventParanoid != null}" in screen,
)
check(
    "Timestamps DB se serializan con isoformat sin añadir Z/UTC",
    'return isoformat()' in service
    and ' + "Z"' not in service
    and "UTC" not in screen,
)
check(
    "Tests focales backend/frontend previstos existen",
    all(
        (ROOT / path).is_file()
        for path in (
            "Server/tests/test_system_status_repository.py",
            "Server/tests/test_system_status_service.py",
            "Server/tests/test_admin_system_status_routes.py",
            "Client/my-app/src/screens/AdminSystemStatus.test.js",
            "Client/my-app/src/screens/AdminSystemStatusI18n.test.js",
        )
    ),
)

status_output = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout.splitlines()
changed_paths = [line[3:] for line in status_output if len(line) > 3]
forbidden_parts = (
    "Server/db/schema.sql",
    "migration",
    ".env",
    "recovery_watchdog.py",
    "perf/",
    "Tutorial",
)
check(
    "Integración 8D no toca schema/config/watchdog/perf/Tutorial",
    not any(
        forbidden.casefold() in path.casefold()
        for path in changed_paths
        for forbidden in forbidden_parts
    ),
)

passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 7B — DIAGNÓSTICO OPERACIONAL ADMIN")
print("================================================")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
