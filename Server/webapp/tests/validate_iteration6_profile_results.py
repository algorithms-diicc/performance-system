#!/usr/bin/env python3
"""Validador estructural focal de Iteración 6 (no sustituye tests)."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[3]
checks = []


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(label, condition):
    passed = bool(condition)
    checks.append(passed)
    print("{:<78} {}".format(label, "PASS" if passed else "FAIL"))


navbar = read("Client/my-app/src/common/Navbar.js")
profile_page = read("Client/my-app/src/screens/ProfilePage.js")
profile_routes = read("Server/webapp/routes/profile_routes.py")
reproducibility = read(
    "Client/my-app/src/components/ReproducibilityPanel.js"
)
reproducibility_tests = read(
    "Client/my-app/src/components/ReproducibilityPanelI18n.test.js"
)
locale_es = read("Client/my-app/src/i18n/locales/es.js")
locale_en = read("Client/my-app/src/i18n/locales/en.js")

check(
    "Navbar usa Link de React Router para Perfil y cierra el menú",
    'to="/profile"' in navbar
    and "window.location.href" not in navbar
    and "onClick={() => setIsUserMenuOpen(false)}" in navbar,
)
check(
    "Navbar conserva el handler de logout existente",
    "onClick={handleLogout}" in navbar,
)
check(
    "Perfil preserva Experimentos y delimita cursos para análisis ES/EN",
    'submissions: "Experimentos"' in locale_es
    and 'submissions: "Experiments"' in locale_en
    and 'coursesTitle: "Cursos para mis análisis"' in locale_es
    and 'coursesTitle: "Courses for my analyses"' in locale_en
    and '"/api/student/courses"' in profile_page
    and '"/teacher/courses"' not in profile_page,
)
check(
    "Perfil consume duración de latest y no el promedio histórico",
    "summary.lastExecutionDurationMs" in profile_page
    and "summary.avgDurationMs" not in profile_page
    and 't("profile.duration")' in profile_page,
)
check(
    "Backend expone latest duration desde la misma fila por e.id DESC",
    '"lastExecutionDurationMs"' in profile_routes
    and "last_execution_duration_ms(last_exec)" in profile_routes
    and "e.duration_ms" in profile_routes
    and "e.started_at" in profile_routes
    and "e.finished_at" in profile_routes
    and "ORDER BY e.id DESC" in profile_routes,
)
check(
    "Backend nunca usa NOW() para duración de una Execution activa",
    "NOW()" not in profile_routes,
)
check(
    "Resultado localiza estados sin renderizar execution.state raw",
    "executionStateLabel(execution.state, t)" in reproducibility
    and "value={execution.state}" not in reproducibility
    and 'COMPLETED: "completed"' in reproducibility,
)
check(
    "Warmup se presenta como Rondas de calentamiento / Warmup rounds",
    'warmupRounds: "Rondas de calentamiento"' in locale_es
    and 'warmupRounds: "Warmup rounds"' in locale_en,
)
check(
    "Valores técnicos continúan enlazados al payload y cubiertos raw",
    "value={cpu.architecture}" in reproducibility
    and "value={measurementBackend.name}" in reproducibility
    and "value={configuration.compilerFlags}" in reproducibility
    and all(
        marker in reproducibility_tests
        for marker in ("AuthenticAMD", "x86_64", '"perf"', "-O3")
    ),
)
check(
    "Navegación Experimento, Resultado e Historial permanece en Perfil",
    "`/submissions/${encodeURIComponent(" in profile_page
    and "`/code/${summary.lastExecutionCodename}`" in profile_page
    and '<Link to="/history"' in profile_page,
)

status = subprocess.run(
    ["git", "status", "--porcelain"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout.splitlines()
changed_paths = [line[3:] for line in status if len(line) > 3]
forbidden_parts = (
    "Server/db/schema.sql",
    "migration",
    ".env",
    "perf/",
    "slave.py",
    "dispatcher",
    "ComparisonPage",
    "comparison_service",
    "results_service",
    "reproducibility_service.py",
)
check(
    "working tree no toca schema/config/perf/slave/dispatcher/ciencia",
    not any(
        forbidden.casefold() in path.casefold()
        for path in changed_paths
        for forbidden in forbidden_parts
    ),
)

passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 6 — PERFIL Y RESULTADO INDIVIDUAL")
print("============================================")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
