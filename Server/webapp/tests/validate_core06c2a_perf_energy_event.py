#!/usr/bin/env python3
# Valida el bug real observado:
# perf devuelve power/energy-pkg/u, mientras el script solicita
# power/energy-pkg/. Después de CORE-06C-2A debe conservarse
# <not-supported>, no degradarse a <not-counted>.

from pathlib import Path
import csv
import os
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]

scripts = [
    ROOT / "Server/measurescript3.sh",
    ROOT / "Server/measurescript4.sh",
    ROOT / "Server/measurescript5.sh",
]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


tmp = Path(tempfile.mkdtemp(prefix="core06c2a_"))

try:
    fake_perf = tmp / "perf"
    fake_perf.write_text(
        r'''#!/bin/bash
out=""
events=""

while [ "$#" -gt 0 ]; do
    case "$1" in
        -o) out="$2"; shift 2 ;;
        -e) events="$2"; shift 2 ;;
        stat|--no-big-num|-a) shift ;;
        -x*) shift ;;
        *) shift ;;
    esac
done

: > "$out"
IFS=',' read -r -a evs <<< "$events"

for event in "${evs[@]}"; do
    case "$event" in
        power/energy-pkg/)
            printf '<not supported>;Joules;power/energy-pkg/u;0;100.00;;\n' >> "$out"
            ;;
        power/energy-cores/|power/energy-ram/)
            printf '<not supported>;Joules;%su;0;100.00;;\n' "$event" >> "$out"
            ;;
        LLC-*|L1-dcache-stores)
            printf '<not supported>;;%s;0;100.00;;\n' "$event" >> "$out"
            ;;
        task-clock|cpu-clock)
            printf '1.25;msec;%s;0;100.00;;\n' "$event" >> "$out"
            ;;
        instructions)
            printf '1000;;%s;0;100.00;;\n' "$event" >> "$out"
            ;;
        cache-misses)
            printf '10;;%s;0;100.00;;\n' "$event" >> "$out"
            ;;
        *)
            printf '100;;%s;0;100.00;;\n' "$event" >> "$out"
            ;;
    esac
done

exit 0
''',
        encoding="utf-8",
    )
    fake_perf.chmod(fake_perf.stat().st_mode | stat.S_IXUSR)

    algo = tmp / "algo"
    algo.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
    algo.chmod(algo.stat().st_mode | stat.S_IXUSR)

    numeric_input = tmp / "numbers.txt"
    numeric_input.write_text(
        "\n".join(str(i) for i in range(1, 21)) + "\n",
        encoding="utf-8",
    )

    text_input = tmp / "text.txt"
    text_input.write_text(
        "\n".join(f"line {i}" for i in range(1, 21)) + "\n",
        encoding="utf-8",
    )

    env = os.environ.copy()
    env.update({
        "PERF_BIN": str(fake_perf),
        "PERF_SYSTEM_WIDE": "0",
        "PERF_SINGLE_FALLBACK": "1",
        "INCREMENTS": "1",
        "WARMUP_ROUNDS": "0",
        "PYTHON_BIN": sys.executable,
        "BENCHMARK_TIMER_HELPER": str(ROOT / "Server/benchmark_timer.py"),
    })

    cases = [
        ("CAMM", scripts[0], [str(algo), str(numeric_input), "10", "1"]),
        ("LCS", scripts[1], [str(algo), str(text_input), "10", "1"]),
        ("SIZE", scripts[2], [str(algo), "10", "1"]),
    ]

    for label, script, args in cases:
        out = tmp / f"{label}.csv"
        run = subprocess.run(
            ["bash", str(script), *args, str(out)],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )

        require(
            run.returncode == 0,
            f"{label}: script falló rc={run.returncode}\n{run.stderr}",
        )

        with out.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))

        require(len(rows) == 1, f"{label}: se esperaba 1 fila")
        require(
            rows[0]["EnergyPkg"] == "<not-supported>",
            f"{label}: EnergyPkg={rows[0]['EnergyPkg']!r}",
        )
        require(
            rows[0]["EnergyPkg"] != "<not-counted>",
            f"{label}: degradó incorrectamente a not-counted",
        )

        print(f"{label}: power/energy-pkg/u -> <not-supported> PASS")

finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("CORE-06C-2A parser contract: PASS")
