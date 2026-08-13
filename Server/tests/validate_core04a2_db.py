#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from psycopg2.extras import RealDictCursor

from Server.db_connection import get_connection


REQUIRED_COLUMNS = {
    "public_id",
    "codename",
    "execution_state",
    "failure_stage",
    "error_code",
    "error_message",
    "created_at",
    "queued_at",
    "processing_at",
    "updated_at",
    "last_heartbeat_at",
    "benchmark",
    "input_size",
    "samples",
    "execution_profile",
    "execution_config",
    "hardware_snapshot",
    "result_available",
    "result_path",
    "idempotency_key",
    "state_version",
}

REQUIRED_STATES = {
    "QUEUED",
    "RUNNING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
}

REQUIRED_INDEXES = {
    "idx_executions_public_id",
    "idx_executions_codename",
    "idx_executions_idempotency_key",
    "idx_executions_state_created_at",
    "idx_executions_submission_created_at",
    "idx_executions_benchmark_created_at",
    "idx_executions_active_heartbeat",
}

REQUIRED_CONSTRAINTS = {
    "chk_executions_execution_state",
    "chk_executions_failed_has_error_code",
    "chk_executions_input_size_positive",
    "chk_executions_samples_positive",
    "chk_executions_execution_profile",
    "chk_executions_state_version_nonnegative",
    "chk_executions_result_requires_completed",
}


def check(label, condition, detail=""):
    result = "PASS" if condition else "FAIL"
    print("{:<66} {}".format(label, result))
    if detail and not condition:
        print("  {}".format(detail))
    return bool(condition)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--expected-executions",
        type=int,
        default=None,
        help=(
            "Comprobación histórica opcional. Si se omite, el validador "
            "solo exige que su propia ejecución no altere el conteo actual."
        ),
    )
    args = parser.parse_args()

    conn = get_connection()
    conn.set_session(readonly=True, autocommit=False)
    checks = []

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'executions';
                """
            )
            columns = {row["column_name"] for row in cur.fetchall()}

            checks.append(
                check(
                    "Required execution columns exist",
                    REQUIRED_COLUMNS.issubset(columns),
                    "Faltan: {}".format(
                        sorted(REQUIRED_COLUMNS - columns)
                    ),
                )
            )

            cur.execute("SELECT COUNT(*) AS total FROM executions;")
            initial_total = cur.fetchone()["total"]

            if args.expected_executions is not None:
                checks.append(
                    check(
                        "Execution row count matches explicit expectation",
                        initial_total == args.expected_executions,
                        "Esperado {}, recibido {}".format(
                            args.expected_executions,
                            initial_total,
                        ),
                    )
                )

            cur.execute(
                """
                SELECT COUNT(*) AS missing
                FROM executions
                WHERE public_id IS NULL;
                """
            )
            missing_public = cur.fetchone()["missing"]

            checks.append(
                check(
                    "Every execution has public_id",
                    missing_public == 0,
                    "{} filas sin public_id".format(missing_public),
                )
            )

            cur.execute(
                """
                SELECT public_id, COUNT(*) AS c
                FROM executions
                GROUP BY public_id
                HAVING COUNT(*) > 1;
                """
            )
            duplicates = cur.fetchall()

            checks.append(
                check(
                    "public_id values are unique",
                    len(duplicates) == 0,
                )
            )

            cur.execute(
                """
                SELECT DISTINCT execution_state
                FROM executions;
                """
            )
            states = {
                row["execution_state"]
                for row in cur.fetchall()
            }

            checks.append(
                check(
                    "All persisted states are canonical",
                    states.issubset(REQUIRED_STATES),
                    "Estados: {}".format(sorted(states)),
                )
            )

            cur.execute(
                """
                SELECT COUNT(*) AS invalid
                FROM executions
                WHERE LOWER(COALESCE(status, '')) = 'ok'
                  AND execution_state <> 'COMPLETED';
                """
            )
            invalid_ok = cur.fetchone()["invalid"]

            checks.append(
                check(
                    "Legacy status=ok mapped to COMPLETED",
                    invalid_ok == 0,
                    "{} filas inconsistentes".format(invalid_ok),
                )
            )

            cur.execute(
                """
                SELECT COUNT(*) AS missing
                FROM executions
                WHERE created_at IS NULL
                   OR updated_at IS NULL;
                """
            )
            missing_timestamps = cur.fetchone()["missing"]

            checks.append(
                check(
                    "Lifecycle base timestamps are present",
                    missing_timestamps == 0,
                )
            )

            cur.execute(
                """
                SELECT COUNT(*) AS invalid
                FROM executions
                WHERE execution_config IS NULL
                   OR hardware_snapshot IS NULL;
                """
            )
            missing_json = cur.fetchone()["invalid"]

            checks.append(
                check(
                    "Configuration snapshots are initialized",
                    missing_json == 0,
                )
            )

            cur.execute(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'executions';
                """
            )
            indexes = {row["indexname"] for row in cur.fetchall()}

            checks.append(
                check(
                    "Required execution indexes exist",
                    REQUIRED_INDEXES.issubset(indexes),
                    "Faltan: {}".format(
                        sorted(REQUIRED_INDEXES - indexes)
                    ),
                )
            )

            cur.execute(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'public.executions'::regclass;
                """
            )
            constraints = {
                row["conname"]
                for row in cur.fetchall()
            }

            checks.append(
                check(
                    "Required execution constraints exist",
                    REQUIRED_CONSTRAINTS.issubset(constraints),
                    "Faltan: {}".format(
                        sorted(REQUIRED_CONSTRAINTS - constraints)
                    ),
                )
            )

            try:
                cur.execute(
                    """
                    SELECT COUNT(*) AS c
                    FROM schema_migrations
                    WHERE version = %s;
                    """,
                    ("core04a_001_execution_persistence",),
                )
                migration_count = cur.fetchone()["c"]
                checks.append(
                    check(
                        "Migration is registered",
                        migration_count == 1,
                    )
                )
            except Exception as exc:
                conn.rollback()
                checks.append(
                    check(
                        "Migration is registered",
                        False,
                        "No se pudo leer schema_migrations: {}".format(exc),
                    )
                )

            cur.execute(
                """
                SELECT
                    execution_state,
                    COUNT(*) AS count
                FROM executions
                GROUP BY execution_state
                ORDER BY execution_state;
                """
            )
            distribution = cur.fetchall()

            cur.execute("SELECT COUNT(*) AS total FROM executions;")
            final_total = cur.fetchone()["total"]

            checks.append(
                check(
                    "Execution row count preserved during validation",
                    final_total == initial_total,
                    "Inicial {}, final {}".format(
                        initial_total,
                        final_total,
                    ),
                )
            )

        print("")
        print("Execution state distribution")
        print("============================")
        for row in distribution:
            print(
                "{:<16} {}".format(
                    row["execution_state"],
                    row["count"],
                )
            )

    finally:
        conn.rollback()
        conn.close()

    passed = sum(1 for value in checks if value)
    total_checks = len(checks)

    print("")
    print("RESULTADO")
    print("=========")
    print("{}/{} checks passed".format(passed, total_checks))

    if passed == total_checks:
        print("RESULT: PASS")
        return 0

    print("RESULT: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
