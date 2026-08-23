#!/usr/bin/env python3
"""Deterministic, DB-free validator for Iteration 9 tutorial integration."""

from __future__ import annotations

import hashlib
import subprocess
import sys
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
BASELINE = "9705f3f04b4ed5c6ae79bfe56ca9ccf8edf40e49"

APP = REPO_ROOT / "Client/my-app/src/App.js"
TUTORIAL = REPO_ROOT / "Client/my-app/src/screens/TutorialPage.js"
TUTORIAL_CSS = REPO_ROOT / "Client/my-app/src/screens/TutorialPage.css"
ES_LOCALE = REPO_ROOT / "Client/my-app/src/i18n/locales/es.js"
EN_LOCALE = REPO_ROOT / "Client/my-app/src/i18n/locales/en.js"
ASSET_DIR = REPO_ROOT / "Client/my-app/src/assets/tutorial"
EXAMPLE_DIR = REPO_ROOT / "Client/my-app/public/tutorial-codigos"

ASSET_HASHES = {
    "tutorial-01-new-analysis-es.png": "90ac68604ac507f75c1d4bc0db994c72f96f6f875f4fa768a0cba00df208468c",
    "tutorial-01-new-analysis-en.png": "39b6bb74c9d8329dc034103670611caabf13d4cd662f4daff20e0264b70fb81c",
    "tutorial-02-mixed-executions-es.png": "37c54a4c0ce409b9a8947f2ff9d8a53c36678aa2f5095f3a50f8022474e4bf5d",
    "tutorial-02-mixed-executions-en.png": "4dd48f68155107f795fb08a8afe068550b4829bd025ef91cd4fc37118c6793c8",
    "tutorial-03-results-overview-es.png": "ce25c29ff3910e9c3fe2a848a8ca58a8cfdef22a43d6e9f702828d1841bc11f4",
    "tutorial-03-results-overview-en.png": "4482769f833ce1209552785ab9f124c0f777a910ab769c47395a3ae4611c559b",
    "tutorial-04-reproducibility-es.png": "55f3f58861ec408ee32f07a4b8d1e6544982efc1dfc5e9157311404d87d32140",
    "tutorial-04-reproducibility-en.png": "2afc28152b6d968d028522b8dda8f50415934feb3ab3a93ba5f9a800d0af18b7",
    "tutorial-05-history-es.png": "310078bd4c334362893acbc14663fd90e541cea62073791d654398fd49f64128",
    "tutorial-05-history-en.png": "1594e1a540917c1d21223ed7bd4b1d6df797fb92da368fedd6551648e438326a",
    "tutorial-06-comparison-es.png": "458e7336beefb85571e8d212b47177a6626bedb36c02447de82314513396e894",
    "tutorial-06-comparison-en.png": "bb01f7fe36e66d2b90ea508be9b7772529ec0ea66d794dfcf5e42283b11e6984",
    "tutorial-07-teacher-course-es.png": "53a489b8adffb8ed8781c8436d3d3f38432b9aa41e1418495973fcd906621969",
    "tutorial-07-teacher-course-en.png": "e6a4d619220c00d76566098c73f86f2641781e74164b03f6b02d2b92c8e8bedf",
}

LEGACY_ASSETS = {
    "tutorial-config-summary.png",
    "tutorial-profile-settings.png",
    "tutorial-progress-details.png",
    "tutorial-progress-overview.png",
    "tutorial-recent-result.png",
    "tutorial-results-overview.png",
    "tutorial-time-chart.png",
    "tutorial-upload.png",
}

EXPECTED_ARCHIVES = {
    "size_template.zip": ["insertion_sort.c", "merge_sort.cpp"],
    "lcs_template.zip": ["longest_common_subsequence.c"],
    "camm_template.zip": ["blocked_matrix_multiplication.cpp"],
}

PROTECTED_PATHS = [
    "Server/slave.py",
    "Server/execution_dispatcher.py",
    "Server/webapp/socketUtils.py",
    "Server/webapp/services/execution_runner_service.py",
    "Server/measurescript3.sh",
    "Server/measurescript4.sh",
    "Server/measurescript5.sh",
    "Server/webapp/dataProcessing.py",
    "Server/db/schema.sql",
    "Server/db/migrations",
    "Server/source_contract.py",
    "Server/webapp/services/comparison_service.py",
    "Server/webapp/services/reproducibility_service.py",
]

