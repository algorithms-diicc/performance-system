#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
app = (ROOT / "Server/webapp/app.py").read_text(encoding="utf-8")
route = (ROOT / "Server/webapp/routes/execution_status_routes.py").read_text(encoding="utf-8")
service = (ROOT / "Server/webapp/services/execution_query_service.py").read_text(encoding="utf-8")
repo = (ROOT / "Server/webapp/repositories/execution_query_repository.py").read_text(encoding="utf-8")

def ck(label, ok):
    print("{:<76} {}".format(label, "PASS" if ok else "FAIL"))
    return bool(ok)

checks = [
    ck("Blueprint imported", "from .routes.execution_status_routes import execution_status_bp" in app),
    ck("Blueprint registered", "app.register_blueprint(execution_status_bp)" in app),
    ck("UUID endpoint", '"/<uuid:public_id>"' in route),
    ck("Login required", "@login_required" in route),
    ck("Ownership enforced", "ExecutionSnapshotForbidden" in service),
    ck("Repository joins submissions", "JOIN submissions s" in repo),
    ck("Canonical execution_state exposed", '"state": state' in service),
    ck(
        "Controlled public failure exposed",
        "PUBLIC_FAILURE_MESSAGES" in service
        and '"stage": stage or None' in service
        and '"failure": failure' in service,
    ),
    ck(
        "Internal failure diagnostic not exposed",
        'row.get("error_message")' not in service,
    ),
    ck("Internal resultPath not exposed", '"resultPath"' not in service),
    ck("No legacy status-file dependency", "Server/status" not in service and "_status.json" not in service),
]

passed = sum(checks)
print("")
print("{}/{} checks passed".format(passed, len(checks)))
print("RESULT: {}".format("PASS" if passed == len(checks) else "FAIL"))
sys.exit(0 if passed == len(checks) else 1)
