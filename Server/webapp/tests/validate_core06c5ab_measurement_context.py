#!/usr/bin/env python3
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "Server/webapp/services/results_service.py"

source = SERVICE.read_text(encoding="utf-8")
tree = ast.parse(source)

wanted = {
    "_build_measurement_context",
    "_attach_measurement_context",
}

nodes = [
    node
    for node in tree.body
    if isinstance(node, ast.FunctionDef)
    and node.name in wanted
]

assert {node.name for node in nodes} == wanted

module = ast.Module(
    body=nodes,
    type_ignores=[],
)
ast.fix_missing_locations(module)

namespace = {}
exec(
    compile(
        module,
        str(SERVICE),
        "exec",
    ),
    namespace,
)

build = namespace[
    "_build_measurement_context"
]
attach = namespace[
    "_attach_measurement_context"
]

snapshot = {
    "schema_version": "1.0",
    "node": {
        "cpu_vendor": "AuthenticAMD",
        "cpu_model": "AMD Ryzen 5 3600 6-Core Processor",
        "architecture": "x86_64",
        "logical_cpus": 12,
    },
    "measurement": {
        "backend": "perf",
        "perf_version": "perf version 5.15.178",
        "requested_perf_scope": "process",
        "perf_event_paranoid": "2",
    },
    "powercap": {
        "domains": {
            "package-0": {
                "energy_uj_exposed": True,
            }
        }
    },
    "energy": {
        "EnergyPkg": {
            "probe_state": "not_supported",
        }
    },
}

context = build(snapshot)

assert context == {
    "source": "execution.hardware_snapshot",
    "cpu": {
        "vendor": "AuthenticAMD",
        "model": "AMD Ryzen 5 3600 6-Core Processor",
        "architecture": "x86_64",
        "logical_cpus": 12,
    },
    "backend": {
        "name": "perf",
        "version": "perf version 5.15.178",
        "requested_scope": "process",
    },
}

serialized = repr(context)
assert "perf_event_paranoid" not in serialized
assert "powercap" not in serialized
assert "EnergyPkg" not in serialized

metadata = attach(
    {"codename": "demoSIZE"},
    snapshot,
)

assert (
    metadata["measurement_context"]
    == context
)
assert metadata["codename"] == "demoSIZE"

legacy = attach(
    {"codename": "legacyLCS"},
    {},
)
assert "measurement_context" not in legacy

print(
    "CORE-06C-5B sanitized measurement context: PASS"
)
