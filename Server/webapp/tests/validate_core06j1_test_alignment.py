#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys


FILES = [
    "Server/webapp/tests/validate_availability_ui03b8.py",
    "Server/webapp/tests/validate_core06b2_metric_contract.py",
    "Server/webapp/tests/validate_core06b3_highres_duration.py",
    "Server/tests/test_execution_creation_service.py",
    "Server/tests/test_worker_execution_service.py",
]


def root():
    candidates = [Path.cwd().resolve(), Path(__file__).resolve().parent]
    env = os.environ.get("PERF_SYSTEM_ROOT")
    if env:
        candidates.insert(0, Path(env).expanduser().resolve())

    for candidate in candidates:
        for maybe in [candidate, *candidate.parents]:
            if (
                (maybe / "Server/slave.py").is_file()
                and (maybe / "Client/my-app/package.json").is_file()
            ):
                return maybe

    raise SystemExit("ERROR: no pude localizar performance-system.")


ROOT = root()
passes = []
failures = []


def record(ok, name, output=""):
    if ok:
        passes.append(name)
        print("[PASS]", name)
    else:
        failures.append((name, output))
        print("[FAIL]", name)
        if output:
            print(output)


def run(name, cmd, timeout=120):
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
    )
    print()
    print("$", " ".join(cmd))
    print(proc.stdout.rstrip())
    record(
        proc.returncode == 0,
        name,
        "exit code={}".format(proc.returncode),
    )


def main():
    print("=" * 76)
    print("CORE-06J-1 — VALIDACIÓN DE ALINEACIÓN DE TESTS")
    print("=" * 76)

    for file in FILES:
        run(
            "py_compile {}".format(file),
            [sys.executable, "-m", "py_compile", file],
        )

    run(
        "availability regression actualizado",
        [
            sys.executable,
            "Server/webapp/tests/validate_availability_ui03b8.py",
        ],
    )
    run(
        "CORE06B2 actualizado",
        [
            sys.executable,
            "Server/webapp/tests/validate_core06b2_metric_contract.py",
        ],
    )
    run(
        "CORE06B3 actualizado",
        [
            sys.executable,
            "Server/webapp/tests/validate_core06b3_highres_duration.py",
        ],
    )
    run(
        "execution creation tests",
        [
            sys.executable,
            "-m",
            "unittest",
            "Server.tests.test_execution_creation_service",
        ],
    )
    run(
        "worker execution tests",
        [
            sys.executable,
            "-m",
            "unittest",
            "Server.tests.test_worker_execution_service",
        ],
    )

    print()
    print("=" * 76)
    if failures:
        print(
            "CORE-06J-1: FAIL — {} bloques fallaron; {} pasaron."
            .format(len(failures), len(passes))
        )
        return 1

    print(
        "CORE-06J-1: PASS — {} comprobaciones/bloques pasaron."
        .format(len(passes))
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
