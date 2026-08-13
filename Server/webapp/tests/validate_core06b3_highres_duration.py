#!/usr/bin/env python3
from pathlib import Path
import csv
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
HELPER = ROOT / "Server/benchmark_timer.py"
SCRIPTS = [
    ROOT / "Server/measurescript3.sh",
    ROOT / "Server/measurescript4.sh",
    ROOT / "Server/measurescript5.sh",
]


def check(label, condition):
    ok = bool(condition)
    print(f"{label:<82} {'PASS' if ok else 'FAIL'}")
    return ok


checks = []

ok_program = subprocess.run(
    [
        sys.executable,
        str(HELPER),
        "--",
        "/bin/sh",
        "-c",
        "sleep 0.004; exit 0",
    ],
    capture_output=True,
    text=True,
)

checks.append(check("helper returncode interno=0", ok_program.returncode == 0))

fields = ok_program.stdout.strip().split("\t")
checks.append(check("helper entrega 4 campos TSV", len(fields) == 4))

if len(fields) == 4:
    start_ms, end_ms, duration_text, program_rc = fields
    checks.append(check(
        "StartTime/EndTime siguen siendo epoch-ms enteros",
        start_ms.isdigit() and end_ms.isdigit(),
    ))
    checks.append(check(
        "DurationTime tiene seis decimales",
        re.fullmatch(r"\d+\.\d{6}", duration_text) is not None,
    ))
    checks.append(check("DurationTime es positivo", float(duration_text) > 0.0))
    checks.append(check("program returncode=0", program_rc == "0"))
else:
    checks.extend([
        check("StartTime/EndTime siguen siendo epoch-ms enteros", False),
        check("DurationTime tiene seis decimales", False),
        check("DurationTime es positivo", False),
        check("program returncode=0", False),
    ])

fail_program = subprocess.run(
    [
        sys.executable,
        str(HELPER),
        "--",
        "/bin/sh",
        "-c",
        "exit 7",
    ],
    capture_output=True,
    text=True,
)

fail_fields = fail_program.stdout.strip().split("\t")
checks.append(check(
    "helper conserva returncode del benchmark",
    fail_program.returncode == 0
    and len(fail_fields) == 4
    and fail_fields[3] == "7",
))

for script in SCRIPTS:
    text = script.read_text(encoding="utf-8")
    checks.append(check(
        f"{script.name}: usa benchmark_timer.py",
        "benchmark_timer.py" in text,
    ))
    checks.append(check(
        f"{script.name}: no usa date +%s%3N",
        "date +%s%3N" not in text,
    ))
    syntax = subprocess.run(
        ["bash", "-n", str(script)],
        capture_output=True,
        text=True,
    )
    checks.append(check(
        f"{script.name}: bash -n",
        syntax.returncode == 0,
    ))

tmp = Path(tempfile.mkdtemp(prefix="core06b3_"))

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
        power/*|LLC-*|L1-dcache-stores)
            printf '<not supported>;;%s;0;100.00\n' "$event" >> "$out"
            ;;
        task-clock|cpu-clock)
            printf '1.25;msec;%s;0;100.00\n' "$event" >> "$out"
            ;;
        *)
            printf '100;;%s;0;100.00\n' "$event" >> "$out"
            ;;
    esac
done

exit 0
''',
        encoding="utf-8",
    )
    fake_perf.chmod(fake_perf.stat().st_mode | stat.S_IXUSR)

    generic = tmp / "algo"
    generic.write_text(
        "#!/bin/bash\nsleep 0.002\nexit 0\n",
        encoding="utf-8",
    )
    generic.chmod(generic.stat().st_mode | stat.S_IXUSR)

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
        "BENCHMARK_TIMER_HELPER": str(HELPER),
    })

    cases = [
        ("CAMM", SCRIPTS[0], [str(generic), str(numeric_input), "10", "2"]),
        ("LCS", SCRIPTS[1], [str(generic), str(text_input), "10", "2"]),
        ("SIZE", SCRIPTS[2], [str(generic), "10", "2"]),
    ]

    for label, script, args in cases:
        csv_path = tmp / f"{label}.csv"

        run = subprocess.run(
            ["bash", str(script), *args, str(csv_path)],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )

        checks.append(check(f"{label}: smoke returncode=0", run.returncode == 0))

        rows = []
        if csv_path.is_file():
            with csv_path.open(newline="", encoding="utf-8") as handle:
                rows = list(csv.reader(handle))

        checks.append(check(
            f"{label}: header + 2 filas",
            len(rows) == 3,
        ))
        checks.append(check(
            f"{label}: 27 columnas",
            bool(rows) and all(len(row) == 27 for row in rows),
        ))

        durations = [row[24] for row in rows[1:]] if len(rows) == 3 else []
        checks.append(check(
            f"{label}: DurationTime decimal",
            len(durations) == 2
            and all(re.fullmatch(r"\d+\.\d{6}", value) for value in durations)
            and all(float(value) > 0 for value in durations),
        ))

finally:
    shutil.rmtree(tmp, ignore_errors=True)

passed = sum(checks)
total = len(checks)

print("")
print("RESULTADO CORE-06B-3")
print("====================")
print(f"{passed}/{total} checks passed")
print("RESULT:", "PASS" if passed == total else "FAIL")

if passed != total:
    raise SystemExit(1)
