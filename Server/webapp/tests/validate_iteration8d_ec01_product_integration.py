#!/usr/bin/env python3
"""Validador estructural y hardwareless de E-C01 / Iteración 8D."""

import copy
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Server.tests.test_comparison_service import (  # noqa: E402
    build_fixture,
    set_v2_source,
)
from Server.webapp.services.comparison_candidates_service import (  # noqa: E402
    build_historical_candidate,
)
from Server.webapp.services.comparison_service import (  # noqa: E402
    build_comparison,
)


checks = []


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(label, condition):
    passed = bool(condition)
    checks.append(passed)
    print("{:<96} {}".format(label, "PASS" if passed else "FAIL"))


def unchanged_from_head(path):
    return subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", path],
        cwd=ROOT,
    ).returncode == 0


def issue_codes(payload, kind):
    return {
        item.get("code")
        for item in payload["compatibility"].get(kind, [])
        if isinstance(item, dict)
    }


comparison_source = read("Server/webapp/services/comparison_service.py")
candidate_source = read(
    "Server/webapp/services/comparison_candidates_service.py"
)
repro_source = read("Server/webapp/services/reproducibility_service.py")
repro_panel = read("Client/my-app/src/components/ReproducibilityPanel.js")
source_viewer = read("Client/my-app/src/components/SourceViewerModal.js")
overview_source = read(
    "Client/my-app/src/screens/SubmissionOverviewPage.js"
)
history_source = read("Client/my-app/src/screens/HistoryPage.js")
history_backend = read(
    "Server/webapp/services/submission_history_service.py"
)
routes_source = read("Server/webapp/routes/submissions_routes.py")
model_source = read("Client/my-app/src/screens/comparisonModel.js")
locale_es = read("Client/my-app/src/i18n/locales/es.js")
locale_en = read("Client/my-app/src/i18n/locales/en.js")
readme = read("README.md")


baseline_8c_paths = (
    "Server/source_contract.py",
    "Server/hardware_snapshot.py",
    "Server/webapp/services/results_service.py",
)
check(
    "1. Baseline contractual 8C permanece intacto",
    all(unchanged_from_head(path) for path in baseline_8c_paths),
)
check(
    "2. Comparison resuelve metadata mediante source_contract central",
    "resolve_source_metadata" in comparison_source
    and "from ...source_contract import" in comparison_source,
)
check(
    "3. Comparison incorpora la dimensión pública sourceToolchain",
    '"sourceToolchain": 5' in comparison_source
    and 'dimensions["sourceToolchain"]' in comparison_source,
)

contexts, results = build_fixture()
set_v2_source(contexts[0], "impl1.c", "C", "gcc")
mixed = build_comparison(copy.deepcopy(contexts), copy.deepcopy(results))
check(
    "4. C versus C++ produce LIMITED",
    mixed["compatibility"]["status"] == "LIMITED"
    and "SOURCE_TOOLCHAIN_DIFFERS" in issue_codes(mixed, "warnings")
    and "SOURCE_TOOLCHAIN_DIFFERS" not in issue_codes(mixed, "blockers"),
)
check(
    "5. C versus C++ conservan las métricas científicas visibles",
    bool(mixed["metrics"])
    and "DurationTime" in mixed["metrics"],
)

invalid_contexts, invalid_results = build_fixture()
set_v2_source(invalid_contexts[0], "impl1.c", "C", "gcc")
invalid_contexts[0]["execution_config"]["compiler"] = "g++"
invalid = build_comparison(invalid_contexts, invalid_results)
check(
    "6. Metadata fuente inválida bloquea la comparación",
    invalid["compatibility"]["status"] == "INCOMPATIBLE"
    and "SOURCE_TOOLCHAIN_UNVERIFIED" in issue_codes(invalid, "blockers"),
)

legacy_contexts, legacy_results = build_fixture()
set_v2_source(legacy_contexts[1], "impl2.cpp", "C++", "g++")
legacy = build_comparison(legacy_contexts, legacy_results)
check(
    "7. C++ legacy y C++ v2 siguen siendo compatibles",
    legacy["compatibility"]["status"] == "COMPATIBLE"
    and [item["metadataProvenance"] for item in legacy["executions"]]
    == ["inferred_legacy_cpp", "explicit"],
)

