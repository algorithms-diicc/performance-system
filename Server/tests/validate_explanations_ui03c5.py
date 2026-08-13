#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Server.webapp.services.ai_explanation_service import (
    AIOutputRejectedError,
    build_ai_context,
    validate_ai_output,
)


FORBIDDEN_NORMATIVE_WORDS = [
    "bueno",
    "malo",
    "eficiente",
    "ineficiente",
]


def get_json(url):
    try:
        with urlopen(url, timeout=10) as response:
            return (
                response.getcode(),
                json.loads(
                    response.read().decode("utf-8")
                ),
            )
    except HTTPError as exc:
        return (
            exc.code,
            json.loads(
                exc.read().decode("utf-8")
            ),
        )
    except (URLError, ValueError) as exc:
        raise RuntimeError(str(exc))


def run_check(results, name, condition, detail=""):
    passed = bool(condition)

    print(
        "{:<64} {}".format(
            name,
            "PASS" if passed else "FAIL",
        )
    )

    if detail and not passed:
        print("  {}".format(detail))

    results.append(
        {
            "name": name,
            "passed": passed,
            "detail": detail if not passed else "",
        }
    )

    return passed


def all_pedagogy_messages(payload):
    messages = []

    for metric_name, metric in (
        payload.get("pedagogy", {})
        .get("metrics", {})
        .items()
    ):
        for message in metric.get("messages") or []:
            item = dict(message)
            item["_metric_name"] = metric_name
            messages.append(item)

    return messages


def valid_fixture():
    return {
        "summary": (
            "La ejecución presenta mediciones puntuales para el "
            "tamaño de entrada 500."
        ),
        "observations": [
            {
                "metric": "DurationTime",
                "evidence_kind": "snapshot",
                "text": (
                    "El tiempo observado corresponde al tamaño "
                    "de entrada 500."
                ),
            }
        ],
        "limitations": [
            (
                "Sólo existe 1 tamaño de entrada, por lo que "
                "no puede inferirse una tendencia."
            )
        ],
        "student_takeaway": (
            "Se requieren más tamaños de entrada para estudiar "
            "cómo cambia el rendimiento."
        ),
    }


