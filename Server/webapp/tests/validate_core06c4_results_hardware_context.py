#!/usr/bin/env python3
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "Server/webapp/services/results_service.py"

source = SERVICE.read_text(encoding="utf-8")
tree = ast.parse(source)

nodes = [
    node for node in tree.body
    if isinstance(node, ast.FunctionDef)
    and node.name == "_metric_hardware_context"
]
assert len(nodes) == 1

module = ast.Module(body=[nodes[0]], type_ignores=[])
ast.fix_missing_locations(module)

namespace = {}
exec(compile(module, str(SERVICE), "exec"), namespace)
helper = namespace["_metric_hardware_context"]

snapshot = {
    "schema_version": "1.0",
    "energy": {
        "EnergyPkg": {
            "event": "power/energy-pkg/",
            "event_exposed": True,
            "probe_state": "not_supported",
            "measurement_available": False,
        },
        "EnergyCores": {
            "event": "power/energy-cores/",
            "event_exposed": False,
            "probe_state": "event_not_exposed",
            "measurement_available": False,
        },
        "EnergyRAM": {
            "event": "power/energy-ram/",
            "event_exposed": False,
            "probe_state": "event_not_exposed",
            "measurement_available": False,
        },
    },
}

pkg = helper("EnergyPkg", snapshot)
assert pkg == {
    "source": "execution.hardware_snapshot",
    "event": "power/energy-pkg/",
    "event_exposed": True,
    "probe_state": "not_supported",
    "measurement_available": False,
}

assert helper("EnergyCores", snapshot)["event_exposed"] is False
assert helper("Instructions", snapshot) is None
assert helper("EnergyPkg", {}) is None

print("CORE-06C-4 hardware context helper: PASS")