version_contexts, version_results = build_fixture()
version_contexts[1]["hardware_snapshot"]["toolchain"]["compiler"][
    "version"
] = "GNU 10.2.0"
version_differs = build_comparison(version_contexts, version_results)
check(
    "8. Diferencia de versión observada es warning",
    version_differs["compatibility"]["status"] == "LIMITED"
    and "COMPILER_VERSION_DIFFERS"
    in issue_codes(version_differs, "warnings"),
)

missing_contexts, missing_results = build_fixture()
del missing_contexts[1]["hardware_snapshot"]["toolchain"]
missing_version = build_comparison(missing_contexts, missing_results)
check(
    "9. Versión observada ausente es warning",
    missing_version["compatibility"]["status"] == "LIMITED"
    and "COMPILER_VERSION_UNVERIFIED"
    in issue_codes(missing_version, "warnings"),
)

candidate_contexts, candidate_results = build_fixture(count=3)
for index in (0, 1):
    set_v2_source(
        candidate_contexts[index],
        "impl{}.c".format(index + 1),
        "C",
        "gcc",
    )
candidate = build_historical_candidate(
    candidate_contexts[:2],
    candidate_results[:2],
    candidate_contexts[2],
    candidate_results[2],
)
check(
    "10. Candidate C++ frente a selección C es LIMITED y seleccionable",
    candidate["status"] == "LIMITED" and candidate["selectable"] is True,
)
check(
    "11. Candidate público expone lenguaje y compilador sanitizados",
    candidate["sourceLanguage"] == "C++"
    and candidate["compiler"] == "g++"
    and "execution_config" not in json.dumps(candidate),
)

serialized_mixed = json.dumps(mixed)
check(
    "12. Comparison público añade identidad sin exponer config/snapshot raw",
    all(
        all(key in execution for key in (
            "sourceLanguage",
            "compiler",
            "compilerFlags",
            "metadataProvenance",
        ))
        for execution in mixed["executions"]
    )
    and "execution_config" not in serialized_mixed
    and "hardware_snapshot" not in serialized_mixed,
)
check(
    "13. UI Comparison presenta sourceToolchain y DIFFERS como limitación",
    '["sourceToolchain", "Lenguaje y compilador"]' in model_source
    and '"DIFFERS"' in model_source
    and "sourceLanguage" in model_source
    and "compiler" in model_source,
)

