#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Server.webapp.services.execution_query_service import get_execution_snapshot_for_user

if len(sys.argv) != 3:
    print("Uso: python3 Server/tests/validate_execution_status_db_core04d1.py <public_id> <user_id>")
    sys.exit(2)

public_id = sys.argv[1]
user_id = int(sys.argv[2])
p = get_execution_snapshot_for_user(public_id, user_id)

def ck(label, ok):
    print("{:<76} {}".format(label, "PASS" if ok else "FAIL"))
    return bool(ok)

checks = [
    ck("publicId correcto", p.get("publicId") == public_id),
    ck("codename presente", bool(p.get("codename"))),
    ck("estado canónico válido", p.get("state") in {"QUEUED","RUNNING","PROCESSING","COMPLETED","FAILED","CANCELLED"}),
    ck("stateVersion entero", isinstance(p.get("stateVersion"), int)),
    ck("submissionId presente", p.get("submissionId") is not None),
    ck("benchmark presente", bool(p.get("benchmark"))),
    ck("resultPath no expuesto", "resultPath" not in p),
    ck("failure shape válido", p.get("failure") is None or set(p["failure"]) == {"stage","code","message"}),
    ck("terminal coherente", p.get("terminal") == (p.get("state") in {"COMPLETED","FAILED","CANCELLED"})),
    ck("resultsUrl coherente", (p.get("resultAvailable") and bool(p.get("resultsUrl"))) or ((not p.get("resultAvailable")) and p.get("resultsUrl") is None)),
]

passed = sum(checks)
print("")
print("SNAPSHOT:", p)
print("{}/{} checks passed".format(passed, len(checks)))
print("RESULT: {}".format("PASS" if passed == len(checks) else "FAIL"))
sys.exit(0 if passed == len(checks) else 1)
