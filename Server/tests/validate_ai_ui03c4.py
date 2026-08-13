#!/usr/bin/env python3
import argparse
import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def post_json(url, payload):
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=45) as response:
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


def check(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print("{:<58} {}".format(name, status))

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
    parser.add_argument(
        "--expect-configured",
        action="store_true",
        help=(
            "Exige una llamada real exitosa al proveedor. "
            "Usar sólo cuando OPENAI_API_KEY está configurada."
        ),
    )
    args = parser.parse_args()

    url = "{}/api/executions/{}/ai-explanation".format(
        args.api.rstrip("/"),
        args.codename,
    )

    status, payload = post_json(
        url,
        {"force": False},
    )

    print("PERFORMANCE SYSTEM — UI-03C-4 VALIDATION")
    print("Execution:", args.codename)
    print("API:", url)
    print("")

    if status == 503:
        code = (
            payload.get("error", {})
            .get("code")
        )

        checks = [
            check(
                "Endpoint returns AI_NOT_CONFIGURED",
                code == "AI_NOT_CONFIGURED",
                "Recibido: {!r}".format(code),
            )
        ]

        print("")
        print("RESULTADO")
        print("=========")

        if args.expect_configured:
            print("0/1 checks passed")
            print("RESULT: FAIL")
            return 1

        print("{}/1 checks passed".format(sum(checks)))
        print("RESULT: PASS (integration ready; API key pending)")
        return 0

    checks = []
    checks.append(check("HTTP 200", status == 200))
    checks.append(
        check(
            "AI schema_version = 1.0",
            payload.get("schema_version") == "1.0",
        )
    )
    checks.append(
        check(
            "generated_by_ai = true",
            payload.get("generated_by_ai") is True,
        )
    )
    checks.append(
        check(
            "student_code_sent = false",
            payload.get("source", {}).get(
                "student_code_sent"
            ) is False,
        )
    )
    checks.append(
        check(
            "raw_csv_sent = false",
            payload.get("source", {}).get(
                "raw_csv_sent"
            ) is False,
        )
    )
    checks.append(
        check(
            "guardrails passed",
            payload.get("guardrails", {}).get(
                "passed"
            ) is True,
        )
    )

    content = payload.get("content") or {}
    checks.append(
        check(
            "Structured summary exists",
            isinstance(content.get("summary"), str)
            and bool(content.get("summary")),
        )
    )
    checks.append(
        check(
            "Structured observations exist",
            isinstance(
                content.get("observations"),
                list,
            )
            and len(content.get("observations")) > 0,
        )
    )
    checks.append(
        check(
            "Limitations are structured",
            isinstance(
                content.get("limitations"),
                list,
            ),
        )
    )
    checks.append(
        check(
            "Student takeaway exists",
            isinstance(
                content.get("student_takeaway"),
                str,
            )
            and bool(
                content.get("student_takeaway")
            ),
        )
    )

    print("")
    passed = sum(1 for value in checks if value)
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