ALLOWED_EXACT = {
    "Client/my-app/src/App.js",
    "Client/my-app/src/App.test.js",
    "Client/my-app/src/screens/TutorialPage.js",
    "Client/my-app/src/screens/TutorialPage.css",
    "Client/my-app/src/screens/TutorialPage.test.js",
    "Client/my-app/src/screens/TutorialPageI18n.test.js",
    "Client/my-app/src/i18n/locales/es.js",
    "Client/my-app/src/i18n/locales/en.js",
    "Client/my-app/public/tutorial-codigos/size_template.zip",
    "Client/my-app/public/tutorial-codigos/lcs_template.zip",
    "Client/my-app/public/tutorial-codigos/camm_template.zip",
    "Server/webapp/tests/validate_iteration9_tutorial.py",
}


class Validator:
    def __init__(self) -> None:
        self.passed = 0
        self.failures: list[str] = []

    def check(self, condition: bool, label: str) -> None:
        if condition:
            self.passed += 1
            print(f"PASS  {label}")
            return
        self.failures.append(label)
        print(f"FAIL  {label}")

    def finish(self) -> int:
        if self.failures:
            print(
                f"\nITERATION 9 VALIDATOR: FAIL "
                f"({len(self.failures)} failed, {self.passed} passed)"
            )
            return 1
        print(f"\nITERATION 9 VALIDATOR: PASS ({self.passed} checks)")
        return 0


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        check=check,
        capture_output=True,
        text=True,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def changed_paths() -> set[str]:
    tracked = set(filter(None, git("diff", "--name-only", "HEAD").stdout.splitlines()))
    untracked = set(
        filter(
            None,
            git("ls-files", "--others", "--exclude-standard").stdout.splitlines(),
        )
    )
    return tracked | untracked


