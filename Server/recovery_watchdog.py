#!/usr/bin/env python3
"""
Performance System — recovery watchdog.

Proceso independiente de Flask/Gunicorn.

Responsabilidad:
- detectar RUNNING/PROCESSING sin heartbeat;
- recuperar únicamente executions activas abandonadas;
- no expirar QUEUED: la espera FIFO persistente puede ser legítimamente larga.

El watchdog usa un PostgreSQL advisory lock para garantizar una única instancia
activa por base de datos.
"""

import argparse
import json
import os
import signal
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Server.db_connection import get_connection
from Server.webapp.services.execution_recovery_service import (
    recover_stale_executions,
)


WATCHDOG_LOCK_KEY = int(
    os.getenv("RECOVERY_WATCHDOG_LOCK_KEY", "74040101")
)
DEFAULT_INTERVAL_SECONDS = int(
    os.getenv("RECOVERY_WATCHDOG_INTERVAL_SECONDS", "30")
)
DEFAULT_ACTIVE_STALE_SECONDS = int(
    os.getenv("RECOVERY_ACTIVE_STALE_SECONDS", "90")
)


def _json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def acquire_singleton_lock(conn, lock_key=WATCHDOG_LOCK_KEY):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_try_advisory_lock(%s) AS acquired;",
            (lock_key,),
        )
        row = cur.fetchone()
    return bool(row and row["acquired"])


def release_singleton_lock(conn, lock_key=WATCHDOG_LOCK_KEY):
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


def run_recovery_cycle(
    apply_changes,
    active_stale_seconds,
    recovery_func=recover_stale_executions,
):
    return recovery_func(
        active_stale_seconds=active_stale_seconds,
        dry_run=not apply_changes,
    )


def print_cycle(result):
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            default=_json_default,
        ),
        flush=True,
    )


def build_parser():
    parser = argparse.ArgumentParser(
        description="Performance System stale execution watchdog."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--once",
        action="store_true",
        help="Ejecuta un ciclo y termina. Es el modo por defecto.",
    )
    mode.add_argument(
        "--watch",
        action="store_true",
        help="Ejecuta ciclos periódicos hasta recibir SIGINT/SIGTERM.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica recovery. Sin esta opción opera en dry-run.",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL_SECONDS,
        help="Segundos entre ciclos en modo --watch.",
    )
    parser.add_argument(
        "--active-seconds",
        type=int,
        default=DEFAULT_ACTIVE_STALE_SECONDS,
        help="Umbral stale para RUNNING/PROCESSING.",
    )
    return parser


def validate_args(args):
    if args.interval <= 0:
        raise ValueError("--interval debe ser > 0.")
    if args.active_seconds <= 0:
        raise ValueError("--active-seconds debe ser > 0.")


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
            "[RECOVERY] Otra instancia del watchdog ya posee el lock.",
            file=sys.stderr,
        )
        lock_conn.close()
        return 3

    stop_requested = {"value": False}

    def request_stop(signum, frame):
        stop_requested["value"] = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    try:
        while True:
            try:
                result = run_recovery_cycle(
                    apply_changes=args.apply,
                    active_stale_seconds=args.active_seconds,
                )
                print_cycle(result)
            except Exception as exc:
                print(
                    "[RECOVERY] Error en ciclo: {}: {}".format(
                        type(exc).__name__,
                        exc,
                    ),
                    file=sys.stderr,
                    flush=True,
                )

            if not args.watch or stop_requested["value"]:
                break

            deadline = time.monotonic() + args.interval
            while (
                not stop_requested["value"]
                and time.monotonic() < deadline
            ):
                time.sleep(
                    min(
                        0.5,
                        max(0.0, deadline - time.monotonic()),
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
