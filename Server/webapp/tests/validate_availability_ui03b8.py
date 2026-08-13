#!/usr/bin/env python3
from pathlib import Path
import argparse
import csv
import math
import sys


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CODENAME = "4642247bcec74b1c957e7988b2837151CAMMR"


def check(name, condition, detail=""):
    label = "PASS" if condition else "FAIL"
    print("{:<52} {}".format(name, label))
    if detail and not condition:
        print("  {}".format(detail))
    return bool(condition)


def is_numeric(value):
    try:
        return math.isfinite(float(str(value).strip()))
    except Exception:
        return False


def all_marker(rows, column, accepted):
    values = {
        str(row.get(column, "")).strip().lower()
        for row in rows
    }
    return bool(values) and values <= accepted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--codename",
        default=DEFAULT_CODENAME,
        help=(
            "Ejecución real usada como fixture de disponibilidad. "
            "Por defecto: CORE-06H CAMMR #98."
        ),
    )
    parser.add_argument(
        "--expected-samples",
        type=int,
        default=30,
    )
    args = parser.parse_args()

    csv_path = (
        ROOT
        / "Server/webapp/static"
        / args.codename
        / "CombinedResults.csv"
    )

    print("PERFORMANCE SYSTEM — AVAILABILITY REGRESSION")
    print("Execution:", args.codename)
    print("CSV:", csv_path)
    print("")

    checks = []
    checks.append(
        check(
            "CombinedResults.csv existe",
            csv_path.is_file(),
        )
    )

    if not csv_path.is_file():
        print("")
        print("RESULT: FAIL")
        return 1

    with csv_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        rows = list(csv.DictReader(handle))

    fieldnames = set(rows[0].keys()) if rows else set()

    required = {
        "InputSize",
        "DurationTime",
        "EnergyPkg",
        "LLCLoads",
        "L1DcacheStores",
    }
    checks.append(
        check(
            "Columnas de disponibilidad presentes",
            required <= fieldnames,
            "Ausentes: {!r}".format(
                sorted(required - fieldnames)
            ),
        )
    )

    input_sizes = {
        row.get("InputSize")
        for row in rows
    }

    checks.append(
        check(
            "10 puntos de entrada",
            len(input_sizes) == 10,
            "Recibidos: {}".format(len(input_sizes)),
        )
    )

    expected_rows = 10 * args.expected_samples
    checks.append(
        check(
            "{} filas".format(expected_rows),
            len(rows) == expected_rows,
            "Recibidas: {}".format(len(rows)),
        )
    )

    checks.append(
        check(
            "DurationTime completamente numérico",
            bool(rows)
            and all(
                is_numeric(row.get("DurationTime"))
                for row in rows
            ),
        )
    )

    unsupported = {
        "<not-supported>",
        "<not supported>",
    }

    checks.append(
        check(
            "LLCLoads no soportado en fixture AMD",
            all_marker(rows, "LLCLoads", unsupported),
        )
    )
    checks.append(
        check(
            "EnergyPkg no soportado en fixture AMD",
            all_marker(rows, "EnergyPkg", unsupported),
        )
    )
    checks.append(
        check(
            "L1DcacheStores no soportado en fixture AMD",
            all_marker(rows, "L1DcacheStores", unsupported),
        )
    )

    print("")
    passed = sum(1 for value in checks if value)
    total = len(checks)
    print("RESULTADO")
    print("=========")
    print("{}/{} checks passed".format(passed, total))
    print("RESULT:", "PASS" if passed == total else "FAIL")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