def write_report(path, codename, api_url, checks):
    directory = os.path.dirname(path)

    if directory:
        os.makedirs(directory, exist_ok=True)

    report = {
        "validation": "UI-03C-5",
        "codename": codename,
        "api": api_url,
        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "passed": sum(
            1 for check in checks if check["passed"]
        ),
        "total": len(checks),
        "result": (
            "PASS"
            if all(check["passed"] for check in checks)
            else "FAIL"
        ),
        "checks": checks,
    }

    with open(path, "w", encoding="utf-8") as handle:
        json.dump(
            report,
            handle,
            ensure_ascii=False,
            indent=2,
        )


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
    parser.add_argument(
        "--report",
        default="",
        help=(
            "Ruta opcional para guardar evidencia JSON de la "
            "validación."
        ),
    )
    args = parser.parse_args()

    url = "{}/api/executions/{}/results".format(
        args.api.rstrip("/"),
        args.codename,
    )

    status, payload = get_json(url)

    print("PERFORMANCE SYSTEM — UI-03C-5 VALIDATION")
    print("Execution:", args.codename)
    print("API:", url)
    print("")

    checks = []

    run_check(
        checks,
        "Results endpoint HTTP 200",
        status == 200,
        "HTTP recibido: {}".format(status),
    )

    run_check(
        checks,
        "Results contract schema_version = 1.3",
        payload.get("schema_version") == "1.3",
        "Recibido: {!r}".format(
            payload.get("schema_version")
        ),
    )

    analysis = payload.get("analysis") or {}
    pedagogy = payload.get("pedagogy") or {}

    run_check(
        checks,
        "Analysis is deterministic_descriptive",
        (
            analysis.get("methodology", {})
            .get("nature")
            == "deterministic_descriptive"
        ),
    )

    run_check(
        checks,
        "Pedagogy generation uses deterministic rules",
        (
            pedagogy.get("generation", {})
            .get("type")
            == "deterministic_rules"
            and pedagogy.get(
                "generation", {}
            ).get("uses_ai") is False
        ),
    )

    duration = (
        pedagogy.get("metrics", {})
        .get("DurationTime", {})
    )
    duration_messages = duration.get("messages") or []

    snapshot = next(
        (
            message
            for message in duration_messages
            if message.get("kind") == "snapshot"
        ),
        None,
    )

    run_check(
        checks,
        "DurationTime has traceable snapshot evidence",
        (
            isinstance(snapshot, dict)
            and isinstance(
                snapshot.get("evidence"),
                dict,
            )
            and snapshot["evidence"].get("mean")
            is not None
            and snapshot["evidence"].get(
                "input_size"
            )
            is not None
        ),
    )

    limitation = next(
        (
            message
            for message in duration_messages
            if message.get("kind") == "limitation"
        ),
        None,
    )

    run_check(
        checks,
        "Single-InputSize limitation is explicit",
        (
            isinstance(limitation, dict)
            and "no es posible describir una tendencia"
            in limitation.get("text", "").lower()
        ),
    )

    highlights = (
        pedagogy.get("summary", {})
        .get("highlights")
        or []
    )

    metric_messages = (
        pedagogy.get("metrics", {})
    )

    highlights_traceable = True

    for highlight in highlights:
        metric_name = highlight.get("metric")
        candidates = (
            metric_messages.get(metric_name, {})
            .get("messages")
            or []
        )

        if not any(
            candidate.get("kind")
            == highlight.get("kind")
            and candidate.get("evidence")
            == highlight.get("evidence")
            for candidate in candidates
        ):
            highlights_traceable = False
            break

    run_check(
        checks,
        "Summary highlights are traceable to metric messages",
        bool(highlights)
        and highlights_traceable,
    )

    run_check(
        checks,
        "Every highlight preserves structured evidence",
        bool(highlights)
        and all(
            isinstance(
                highlight.get("evidence"),
                dict,
            )
            for highlight in highlights
        ),
    )

    energy = (
        pedagogy.get("metrics", {})
        .get("EnergyPkg", {})
    )
    energy_text = " ".join(
        message.get("text", "")
        for message in (
            energy.get("messages")
            or []
        )
    ).lower()

    run_check(
        checks,
        "Unavailable EnergyPkg is not interpreted as zero",
        (
            energy.get("status") == "unavailable"
            and "no se interpreta como un valor cero"
            in energy_text
        ),
    )

    all_text = " ".join(
        message.get("text", "")
        for message in all_pedagogy_messages(
            payload
        )
    ).lower()

    has_normative_word = any(
        re.search(
            r"\b{}\b".format(
                re.escape(word)
            ),
            all_text,
        )
        for word in FORBIDDEN_NORMATIVE_WORDS
    )

    run_check(
        checks,
        "No unsupported normative good/bad classification",
        not has_normative_word,
    )

    ai_context = build_ai_context(payload)
    serialized_context = json.dumps(
        ai_context,
        ensure_ascii=False,
    )

    top_level_forbidden_fields_absent = (
        "student_code" not in ai_context
        and "raw_csv" not in ai_context
    )

    run_check(
        checks,
        "AI context explicitly excludes source code and raw CSV",
        (
            ai_context.get("constraints", {})
            .get("no_student_code")
            is True
            and ai_context.get(
                "constraints", {}
            ).get("no_raw_csv")
            is True
            and top_level_forbidden_fields_absent
        ),
    )

    run_check(
        checks,
        "AI context preserves deterministic evidence messages",
        bool(
            ai_context.get("metrics", {})
            .get("DurationTime", {})
            .get("messages")
        ),
    )

    fixture = valid_fixture()

    fixture_passed = True
    try:
        validate_ai_output(
            fixture,
            ai_context,
        )
    except Exception:
        fixture_passed = False

    run_check(
        checks,
        "Known-good AI fixture passes local guardrails",
        fixture_passed,
    )

    invalid_number = valid_fixture()
    invalid_number["summary"] = (
        "La ejecución tardó 999999 ms."
    )

    rejected_number = False

    try:
        validate_ai_output(
            invalid_number,
            ai_context,
        )
    except AIOutputRejectedError:
        rejected_number = True

    run_check(
        checks,
        "Invented numeric claim is rejected",
        rejected_number,
    )

    invalid_complexity = valid_fixture()
    invalid_complexity["student_takeaway"] = (
        "El algoritmo es O(n²)."
    )

    rejected_complexity = False

    try:
        validate_ai_output(
            invalid_complexity,
            ai_context,
        )
    except AIOutputRejectedError:
        rejected_complexity = True

    run_check(
        checks,
        "Unsupported asymptotic claim is rejected",
        rejected_complexity,
    )

    print("")
    passed = sum(
        1 for check in checks if check["passed"]
    )
    total = len(checks)

    print("RESULTADO")
    print("=========")
    print("{}/{} checks passed".format(passed, total))

    result_pass = passed == total

    print(
        "RESULT: {}".format(
            "PASS" if result_pass else "FAIL"
        )
    )

    if args.report:
        write_report(
            path=args.report,
            codename=args.codename,
            api_url=url,
            checks=checks,
        )
        print("Report:", args.report)

    return 0 if result_pass else 1


if __name__ == "__main__":
    sys.exit(main())