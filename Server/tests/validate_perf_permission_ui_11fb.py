#!/usr/bin/env python3
from pathlib import Path
import hashlib
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]

CHECKS = {
    "Server/webapp/services/pedagogy_service.py": [
        'metric_status == "permission_denied"',
        '"availability_permission_denied"',
        "permisos suficientes",
    ],
    "Client/my-app/src/screens/RenderImage.js": [
        'state === "permission_denied"',
        'probeState === "permission_denied"',
        'metricData?.status === "permission_denied"',
        "availability.permission_denied",
        "availability_permission_denied",
        "statuses.permissionDenied.label",
        "summary.permissionDeniedRows",
        "hardware.permissionDenied",
    ],
    "Client/my-app/src/screens/RenderImage.css": [
        "results-availability-permission-denied",
    ],
    "Client/my-app/src/i18n/locales/es.js": [
        "permissionDenied",
        "Permiso insuficiente",
        "permisos insuficientes",
    ],
    "Client/my-app/src/i18n/locales/en.js": [
        "permissionDenied",
        "Permission denied",
        "sufficient permission",
    ],
    ".env.example": [
        "kernel.perf_event_paranoid",
        "permission_denied",
        "no se reclasifica como hardware unsupported",
    ],
}

UNCHANGED = {
    "Server/webapp/services/comparison_service.py":
        "157c085d48ec21e8c7a9f1a508b26a977e8168540d21b45fa156d3d6fbd033ad",
    "Server/webapp/services/comparison_pedagogy_service.py":
        "76ed7ea989fbbdba5f8b0cc4470c4b7abc6945002a9b197618a78d4d2631db29",
    "Client/my-app/src/screens/comparisonModel.js":
        "0bff723ecf4175c4d48adf9a10bd22bd894d8b3e4abcf584566fb853c9f19f56",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(name, condition, detail=""):
    print(f"{'[PASS]' if condition else '[FAIL]'} {name}")
    if detail and not condition:
        print("       " + detail)
    return bool(condition)


def main():
    ok = True

    for rel, tokens in CHECKS.items():
        path = ROOT / rel
        exists = path.exists()
        ok &= check(f"{rel} existe", exists)
        if not exists:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for token in tokens:
            ok &= check(
                f"{rel}: {token}",
                token in text,
            )

    env_text = (ROOT / ".env.example").read_text(
        encoding="utf-8",
        errors="replace",
    )
    ok &= check(
        ".env.example no muta sysctl",
        "sysctl -w" not in env_text,
    )
    ok &= check(
        ".env.example no fija perf_event_paranoid por asignación",
        "kernel.perf_event_paranoid=" not in env_text,
    )

    results_text = (
        ROOT / "Server/webapp/services/results_service.py"
    ).read_text(encoding="utf-8", errors="replace")
    ok &= check(
        "11F-A sigue presente en results_service",
        "permission_denied" in results_text
        and "measurement_permission_denied" in results_text,
    )

    for rel, expected in UNCHANGED.items():
        path = ROOT / rel
        actual = sha256(path) if path.exists() else "MISSING"
        ok &= check(
            f"comparación permanece sin cambios: {rel}",
            actual == expected,
            f"esperado={expected} actual={actual}",
        )

    diff = subprocess.run(
        ["git", "--no-pager", "diff", "--check"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    ok &= check(
        "git diff --check",
        diff.returncode == 0 and not diff.stdout.strip(),
        diff.stdout.strip(),
    )

    print("")
    print(
        "11F-B VALIDATION:",
        "PASS" if ok else "FAIL",
    )
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
