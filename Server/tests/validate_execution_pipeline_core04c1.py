#!/usr/bin/env python3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Server.webapp.services.execution_pipeline_service import (
    read_legacy_outcome,
    result_bundle_exists,
)

BASE_DIR = PROJECT_ROOT / "Server"
STATUS_DIR = BASE_DIR / "status"
STATIC_DIR = BASE_DIR / "webapp" / "static"


def report(label, ok, detail=""):
    print("{:<72} {}".format(label, "PASS" if ok else "FAIL"))
    if detail and not ok:
        print("  {}".format(detail))
    return bool(ok)


def main():
    print("Iniciando validador CORE-04C-1...")

    if len(sys.argv) != 2:
        print(
            "Uso: python3 Server/tests/"
            "validate_execution_pipeline_core04c1.py <codename>"
        )
        return 2

    codename = sys.argv[1].strip()
    checks = []

    outcome = read_legacy_outcome(
        codename,
        STATUS_DIR,
        STATIC_DIR,
    )

    checks.append(
        report(
            "Legacy status is read as SUCCESS",
            outcome.kind == "SUCCESS",
            "kind={}, status={!r}".format(
                outcome.kind,
                outcome.status_text,
            ),
        )
    )

    checks.append(
        report(
            "CombinedResults.csv exists for the execution bundle",
            result_bundle_exists([codename], STATIC_DIR),
        )
    )

    result_path = (
        STATIC_DIR
        / codename
        / "CombinedResults.csv"
    )

    checks.append(
        report(
            "CombinedResults.csv is non-empty",
            result_path.is_file()
            and result_path.stat().st_size > 0,
        )
    )

    sidecar = STATIC_DIR / (codename + "_status.json")
    checks.append(
        report(
            "Execution status sidecar exists",
            sidecar.is_file(),
        )
    )

    passed = sum(1 for value in checks if value)
    total = len(checks)

    print("")
    print("RESULTADO CORE-04C-1")
    print("=====================")
    print("{}/{} checks passed".format(passed, total))
    print(
        "RESULT: {}".format(
            "PASS" if passed == total else "FAIL"
        )
    )

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())