#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MODULE = ROOT / "Server/hardware_snapshot.py"

spec = importlib.util.spec_from_file_location("hardware_snapshot_core06c3", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

module._perf_list = lambda perf_bin: "power/energy-pkg/ [Kernel PMU event]"
module._perf_version = lambda perf_bin: "perf version TEST-1.0"
module._powercap_domains = lambda: {
    "package-0": {
        "energy_uj_exposed": True,
        "energy_uj_readable": False,
    },
    "core": {
        "energy_uj_exposed": True,
        "energy_uj_readable": False,
    },
}
module._cpu_identity = lambda: {
    "architecture": "x86_64",
    "cpu_vendor": "AuthenticAMD",
    "cpu_model": "Test CPU",
    "logical_cpus": 12,
}
module._read_text = lambda path: "2"

def fake_probe(perf_bin, event):
    assert event == "power/energy-pkg/"
    return {
        "probe_state": "not_supported",
        "measurement_available": False,
    }

module._probe_perf_event = fake_probe

snapshot = module.collect_hardware_snapshot(
    measurement={"perf_scope": "process"},
    perf_bin="perf",
)

assert snapshot["schema_version"] == "1.0"
assert snapshot["measurement"]["backend"] == "perf"
assert snapshot["measurement"]["perf_version"] == "perf version TEST-1.0"
assert snapshot["measurement"]["requested_perf_scope"] == "process"

pkg = snapshot["energy"]["EnergyPkg"]
cores = snapshot["energy"]["EnergyCores"]
ram = snapshot["energy"]["EnergyRAM"]

assert pkg["event_exposed"] is True
assert pkg["probe_state"] == "not_supported"
assert pkg["measurement_available"] is False

assert cores["event_exposed"] is False
assert cores["probe_state"] == "event_not_exposed"
assert cores["measurement_available"] is False

assert ram["event_exposed"] is False
assert ram["probe_state"] == "event_not_exposed"
assert ram["measurement_available"] is False

assert "hardware_supported" not in repr(snapshot)

print("CORE-06C-3 hardware snapshot contract: PASS")
