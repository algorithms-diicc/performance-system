#!/usr/bin/env python3
"""
Performance System — dispatcher persistente de executions.

Proceso independiente de Flask/Gunicorn.

Invariantes:
- PostgreSQL es la fuente de verdad de la cola.
- Sólo una instancia del dispatcher puede operar por base de datos.
- Se reclama una única Execution FIFO por ciclo.
- Nunca se ejecutan dos benchmarks en paralelo desde este dispatcher.
"""

import argparse
import json
import os
from pathlib import Path
import signal
import sys
import time


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from Server.db_connection import get_connection
from Server.webapp.repositories import submission_repository
from Server.webapp.services import execution_state_service
from Server.webapp.services.execution_dispatch_service import (
    materialize_execution_source,
)
from Server.webapp.services.execution_queue_service import (
    claim_next_queued_execution,
)
from Server.webapp.services.execution_runner_service import (
    run_single_execution,
    sync_submission_terminal_status,
)
from Server.webapp.services.worker_execution_service import (
    stop_heartbeat_lease,
)


SERVER_DIR = Path(__file__).resolve().parent
TEST_DIR = SERVER_DIR / "test"
STATUS_DIR = SERVER_DIR / "status"
STATIC_DIR = SERVER_DIR / "webapp" / "static"

DISPATCHER_LOCK_KEY = int(
    os.getenv("EXECUTION_DISPATCHER_LOCK_KEY", "74040102")
)
DEFAULT_POLL_SECONDS = float(
    os.getenv("EXECUTION_DISPATCHER_POLL_SECONDS", "2")
)


def _json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def acquire_singleton_lock(
    conn,
    lock_key=DISPATCHER_LOCK_KEY,
):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_try_advisory_lock(%s) AS acquired;",
            (lock_key,),
        )
        row = cur.fetchone()
    return bool(row and row["acquired"])


def release_singleton_lock(
    conn,
    lock_key=DISPATCHER_LOCK_KEY,
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pg_advisory_unlock(%s) AS released;",
                (lock_key,),
            )
            row = cur.fetchone()
        return bool(row and row["released"])
    except Exception:
        return False


def _compiler_flags(execution):
    config = (execution or {}).get("execution_config") or {}
    if not isinstance(config, dict):
        return "-O3"
    value = str(
        config.get("compiler_flags") or "-O3"
    ).strip()
    return value or "-O3"


def _mark_dispatch_failure(
    execution,
    exc,
    *,
    state_service=execution_state_service,
):
    if not execution:
        return None

    public_id = execution.get("public_id")
    codename = execution.get("codename")
    if not public_id:
        return None

    try:
        current = state_service.execution_repository.get_execution(
            public_id
        )
    except Exception:
        current = execution

    state = current.get("execution_state")
    if state not in ("RUNNING", "PROCESSING"):
        if codename:
            stop_heartbeat_lease(codename)
        return current

    try:
        return state_service.mark_failed(
            public_id,
            failure_stage="INFRASTRUCTURE",
            error_code="DISPATCHER_ERROR",
            error_message="{}: {}".format(
                type(exc).__name__,
                exc,
            ),
        )
    finally:
        if codename:
            stop_heartbeat_lease(codename)


def run_dispatch_cycle(
    *,
    base_dir=SERVER_DIR,
    test_dir=TEST_DIR,
    status_dir=STATUS_DIR,
    static_dir=STATIC_DIR,
    claim_func=claim_next_queued_execution,
    submission_repo=submission_repository,
    materialize_func=materialize_execution_source,
    runner_func=run_single_execution,
    sync_func=sync_submission_terminal_status,
    failure_func=_mark_dispatch_failure,
):
    """
    Reclama y procesa como máximo una Execution.

    Retorna un resumen serializable para logs/tests.
    """
    execution = claim_func()
    if execution is None:
        return {
            "claimed": False,
            "execution": None,
        }

    submission_id = execution["submission_id"]
    codename = execution["codename"]

    try:
        submission = submission_repo.get_submission(
            submission_id
        )
        source = materialize_func(
            execution,
            submission,
            base_dir,
            test_dir,
        )

        result = runner_func(
            source_path=source["source_path"],
            codename=codename,
            original_filename=source["original_filename"],
            input_size=execution["input_size"],
            samples=execution["samples"],
            status_dir=str(status_dir),
            static_dir=str(static_dir),
            base_dir=str(base_dir),
            opt_cmd=_compiler_flags(execution),
            already_claimed=True,
            public_id=execution["public_id"],
        )

    except Exception as exc:
        failed = failure_func(
            execution,
            exc,
        )
        try:
            sync_func(submission_id)
        except Exception as sync_exc:
            print(
                "[DISPATCH] No se pudo sincronizar Submission {}: {}"
                .format(submission_id, sync_exc),
                file=sys.stderr,
                flush=True,
            )

        return {
            "claimed": True,
            "execution": execution["public_id"],
            "codename": codename,
            "state": (
                failed.get("execution_state")
                if isinstance(failed, dict)
                else "FAILED"
            ),
            "error": "{}: {}".format(
                type(exc).__name__,
                exc,
            ),
        }

    try:
        sync_result = sync_func(submission_id)
    except Exception as exc:
        sync_result = {
            "updated": False,
            "error": "{}: {}".format(
                type(exc).__name__,
                exc,
            ),
        }
        print(
            "[DISPATCH] Execution terminal, pero falló sync Submission {}: {}"
            .format(submission_id, exc),
            file=sys.stderr,
            flush=True,
        )

    return {
        "claimed": True,
        "execution": execution["public_id"],
        "codename": codename,
        "state": result.get("execution_state"),
        "submissionSync": sync_result,
    }


def build_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Performance System persistent FIFO execution dispatcher."
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--once",
        action="store_true",
        help="Ejecuta un ciclo y termina.",
    )
    mode.add_argument(
        "--watch",
        action="store_true",
        help="Procesa continuamente hasta SIGINT/SIGTERM.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=DEFAULT_POLL_SECONDS,
        help="Segundos entre polls cuando la cola está vacía.",
    )
    return parser


def validate_args(args):
    if args.interval <= 0:
        raise ValueError("--interval debe ser > 0.")


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        validate_args(args)
    except ValueError as exc:
        parser.error(str(exc))

    lock_conn = get_connection()
    if not acquire_singleton_lock(lock_conn):
        print(
            "[DISPATCH] Otra instancia ya posee el lock.",
            file=sys.stderr,
        )
        lock_conn.close()
        return 3

    stop_requested = {"value": False}

    def request_stop(signum, frame):
        stop_requested["value"] = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    watch = bool(args.watch)

    try:
        while True:
            result = {
                "claimed": False,
                "execution": None,
            }
            try:
                result = run_dispatch_cycle()
                print(
                    json.dumps(
                        result,
                        ensure_ascii=False,
                        default=_json_default,
                    ),
                    flush=True,
                )
            except Exception as exc:
                print(
                    "[DISPATCH] Error de ciclo: {}: {}".format(
                        type(exc).__name__,
                        exc,
                    ),
                    file=sys.stderr,
                    flush=True,
                )

            if not watch or stop_requested["value"]:
                break

            if not result.get("claimed"):
                deadline = time.monotonic() + args.interval
                while (
                    not stop_requested["value"]
                    and time.monotonic() < deadline
                ):
                    time.sleep(
                        min(
                            0.25,
                            max(
                                0.0,
                                deadline - time.monotonic(),
                            ),
                        )
                    )

            if stop_requested["value"]:
                break

        return 0

    finally:
        release_singleton_lock(lock_conn)
        lock_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
