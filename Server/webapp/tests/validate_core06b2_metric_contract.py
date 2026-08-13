#!/usr/bin/env python3
from pathlib import Path
import importlib
import sys
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def check(label, condition):
    ok = bool(condition)
    print(f"{label:<76} {'PASS' if ok else 'FAIL'}")
    return ok

checks = []
dp = importlib.import_module("Server.webapp.dataProcessing")
rs = importlib.import_module("Server.webapp.services.results_service")

series = pd.Series([0, 0, 0, 0, 100])
st = dp.iqr_stats(series, min_n=5)
checks.append(check(
    "dataProcessing IQR conserva 5 si filtrado dejaría 4",
    int(st["n"]) == 5 and bool(st["filtered"]) is False,
))

api = rs._iqr_statistics(series)
checks.append(check(
    "results_service IQR conserva 5",
    api["samples_total"] == 5 and api["samples_valid"] == 5,
))
checks.append(check(
    "results_service fallback informa iqr_applied=False",
    api["iqr_applied"] is False and api["outliers_removed"] == 0,
))

raw = pd.DataFrame({
    "Instructions": ["100"] * 4,
    "CpuCycles": ["<not-supported>"] * 4,
    "CacheMisses": ["10", "11", "12", "13"],
    "CacheReferences": ["100"] * 4,
    "BranchMisses": ["<not-counted>"] * 4,
    "Branches": ["100"] * 4,
})
derived = dp._collect_derived_availability(raw)
checks.append(check(
    "IPC hereda unsupported",
    derived["IPC"]["unsupported"] == 4 and derived["IPC"]["numeric"] == 0,
))
checks.append(check(
    "CacheMissRate queda disponible",
    derived["CacheMissRate"]["numeric"] == 4,
))
checks.append(check(
    "BranchMissRate hereda not_counted",
    derived["BranchMissRate"]["not_counted"] == 4,
))

combined = pd.DataFrame({"InputSize": ["100"] * 4, "IPC": [""] * 4})
old = {
    "Instructions": {"rows_total": 4, "numeric": 4, "unsupported": 0, "not_counted": 0, "missing": 0},
    "CpuCycles": {"rows_total": 4, "numeric": 0, "unsupported": 4, "not_counted": 0, "missing": 0},
}
extended = rs._extend_legacy_derived_availability(combined, old)
checks.append(check(
    "sidecar antiguo: IPC inferido unsupported",
    extended["IPC"]["unsupported"] == 4 and extended["IPC"]["missing"] == 0,
))

results_text = (ROOT / "Server/webapp/services/results_service.py").read_text(encoding="utf-8")
checks.append(check(
    "IQR actual es diagnóstico no destructivo",
    api["iqr_diagnostic_applied"] is True
    and api["iqr_outliers_detected"] == 1
    and api["outliers_removed"] == 0
    and api["samples_valid"] == api["samples_total"] == 5,
))

constants = (ROOT / "Client/my-app/src/common/Constants.js").read_text(encoding="utf-8")
checks.append(check(
    "Tiempo contiene sólo DurationTime",
    'Tiempo: ["DurationTime"]' in constants,
))
checks.append(check(
    "timestamps fuera de categoría Tiempo",
    'Tiempo: ["StartTime", "EndTime", "DurationTime"]' not in constants,
))
checks.append(check(
    "descripción caché reconoce semántica PMU",
    "no debe interpretarse automáticamente como la suma" in constants
    and "semántica del PMU" in constants,
))

passed = sum(checks)
total = len(checks)
print("")
print("RESULTADO CORE-06B-2")
print("====================")
print(f"{passed}/{total} checks passed")
print("RESULT:", "PASS" if passed == total else "FAIL")
if passed != total:
    raise SystemExit(1)
