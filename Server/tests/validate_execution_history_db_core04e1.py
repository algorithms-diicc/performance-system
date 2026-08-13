#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from psycopg2.extras import RealDictCursor

from Server.db_connection import get_connection
from Server.webapp.services.execution_history_service import (
    serialize_execution_history_row,
)


def fetch_execution(execution_id):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                  e.id AS execution_id,
                  e.public_id::text AS public_id,
                  e.codename,
                  e.submission_id,
                  e.execution_state,
                  e.failure_stage,
                  e.error_code,
                  e.error_message,
                  e.started_at,
                  e.processing_at,
                  e.finished_at,
                  e.duration_ms,
                  e.result_available,
                  s.title AS submission_title,
                  NULL::text AS hardware_name
                FROM executions e
                JOIN submissions s
                  ON s.id = e.submission_id
                WHERE e.id = %s;
                """,
                (execution_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def ck(label, ok):
    print(
        "{:<80} {}".format(
            label,
            "PASS" if ok else "FAIL",
        )
    )
    return bool(ok)


expected = {
    58: ("COMPLETED", None),
    60: ("FAILED", "COMPILE_ERROR"),
    61: ("FAILED", "GRAPH_PROCESSING_ERROR"),
}

checks = []

for execution_id, (expected_state, expected_code) in expected.items():
    row = fetch_execution(execution_id)
    checks.append(
        ck(
            f"Execution {execution_id} exists",
            row is not None,
        )
    )
    if row is None:
        continue

    payload = serialize_execution_history_row(row)

    checks.append(
        ck(
            f"Execution {execution_id} canonical state",
            payload["state"] == expected_state,
        )
    )

    if expected_code is None:
        checks.append(
            ck(
                f"Execution {execution_id} has no failure",
                payload["failure"] is None,
            )
        )
    else:
        checks.append(
            ck(
                f"Execution {execution_id} failure code",
                payload["failure"]
                and payload["failure"]["code"]
                == expected_code,
            )
        )

    checks.append(
        ck(
            f"Execution {execution_id} exposes publicId/codename",
            bool(payload["publicId"])
            and bool(payload["codename"]),
        )
    )

passed = sum(checks)
total = len(checks)

print("")
print("RESULTADO DB CORE-04E-1")
print("=======================")
print(f"{passed}/{total} checks passed")
print(
    "RESULT: {}".format(
        "PASS" if passed == total else "FAIL"
    )
)
sys.exit(0 if passed == total else 1)
