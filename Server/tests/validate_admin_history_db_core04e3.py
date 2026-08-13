#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from psycopg2.extras import RealDictCursor
from Server.db_connection import get_connection

USER_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 1


def ck(label, ok):
    print(
        "{:<86} {}".format(
            label,
            "PASS" if ok else "FAIL",
        )
    )
    return bool(ok)


conn = get_connection()
checks = []

try:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM users WHERE id = %s;",
            (USER_ID,),
        )
        user = cur.fetchone()

        cur.execute(
            """
            SELECT
              COUNT(*) AS executions_count,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'COMPLETED'
              ) AS completed_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'FAILED'
              ) AS failed_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'QUEUED'
              ) AS queued_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'RUNNING'
              ) AS running_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'PROCESSING'
              ) AS processing_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'CANCELLED'
              ) AS cancelled_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'FAILED'
                  AND e.error_code = 'EXECUTION_TIMEOUT'
              ) AS timeout_executions,
              COUNT(*) FILTER (
                WHERE e.execution_state = 'FAILED'
                  AND COALESCE(e.error_code, '') <>
                      'EXECUTION_TIMEOUT'
              ) AS error_executions
            FROM executions e
            JOIN submissions s
              ON s.id = e.submission_id
            WHERE s.user_id = %s;
            """,
            (USER_ID,),
        )
        counts = cur.fetchone()

        cur.execute(
            """
            SELECT
              e.id,
              e.public_id::text AS public_id,
              e.codename,
              e.execution_state,
              s.title AS submission_title
            FROM executions e
            JOIN submissions s
              ON s.id = e.submission_id
            WHERE s.user_id = %s
            ORDER BY e.id DESC
            LIMIT 1;
            """,
            (USER_ID,),
        )
        latest = cur.fetchone()

    checks.append(
        ck("Admin target user exists", user is not None)
    )

    total_from_states = sum(
        int(counts[key] or 0)
        for key in [
            "completed_executions",
            "failed_executions",
            "queued_executions",
            "running_executions",
            "processing_executions",
            "cancelled_executions",
        ]
    )

    checks.append(
        ck(
            "Canonical state buckets equal total executions",
            total_from_states
            == int(counts["executions_count"] or 0),
        )
    )
    checks.append(
        ck(
            "FAILED equals timeout + other errors",
            int(counts["failed_executions"] or 0)
            == int(counts["timeout_executions"] or 0)
            + int(counts["error_executions"] or 0),
        )
    )
    checks.append(
        ck(
            "Latest execution exists",
            latest is not None,
        )
    )

    if latest:
        checks.append(
            ck(
                "Latest has publicId",
                bool(latest["public_id"]),
            )
        )
        checks.append(
            ck(
                "Latest has codename",
                bool(latest["codename"]),
            )
        )
        checks.append(
            ck(
                "Latest has submission title",
                bool(latest["submission_title"]),
            )
        )
        checks.append(
            ck(
                "Latest state is canonical",
                latest["execution_state"] in {
                    "QUEUED",
                    "RUNNING",
                    "PROCESSING",
                    "COMPLETED",
                    "FAILED",
                    "CANCELLED",
                },
            )
        )

finally:
    conn.close()

passed = sum(checks)
total = len(checks)

print("")
print("RESULTADO DB CORE-04E-3")
print("=======================")
print(f"{passed}/{total} checks passed")
print(
    "RESULT: {}".format(
        "PASS" if passed == total else "FAIL"
    )
)
sys.exit(0 if passed == total else 1)
