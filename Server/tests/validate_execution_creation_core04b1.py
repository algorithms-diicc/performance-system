


#!/usr/bin/env python3
"""
CORE-04B-1 integration validator.

Crea una submission y dos executions reales dentro de una transacción y luego
hace ROLLBACK. No deja filas permanentes.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from psycopg2.extras import RealDictCursor

from Server.db_connection import get_connection
from Server.webapp.services.execution_creation_service import (
    create_submission_bundle,
)


def report(label, ok, detail=""):
    print("{:<72} {}".format(label, "PASS" if ok else "FAIL"))
    if detail and not ok:
        print("  {}".format(detail))
    return bool(ok)


def count(cur, table):
    cur.execute("SELECT COUNT(*) AS c FROM {};".format(table))
    return cur.fetchone()["c"]


def main():
    print("Iniciando validador CORE-04B-1...")
    checks = []

    conn = get_connection()
    conn.autocommit = False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            before_submissions = count(cur, "submissions")
            before_executions = count(cur, "executions")

            cur.execute("SELECT id FROM users ORDER BY id LIMIT 1;")
            user = cur.fetchone()

        if user is None:
            print("No existe ningún usuario para construir el fixture.")
            return 2

        bundle = create_submission_bundle(
            user_id=user["id"],
            title="__CORE04B1_TEMP__",
            archive_path="Server/uploads/__CORE04B1_TEMP__.zip",
            archive_sha256="b" * 64,
            benchmark="LCS",
            input_size=500,
            samples=30,
            source_specs=[
                {"original_filename": "solution_a.cpp"},
                {"original_filename": "nested/solution_b.cpp"},
            ],
            conn=conn,
        )

        submission = bundle["submission"]
        executions = bundle["executions"]

        checks.append(report(
            "Exactly one persistent submission is created",
            submission["id"] is not None,
        ))
        checks.append(report(
            "Submission starts in legacy-compatible QUEUED state",
            submission["status"] == "QUEUED",
            "status={}".format(submission["status"]),
        ))
        checks.append(report(
            "One execution is created per .cpp source",
            len(executions) == 2,
            "executions={}".format(len(executions)),
        ))
        checks.append(report(
            "Every execution has a public_id",
            all(row.get("public_id") for row in executions),
        ))
        checks.append(report(
            "public_id values are unique",
            len({row["public_id"] for row in executions}) == 2,
        ))
        checks.append(report(
            "codenames are unique",
            len({row["codename"] for row in executions}) == 2,
        ))
        checks.append(report(
            "Executions start in canonical QUEUED",
            all(row["execution_state"] == "QUEUED" for row in executions),
        ))
        checks.append(report(
            "Legacy execution status remains pending",
            all(row["status"] == "pending" for row in executions),
        ))
        checks.append(report(
            "queued_at is persisted",
            all(row["queued_at"] is not None for row in executions),
        ))
        checks.append(report(
            "state_version starts at zero",
            all(row["state_version"] == 0 for row in executions),
        ))
        checks.append(report(
            "BALANCED profile is inferred for 30 samples",
            all(row["execution_profile"] == "BALANCED" for row in executions),
        ))
        checks.append(report(
            "Benchmark/input/samples are persisted",
            all(
                row["benchmark"] == "LCS"
                and row["input_size"] == 500
                and row["samples"] == 30
                for row in executions
            ),
        ))
        checks.append(report(
            "Per-source execution_config is persisted",
            {
                row["execution_config"]["original_filename"]
                for row in executions
            } == {
                "solution_a.cpp",
                "nested/solution_b.cpp",
            },
        ))

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            during_submissions = count(cur, "submissions")
            during_executions = count(cur, "executions")

        checks.append(report(
            "Transaction contains +1 submission before rollback",
            during_submissions == before_submissions + 1,
            "before={}, during={}".format(
                before_submissions, during_submissions
            ),
        ))
        checks.append(report(
            "Transaction contains +2 executions before rollback",
            during_executions == before_executions + 2,
            "before={}, during={}".format(
                before_executions, during_executions
            ),
        ))

    finally:
        conn.rollback()

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            after_submissions = count(cur, "submissions")
            after_executions = count(cur, "executions")

        checks.append(report(
            "Rollback leaves no persistent submission fixture",
            after_submissions == before_submissions,
            "before={}, after={}".format(
                before_submissions, after_submissions
            ),
        ))
        checks.append(report(
            "Rollback leaves no persistent execution fixtures",
            after_executions == before_executions,
            "before={}, after={}".format(
                before_executions, after_executions
            ),
        ))

        conn.close()

    passed = sum(1 for value in checks if value)
    total = len(checks)

    print("")
    print("RESULTADO CORE-04B-1")
    print("=====================")
    print("{}/{} checks passed".format(passed, total))
    print("RESULT: {}".format("PASS" if passed == total else "FAIL"))

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())