#!/usr/bin/env python3
from pathlib import Path
import os


def find_root():
    candidates = [Path.cwd().resolve()]
    configured = os.environ.get("PERF_SYSTEM_ROOT")
    if configured:
        candidates.insert(0, Path(configured).expanduser().resolve())

    for candidate in candidates:
        for root in (candidate, *candidate.parents):
            if (
                (root / "Client/my-app/src/screens/RenderForm/RenderFormPage.js").is_file()
                and (root / "Server/webapp/services/execution_query_service.py").is_file()
            ):
                return root

    raise SystemExit("No pude localizar performance-system.")


ROOT = find_root()
checks = []


def check(label, condition):
    ok = bool(condition)
    checks.append(ok)
    print("{:<76} {}".format(label, "PASS" if ok else "FAIL"))


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


page = read("Client/my-app/src/screens/RenderForm/RenderFormPage.js")
params = read(
    "Client/my-app/src/screens/RenderForm/components/TestTypeAndParamsCard.js"
)
overview = read(
    "Client/my-app/src/screens/RenderForm/components/OverviewModal.js"
)
status = read("Client/my-app/src/screens/RenderForm/components/StatusPanel.js")
polling = read(
    "Client/my-app/src/screens/RenderForm/hooks/executionPollingModel.js"
)
readiness = read(
    "Client/my-app/src/screens/RenderForm/analysisReadinessModel.js"
)
profile = read(
    "Client/my-app/src/screens/RenderForm/executionProfileModel.js"
)
app = read("Client/my-app/src/App.js")
es = read("Client/my-app/src/i18n/locales/es.js")
en = read("Client/my-app/src/i18n/locales/en.js")
repository = read(
    "Server/webapp/repositories/execution_query_repository.py"
)
service = read("Server/webapp/services/execution_query_service.py")

check(
    "perfiles canónicos fijan 10/30/50",
    all(
        token in profile
        for token in ("rapido: 10", "equilibrado: 30", "exhaustivo: 50")
    ),
)
check(
    "solo Personalizado conserva controles manuales 1–100",
    'profileId === "personalizado"' in params
    and 'min={limitsSamples?.min ?? 1}' in params
    and 'max={limitsSamples?.max ?? 100}' in params
    and "samplesPresets" not in params
    and "samplesPresets" not in page,
)
check(
    "readiness puro gobierna botón y defensa del submit",
    "buildAnalysisRequirements" in readiness
    and "analysisRequirements.length > 0" in page
    and "requirements={analysisRequirements}" in page,
)
check(
    "RenderFormPage no usa diálogos nativos",
    all(
        token not in page
        for token in ("alert(", "window.alert", "confirm(", "prompt(")
    ),
)
check(
    "review recibe metadata CPP e identidad institucional",
    "fileMeta={fileMeta}" in page
    and "cppSample" in overview
    and "additionalSources" in overview
    and "currentUser={currentUser}" in app,
)
check(
    "draft significativo se anuncia y puede limpiarse",
    "hasMeaningfulDraft" in page
    and "draftRestored" in page
    and "renderForm.page.draft.clear" in page,
)
check(
    "polling emite eventos semánticos sin frases ni emojis de UI",
    "buildEventsFromSnapshot" in polling
    and 'event(snapshot.queuedAt, "queued")' in polling
    and all(
        token not in polling
        for token in (
            "Archivo añadido",
            "Enviando test al slave",
            "Generando gráficos",
            "📦",
            "🚚",
            "📊",
        )
    ),
)
check(
    "eventos y cola tienen copy ES/EN",
    all(
        token in locale
        for locale in (es, en)
        for token in ("failedWithMessage", "queue:", "ahead:", "explanation:")
    ),
)
check(
    "UI muestra queueAhead por Execution sin ETA",
    "QueuePositions" in status
    and "execution.queueAhead === 0" in status
    and "execution.originalName" in status
    and "ETA" not in status,
)
check(
    "snapshot calcula FIFO exacto sin bloqueo",
    "ROW_NUMBER() OVER" in repository
    and "ORDER BY queued_at ASC NULLS LAST, id ASC" in repository
    and "FOR UPDATE" not in repository,
)
check(
    "API limita queueAhead a QUEUED y null fuera de cola",
    'if state == "QUEUED"' in service
    and '"queueAhead": queue_ahead' in service,
)
check(
    "no se exponen filas ni identidades ajenas en el payload",
    "queuedExecutions" not in service
    and "queueOwners" not in service
    and '"ownerUserId"' not in service,
)

passed = sum(checks)
total = len(checks)

print("")
print("ITERACIÓN 4 — NUEVO ANÁLISIS Y COLA")
print("=====================================")
print("{}/{} checks passed".format(passed, total))

if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
