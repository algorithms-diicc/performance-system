#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Server.webapp.services.execution_access_service import (
    ExecutionAccessForbidden,
    assert_execution_owner,
)

if len(sys.argv) != 3:
    print(
        "Uso: python3 Server/tests/"
        "validate_execution_access_db_core04d4.py "
        "<codename> <owner_user_id>"
    )
    sys.exit(2)

codename = sys.argv[1]
owner_id = int(sys.argv[2])

row = assert_execution_owner(codename, owner_id)
print("OWNER ACCESS: PASS")
print(row)

try:
    assert_execution_owner(codename, owner_id + 999999)
except ExecutionAccessForbidden:
    print("FOREIGN ACCESS: PASS")
    print("RESULT: PASS")
    sys.exit(0)

print("FOREIGN ACCESS: FAIL")
print("RESULT: FAIL")
sys.exit(1)
