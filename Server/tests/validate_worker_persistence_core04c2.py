#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "Server" / "webapp" / "app.py"
SOCKETS = ROOT / "Server" / "webapp" / "socketUtils.py"
REPO = ROOT / "Server" / "webapp" / "repositories" / "execution_repository.py"
WORKER = ROOT / "Server" / "webapp" / "services" / "worker_execution_service.py"


def check(label, condition):
    print("{:<74} {}".format(label, "PASS" if condition else "FAIL"))
    return bool(condition)


def main():
    app = APP.read_text(encoding="utf-8")
    sockets = SOCKETS.read_text(encoding="utf-8")
    repo = REPO.read_text(encoding="utf-8")
    worker = WORKER.read_text(encoding="utf-8")

    serve_start = app.index("def serve_next_inline():")
    serve_end = app.index("def get_status_file_count():", serve_start)
    serve = app[serve_start:serve_end]

    checks = [
        check(
            "Repository resolves executions by codename",
            "def get_execution_by_codename(" in repo,
        ),
        check(
            "RUNNING is persisted before slave_serve",
            "mark_worker_started(codename)" in serve
            and serve.index("mark_worker_started(codename)")
            < serve.index("slave_serve("),
        ),
        check(
            "Worker outcome is persisted",
            "persist_worker_outcome(" in serve,
        ),
        check(
            "CombinedResults.csv is verified before completion",
            "result_bundle_exists(" in serve,
        ),
        check(
            "COMPLETED is persisted through worker service",
            "mark_worker_completed(" in serve,
        ),
        check(
            "Processing failures have explicit persistence path",
            "mark_processing_failed(" in serve,
        ),
        check(
            "Legacy ERROR-to-DONE overwrite block was removed",
            'if final_status == "ERROR: no machines available"' not in serve,
        ),
        check(
            "socketUtils error path uses canonical codename",
            "escribir_estado(\n                codename," in sockets
            and "STATUS_DIR,\n                codename" in sockets,
        ),
        check(
            "worker service does not contain direct SQL",
            "SELECT " not in worker and "UPDATE " not in worker,
        ),
    ]

    passed = sum(checks)
    total = len(checks)
    print("")
    print("RESULTADO CORE-04C-2")
    print("=====================")
    print("{}/{} checks passed".format(passed, total))
    print("RESULT: {}".format("PASS" if passed == total else "FAIL"))
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
