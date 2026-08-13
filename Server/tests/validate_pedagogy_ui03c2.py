#!/usr/bin/env python3
import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def get_json(url):
    try:
        with urlopen(url, timeout=10) as response:
            return response.getcode(), json.loads(
                response.read().decode("utf-8")
            )
    except HTTPError as exc:
        return exc.code, json.loads(
            exc.read().decode("utf-8")
        )
    except (URLError, ValueError) as exc:
        raise RuntimeError(str(exc))


def check(name, condition, detail=""):
    result = "PASS" if condition else "FAIL"
    print("{:<58} {}".format(name, result))
    if detail and not condition:
        print("  {}".format(detail))
    return bool(condition)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--codename",
        default="9868247794LCS",
    )
    parser.add_argument(
        "--api",
        default="http://localhost:5000",
    )
    args = parser.parse_args()

    url = "{}/api/executions/{}/results".format(
        args.api.rstrip("/"),
        args.codename,
    )

    status, payload = get_json(url)

    print("PERFORMANCE SYSTEM — UI-03C-2 VALIDATION")
    print("Execution:", args.codename)
    print("API:", url)
    print("")

    checks = []
    checks.append(check("HTTP 200", status == 200))
    checks.append(
        check(
            "schema_version = 1.3",
            payload.get("schema_version") == "1.3",
            "Recibido: {!r}".format(payload.get("schema_version")),
        )
    )

    pedagogy = payload.get("pedagogy", {})
    generation = pedagogy.get("generation", {})

    checks.append(
        check(
            "pedagogy.version = 1.0",
            pedagogy.get("version") == "1.0",
        )
    )
    checks.append(
        check(
            "Generation is deterministic",
            generation.get("type") == "deterministic_rules",
        )
    )
    checks.append(
        check(
            "Generation uses_ai = false",
            generation.get("uses_ai") is False,
        )
    )
    checks.append(
        check(
            "Statistics are not recomputed",
            generation.get("statistics_recomputed") is False,
        )
    )

    duration = (
        pedagogy.get("metrics", {})
        .get("DurationTime", {})
    )
    duration_messages = duration.get("messages") or []
    duration_kinds = {
        message.get("kind")
        for message in duration_messages
    }

    checks.append(
        check(
            "DurationTime snapshot explanation exists",
            "snapshot" in duration_kinds,
        )
    )
    checks.append(
        check(
            "Single InputSize limitation is explicit",
            "limitation" in duration_kinds,
        )
    )
    checks.append(
        check(
            "DurationTime outlier explanation exists",
            "outliers" in duration_kinds,
        )
    )

    duration_text = " ".join(
        message.get("text", "")
        for message in duration_messages
    ).lower()

    forbidden_judgments = [
        "bueno",
        "malo",
        "eficiente",
        "ineficiente",
    ]

    has_forbidden_judgment = any(
        re.search(
            r"\\b{}\\b".format(
                re.escape(word)
            ),
            duration_text,
        )
        for word in forbidden_judgments
    )

    checks.append(
        check(
            "No unsupported good/bad judgment",
            not has_forbidden_judgment,
        )
    )

    energy = (
        pedagogy.get("metrics", {})
        .get("EnergyPkg", {})
    )
    energy_text = " ".join(
        message.get("text", "")
        for message in (energy.get("messages") or [])
    ).lower()

    checks.append(
        check(
            "EnergyPkg remains unavailable",
            energy.get("status") == "unavailable",
        )
    )
    checks.append(
        check(
            "Unavailable metric is not interpreted as zero",
            "no se interpreta como un valor cero" in energy_text,
        )
    )

    highlights = (
        pedagogy.get("summary", {})
        .get("highlights") or []
    )
    checks.append(
        check(
            "Summary contains pedagogical highlights",
            len(highlights) > 0,
        )
    )
    checks.append(
        check(
            "Highlights preserve structured evidence",
            all(
                isinstance(item.get("evidence"), dict)
                for item in highlights
            ),
        )
    )

    print("")
    passed = sum(1 for item in checks if item)
    total = len(checks)

    print("RESULTADO")
    print("=========")
    print("{}/{} checks passed".format(passed, total))

    if passed == total:
        print("RESULT: PASS")
        return 0

    print("RESULT: FAIL")
    return 1

if __name__ == "__main__":
    sys.exit(main())