issue_codes_8d = (
    "SOURCE_TOOLCHAIN_DIFFERS",
    "SOURCE_TOOLCHAIN_UNVERIFIED",
    "COMPILER_VERSION_DIFFERS",
    "COMPILER_VERSION_UNVERIFIED",
)
check(
    "14. Nuevos issue codes están localizados en español",
    all(code in locale_es for code in issue_codes_8d),
)
check(
    "15. Nuevos issue codes están localizados en inglés",
    all(code in locale_en for code in issue_codes_8d),
)
check(
    "16. Reproducibilidad conserva manifest schema 1.0",
    'MANIFEST_SCHEMA_VERSION = "1.0"' in repro_source,
)
check(
    "17. Manifest v2 conserva language/compiler/metadataProvenance",
    all(
        token in repro_source
        for token in (
            '"language": source_metadata.source_language',
            'configuration_manifest["compiler"]',
            '"metadataProvenance"',
        )
    ),
)
check(
    "18. Toolchain observado se agrega condicional y sanitizado",
    'environment["toolchain"] = toolchain' in repro_source
    and "if toolchain is not None" in repro_source
    and 'name not in (COMPILER_C, COMPILER_CPP)' in repro_source,
)
repro_tests = read("Server/tests/test_reproducibility_service.py")
check(
    "19. Legacy no recibe toolchain artificial y mantiene bytes deterministas",
    'self.assertNotIn("toolchain"' in repro_tests
    and "test_manifest_bytes_are_stable" in repro_tests
    and "5c4abdd5514002a225f9c069c2be20ece75efbfafdffabe579adc5dac584e49b"
    in repro_tests,
)
check(
    "20. Panel reproducible separa metadata configurada y toolchain observado",
    all(
        token in repro_panel
        for token in (
            "sourceLanguage",
            "metadataProvenance",
            "configuredCompiler",
            "observedCompiler",
            "observedCompilerVersion",
        )
    ),
)
check(
    "21. Descarga de fuente usa fallback C/C++/neutral, nunca fuerza .cpp",
    'if (language === "C") return "source.c"' in repro_panel
    and 'if (language === "C++") return "source.cpp"' in repro_panel
    and 'return "source.txt"' in repro_panel
    and "fuente.cpp" not in repro_panel
    and 'fallback = "source.txt"' in source_viewer
    and "fuente.cpp" not in source_viewer,
)
check(
    "22. API Submission expone language y metadata pública por Execution",
    "s.language" in routes_source
    and "e.execution_config" in routes_source
    and "sourceLanguage" in read(
        "Server/webapp/services/execution_history_service.py"
    ),
)
check(
    "23. Submission Overview muestra lenguaje agregado e identidad C/C++",
    "submission.language" in overview_source
    and "execution?.sourceLanguage" in overview_source
    and "execution?.compiler" in overview_source,
)
check(
    "24. History muestra Submission.language sin filtro nuevo",
    '"language": _submission_language' in history_backend
    and "item?.language" in history_source
    and "language=" not in history_source,
)
history_tests = read("Client/my-app/src/screens/HistoryPage.test.js")
check(
    "25. Tests conservan filenames .c/.cpp en History",
    all(token in history_tests for token in ("main.c", "main.cpp", "left.c")),
)
check(
    "26. README declara soporte C/C++ con .c y .cpp",
    "C (`.c`) y C++ (`.cpp`)" in readme
    and "programas en C++ (`.cpp`)" not in readme,
)
check(
    "27. README documenta gcc y g++",
    "`gcc`" in readme and "`g++`" in readme,
)
check(
    "28. README declara una Execution independiente por fuente",
    "origina una `Execution` separada" in readme,
)
check(
    "29. README no promete linking ni proyectos multiarchivo",
    "no se enlazan" in readme
    and "no se interpretan proyectos multiarchivo" in readme,
)

locale_diff = subprocess.run(
    [
        "git",
        "diff",
        "-U0",
        "HEAD",
        "--",
        "Client/my-app/src/i18n/locales/es.js",
        "Client/my-app/src/i18n/locales/en.js",
    ],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout
check(
    "30. Tutorial permanece sin cambios",
    unchanged_from_head("Client/my-app/src/screens/TutorialPage.js")
    and unchanged_from_head("Client/my-app/src/screens/TutorialPage.css")
    and "tutorial" not in locale_diff.casefold(),
)

runtime_paths = (
    "Server/slave.py",
    "Server/execution_dispatcher.py",
    "Server/webapp/socketUtils.py",
    "Server/webapp/services/execution_runner_service.py",
)
schema_paths = ["Server/db/schema.sql"] + [
    str(path.relative_to(ROOT))
    for path in (ROOT / "Server/db/migrations").glob("*.sql")
]
check(
    "31. Runtime 8C, schema y migrations no tienen cambios funcionales",
    all(
        (ROOT / path).is_file() and unchanged_from_head(path)
        for path in runtime_paths + tuple(schema_paths)
    ),
)

pipeline_paths = (
    "Server/measurescript3.sh",
    "Server/measurescript4.sh",
    "Server/measurescript5.sh",
    "Server/webapp/dataProcessing.py",
)
required_locale_tokens = (
    "sourceToolchain",
    "configuredCompiler",
    "observedCompiler",
    "metadataProvenance",
)
check(
    "32. Pipeline científico byte-identical y contratos ES/EN completos",
    all(unchanged_from_head(path) for path in pipeline_paths)
    and all(token in locale_es and token in locale_en for token in required_locale_tokens),
)


passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 8D — E-C01 PRODUCT INTEGRATION")
print("=========================================")
print("{}/{} checks passed".format(passed, total))
if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)
print("RESULT: PASS")
