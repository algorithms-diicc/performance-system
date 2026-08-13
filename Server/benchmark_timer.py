#!/usr/bin/env python3
"""
Performance System — high-resolution benchmark timer.

Salida TSV:
StartTime_ms    EndTime_ms    DurationTime_ms    returncode

DurationTime usa time.perf_counter_ns() / CLOCK_MONOTONIC.
StartTime y EndTime se conservan como epoch-ms para trazabilidad.
"""

import subprocess
import sys
import time


def run_command(argv):
    if not argv:
        raise ValueError("No se recibió comando benchmark.")

    start_wall_ns = time.time_ns()
    start_mono_ns = time.perf_counter_ns()

    completed = subprocess.run(
        argv,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )

    end_mono_ns = time.perf_counter_ns()
    end_wall_ns = time.time_ns()

    duration_ns = max(0, end_mono_ns - start_mono_ns)

    return {
        "start_ms": start_wall_ns // 1_000_000,
        "end_ms": end_wall_ns // 1_000_000,
        "duration_ms": duration_ns / 1_000_000.0,
        "returncode": int(completed.returncode),
    }


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)

    if args and args[0] == "--":
        args = args[1:]

    if not args:
        print(
            "Uso: benchmark_timer.py -- <ejecutable> [argumentos...]",
            file=sys.stderr,
        )
        return 2

    try:
        result = run_command(args)
    except OSError as exc:
        print(f"ERROR_TIMER: {exc}", file=sys.stderr)
        return 3
    except Exception as exc:
        print(f"ERROR_TIMER: {exc}", file=sys.stderr)
        return 4

    print(
        f"{result['start_ms']}\t"
        f"{result['end_ms']}\t"
        f"{result['duration_ms']:.6f}\t"
        f"{result['returncode']}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
