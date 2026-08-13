#!/usr/bin/env python3
"""
Validador de integración CORE-04A-3.

Crea una submission + execution TEMPORALES dentro de una única transacción.
Al final hace ROLLBACK, por lo que no deja datos de prueba permanentes.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from psycopg2.extras import RealDictCursor

from Server.db_connection import get_connection
from Server.webapp.repositories.execution_repository import (
    ConcurrentExecutionUpdate,
    get_execution,
    transition_execution as repository_transition,
)
from Server.webapp.services.execution_state_service import (
    InvalidExecutionTransition,
    mark_completed,
    mark_processing,
    mark_running,
)


def report(label, ok, detail=""):
    print("{:<68} {}".format(label, "PASS" if ok else "FAIL"))
    if detail and not ok:
        print("  {}".format(detail))
    return bool(ok)


def scalar(cur, query, params=None):
    cur.execute(query, params or ())
    row = cur.fetchone()
    return list(row.values())[0]


def main():
    checks = []
    conn = get_connection()
    conn.autocommit = False

    # Cantidad persistente antes del fixture temporal.
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        before_count = scalar(cur, "SELECT COUNT(*) AS c FROM executions;")

    public_id = None

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM users
                ORDER BY id
                LIMIT 1;
                """
            )
            user = cur.fetchone()
            if user is None:
                print("No existe ningún user para construir el fixture.")
                return 2

            cur.execute(
                """
                INSERT INTO submissions (
                    user_id,
                    title,
                    language,
                    status
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    user["id"],
                    "__CORE04A3_TEMP__",
                    "C++",
                    "pending",
                ),
            )
            submission_id = cur.fetchone()["id"]

            cur.execute(
                """
                INSERT INTO executions (
                    submission_id,
                    execution_state,
                    status,
                    queued_at,
                    benchmark,
                    input_size,
                    samples,
                    execution_profile,
                    execution_config,
                    hardware_snapshot
                )
                VALUES (
                    %s,
                    'QUEUED',
                    'pending',
                    CURRENT_TIMESTAMP,
                    'LCS',
                    500,
                    30,
                    'BALANCED',
                    %s::jsonb,
                    %s::jsonb
                )
                RETURNING public_id::text AS public_id;
                """,
                (
                    submission_id,
                    '{"compiler_flags":"-O3"}',
                    '{"test_fixture":true}',
                ),
            )
            public_id = cur.fetchone()["public_id"]

        row = get_execution(public_id, conn=conn)
        checks.append(report(
            "Temporary execution is retrievable by public_id",
            row["execution_state"] == "QUEUED",
        ))

        row = mark_running(public_id, conn=conn)
        checks.append(report(
            "QUEUED -> RUNNING",
            row["execution_state"] == "RUNNING",
        ))
        checks.append(report(
            "RUNNING sets started_at",
            row["started_at"] is not None,
        ))
        checks.append(report(
            "First state transition increments state_version",
            row["state_version"] == 1,
            "state_version={}".format(row["state_version"]),
        ))
        checks.append(report(
            "Legacy status remains synchronized while compatibility is active",
            row["status"] == "running",
            "status={}".format(row["status"]),
        ))

        # Optimistic concurrency: intentamos usar una versión obsoleta.
        stale_detected = False
        try:
            repository_transition(
                public_id=public_id,
                expected_state="RUNNING",
                expected_version=0,  # ya es 1
                new_state="PROCESSING",
                conn=conn,
            )
        except ConcurrentExecutionUpdate:
            stale_detected = True

        checks.append(report(
            "Stale state_version is rejected atomically",
            stale_detected,
        ))

        row = mark_processing(public_id, conn=conn)
        checks.append(report(
            "RUNNING -> PROCESSING",
            row["execution_state"] == "PROCESSING",
        ))
        checks.append(report(
            "PROCESSING sets processing_at",
            row["processing_at"] is not None,
        ))
        checks.append(report(
            "Second transition increments state_version",
            row["state_version"] == 2,
            "state_version={}".format(row["state_version"]),
        ))

        result_path = (
            "Server/webapp/static/__CORE04A3_TEMP__/CombinedResults.csv"
        )
        row = mark_completed(
            public_id,
            result_path=result_path,
            conn=conn,
        )

        checks.append(report(
            "PROCESSING -> COMPLETED",
            row["execution_state"] == "COMPLETED",
        ))
        checks.append(report(
            "COMPLETED persists result metadata",
            row["result_available"] is True
            and row["result_path"] == result_path,
        ))
        checks.append(report(
            "COMPLETED sets finished_at",
            row["finished_at"] is not None,
        ))
        checks.append(report(
            "COMPLETED synchronizes legacy status=ok",
            row["status"] == "ok",
            "status={}".format(row["status"]),
        ))
        checks.append(report(
            "Third transition increments state_version",
            row["state_version"] == 3,
            "state_version={}".format(row["state_version"]),
        ))

        terminal_rejected = False
        try:
            mark_running(public_id, conn=conn)
        except InvalidExecutionTransition:
            terminal_rejected = True

        checks.append(report(
            "Terminal COMPLETED -> RUNNING is rejected",
            terminal_rejected,
        ))

    finally:
        # El fixture entero desaparece.
        conn.rollback()

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            after_count = scalar(cur, "SELECT COUNT(*) AS c FROM executions;")

        checks.append(report(
            "Integration fixture leaves no persistent execution rows",
            after_count == before_count,
            "before={}, after={}".format(before_count, after_count),
        ))

        conn.close()

    passed = sum(1 for value in checks if value)
    total = len(checks)

    print("")
    print("RESULTADO CORE-04A-3")
    print("=====================")
    print("{}/{} checks passed".format(passed, total))
    print("RESULT: {}".format("PASS" if passed == total else "FAIL"))

    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())