def main() -> int:
    validator = Validator()

    app_source = APP.read_text(encoding="utf-8")
    tutorial_source = TUTORIAL.read_text(encoding="utf-8")
    tutorial_css = TUTORIAL_CSS.read_text(encoding="utf-8")
    es_source = ES_LOCALE.read_text(encoding="utf-8")
    en_source = EN_LOCALE.read_text(encoding="utf-8")
    locale_source = es_source + "\n" + en_source

    validator.check(git("rev-parse", "HEAD").stdout.strip() == BASELINE, "authoritative baseline")
    validator.check(
        "<TutorialPage currentUser={currentUser} />" in app_source,
        "App passes currentUser to TutorialPage",
    )
    validator.check(
        'import { canAccessTeacherArea } from "../common/userAccessModel";' in tutorial_source
        and "canAccessTeacherArea(currentUser)" in tutorial_source,
        "Tutorial reuses canAccessTeacherArea",
    )
    validator.check(
        "showTeacherSection && (" in tutorial_source
        and 'id="supervisar"' in tutorial_source
        and "TEACHER_NAV_ITEM" in tutorial_source,
        "teacher navigation and section are conditional",
    )
    validator.check(
        'id="crear"' in tutorial_source
        and 'id="resultados"' in tutorial_source
        and 'id="comparar"' in tutorial_source
        and 'id="ejemplos"' in tutorial_source,
        "canonical anchors including #ejemplos are preserved",
    )
    validator.check(
        'language === "en" ? shot.en : shot.es' in tutorial_source,
        "screenshots switch explicitly with UI language",
    )
    validator.check(
        "perf · gcc 9.4.0" in tutorial_source
        and "13.3.0" not in tutorial_source,
        "observed compiler version matches the canonical screenshot",
    )

    existing_assets = {path.name for path in ASSET_DIR.glob("*.png")}
    validator.check(existing_assets == set(ASSET_HASHES), "exact set of 14 ES/EN assets")
    validator.check(
        all(
            (ASSET_DIR / name).is_file()
            and sha256(ASSET_DIR / name) == expected
            for name, expected in ASSET_HASHES.items()
        ),
        "all final assets match approved SHA-256 values",
    )
    validator.check(
        LEGACY_ASSETS.isdisjoint(existing_assets)
        and not any(name in tutorial_source for name in LEGACY_ASSETS),
        "legacy tutorial screenshots and imports are absent",
    )

    validator.check(
        "MemoryStick" not in tutorial_source
        and 'key: "memory"' not in tutorial_source,
        "unsupported memory metric is absent from Tutorial",
    )
    validator.check(
        all(token in tutorial_source + locale_source for token in (
            ".c",
            ".cpp",
            "C++",
            "gcc",
            "g++",
            "independent",
            "independiente",
        )),
        "C/C++ and independent-execution contract is documented",
    )
    validator.check(
        "LIMITED" in tutorial_source
        and "INCOMPATIBLE" in tutorial_source
        and "C/gcc frente a C++/g++" in es_source
        and "C/gcc versus C++/g++" in en_source,
        "LIMITED C/gcc versus C++/g++ contract is explicit",
    )
    validator.check(
        "Las mediciones son la fuente primaria" in es_source
        and "Measurements are the primary source" in en_source
        and "Asistencia IA complementaria" in es_source
        and "Complementary AI assistance" in en_source,
        "deterministic evidence precedes complementary AI",
    )
    validator.check(
        "sin calificar ni comparar estudiantes" in es_source
        and "without grading or comparing students" in en_source,
        "teacher supervision guardrail is localized",
    )
    validator.check(
        'id="administracion"' not in tutorial_source.lower()
        and "fifth" not in tutorial_source.lower(),
        "no administration tutorial section exists",
    )
    validator.check(
        'role="dialog"' in tutorial_source
        and 'aria-modal="true"' in tutorial_source
        and 'event.key === "Escape"' in tutorial_source,
        "accessible lightbox contract is preserved",
    )
    validator.check(
        "width: 100%;" in tutorial_css
        and "height: auto;" in tutorial_css
        and "@media (max-width: 680px)" in tutorial_css,
        "screenshots preserve natural ratio and layout is responsive",
    )

    archives_valid = True
    archive_members_valid = True
    unsupported_member_found = False
    for archive_name, expected_members in EXPECTED_ARCHIVES.items():
        archive_path = EXAMPLE_DIR / archive_name
        try:
            with zipfile.ZipFile(archive_path) as archive:
                members = archive.namelist()
                archive_members_valid &= members == expected_members
                archives_valid &= archive.testzip() is None
                unsupported_member_found |= any(
                    Path(member).suffix.lower() in {".cc", ".cxx", ".h", ".hpp"}
                    for member in members
                )
        except (FileNotFoundError, zipfile.BadZipFile):
            archives_valid = False
            archive_members_valid = False

    validator.check(archives_valid, "downloadable ZIP files pass CRC validation")
    validator.check(archive_members_valid, "ZIP files contain the exact C/C++ examples")
    validator.check(not unsupported_member_found, "ZIP files contain no unsupported source/header types")
    validator.check(
        all(
            f'/tutorial-codigos/{archive_name}' in tutorial_source
            for archive_name in EXPECTED_ARCHIVES
        ),
        "canonical public download URLs are unchanged",
    )

    protected_ok = True
    for relative_path in PROTECTED_PATHS:
        path = REPO_ROOT / relative_path
        protected_ok &= path.exists()
        protected_ok &= git(
            "diff",
            "--quiet",
            "HEAD",
            "--",
            relative_path,
            check=False,
        ).returncode == 0
    validator.check(protected_ok, "protected runtime/schema/pipeline paths are byte-identical to HEAD")

    paths = changed_paths()
    unexpected = {
        path
        for path in paths
        if path not in ALLOWED_EXACT
        and not path.startswith("Client/my-app/src/assets/tutorial/")
    }
    validator.check(not unexpected, f"changed-file scope is allowed: {sorted(unexpected)}")
    validator.check(
        not {
            path
            for path in paths
            if path.startswith("Server/")
            and path != "Server/webapp/tests/validate_iteration9_tutorial.py"
        },
        "no backend production file changed",
    )
    validator.check(
        git("diff", "--cached", "--quiet", check=False).returncode == 0,
        "no changes are staged",
    )

    return validator.finish()


if __name__ == "__main__":
    sys.exit(main())
