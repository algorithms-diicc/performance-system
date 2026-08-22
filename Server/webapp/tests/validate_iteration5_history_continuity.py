#!/usr/bin/env python3
"""Validador estructural focal de Iteración 5 (no sustituye tests)."""

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


submissions = read("Server/webapp/routes/submissions_routes.py")
history_service = read(
    "Server/webapp/services/submission_history_service.py"
)
comparison_routes = read("Server/webapp/routes/comparison_routes.py")
comparison_repository = read(
    "Server/webapp/repositories/comparison_repository.py"
)
repeat_service = read(
    "Server/webapp/services/submission_repeat_service.py"
)
history_page = read("Client/my-app/src/screens/HistoryPage.js")
breadcrumbs = read(
    "Client/my-app/src/components/AcademicBreadcrumbs.js"
)
overview = read(
    "Client/my-app/src/screens/SubmissionOverviewPage.js"
)
render_form = read(
    "Client/my-app/src/screens/RenderForm/RenderFormPage.js"
)
zip_analysis = read(
    "Client/my-app/src/screens/RenderForm/hooks/useZipAnalysis.js"
)

check(
    "CANCELLED existe en SQL, servicio agregado y UI de Historial",
    all(
        "CANCELLED" in source
        for source in (submissions, history_service, history_page)
    ),
)
check(
    "Historial busca nota y filtra Referencias dentro del CTE",
    "COALESCE(s.note, '') ILIKE %s" in submissions
    and "s.is_pinned = TRUE" in submissions
    and 'params.set("reference", "1")' in history_page,
)
check(
    "breadcrumb antepone ownership a rol y enlaza Historial",
    "if (isOwner)" in breadcrumbs
    and 'href: "/history"' in breadcrumbs
    and "permissions.canViewPrivateMetadata === true" in overview,
)
check(
    "Reference shortcut conserva owner scope y motor científico existente",
    "/comparisons/reference-candidates" in comparison_routes
    and "list_reference_candidate_executions" in comparison_repository
    and "_candidate_item(" in comparison_routes
    and "build_historical_candidate" in comparison_routes,
)
check(
    "Repeat verifica ZIP, configuración común y nunca usa endpoint rerun",
    "require_verified_archive" in repeat_service
    and "_normalized_configuration" in repeat_service
    and "analyzeArchiveFile" in render_form
    and "analyzeArchiveFile: analyzeZipFile" in zip_analysis
    and "/rerun" not in render_form,
)
check(
    "Repeat solo precarga y no contiene auto-submit",
    "setRepeatFeedback" in render_form
    and "loadRepeat" in render_form
    and "handleConfirmExecution()" not in render_form,
)
check(
    "Previous compatible restringe owner, pasado y orden nearest-first",
    "/comparisons/previous-compatible" in comparison_routes
    and "current_submission.user_id = %s" in comparison_repository
    and "e.created_at < current_execution.created_at" in comparison_repository
    and "e.id < current_execution.id" in comparison_repository
    and "ORDER BY e.created_at DESC NULLS LAST, e.id DESC"
    in comparison_repository,
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
    "slave/",
    "dispatcher",
)
check(
    "working tree no toca schema/migraciones/config/perf/slave/dispatcher",
    not any(
        forbidden.casefold() in path.casefold()
        for path in changed_paths
        for forbidden in forbidden_parts
    ),
)

passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 5 — CONTINUIDAD EXPERIMENTAL")
print("======================================")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
