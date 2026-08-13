#!/usr/bin/env python3
"""
CORE-06C-5C — fixtures contractuales Intel/AMD.

IMPORTANTE:
Estos fixtures prueban el contrato lógico del sistema.
NO constituyen validación física de un procesador Intel o AMD real.
"""

import ast
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

HARDWARE_MODULE = ROOT / "Server/hardware_snapshot.py"
RESULTS_SERVICE = ROOT / "Server/webapp/services/results_service.py"


def load_hardware_module():
    spec = importlib.util.spec_from_file_location(
        "hardware_snapshot_core06c5c",
        HARDWARE_MODULE,
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_results_helpers():
    source = RESULTS_SERVICE.read_text(encoding="utf-8")
    tree = ast.parse(source)

    wanted = {
        "_build_measurement_context",
        "_attach_measurement_context",
        "_metric_hardware_context",
    }

    nodes = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name in wanted
    ]

    found = {node.name for node in nodes}
    assert found == wanted, (
        "Helpers results_service faltantes: "
        + repr(wanted - found)
    )

    module = ast.Module(
        body=nodes,
        type_ignores=[],
    )
    ast.fix_missing_locations(module)

    namespace = {}
    exec(
        compile(
            module,
            str(RESULTS_SERVICE),
            "exec",
        ),
        namespace,
    )
    return namespace


def make_snapshot(
    *,
    vendor,
    model,
    perf_list_text,
    probe_by_event,
    perf_version="perf version fixture",
):
    module = load_hardware_module()

    module._cpu_identity = lambda: {
        "architecture": "x86_64",
        "cpu_vendor": vendor,
        "cpu_model": model,
        "logical_cpus": 8,
    }

    module._perf_list = lambda perf_bin: perf_list_text
    module._perf_version = lambda perf_bin: perf_version
    module._powercap_domains = lambda: {}
    module._read_text = lambda path: (
        "2"
        if path == "/proc/sys/kernel/perf_event_paranoid"
        else None
    )

    def fake_probe(perf_bin, event):
        return dict(
            probe_by_event.get(
                event,
                {
                    "probe_state": "backend_error",
                    "measurement_available": False,
                },
            )
        )

    module._probe_perf_event = fake_probe

    return module.collect_hardware_snapshot(
        measurement={
            "perf_scope": "process",
        },
        perf_bin="perf",
    )


def assert_energy(
    snapshot,
    metric,
    *,
    exposed,
    state,
    available,
):
    actual = snapshot["energy"][metric]

    assert actual["event_exposed"] is exposed, (
        metric,
        actual,
    )
    assert actual["probe_state"] == state, (
        metric,
        actual,
    )
    assert actual["measurement_available"] is available, (
        metric,
        actual,
    )


def main():
    results = load_results_helpers()

    build_context = results[
        "_build_measurement_context"
    ]
    metric_context = results[
        "_metric_hardware_context"
    ]

    # --------------------------------------------------------
    # FIXTURE 1 — AMD similar al nodo local observado.
    # Sólo energy-pkg aparece en perf list y el probe responde
    # not_supported.
    # --------------------------------------------------------
    amd_observed = make_snapshot(
        vendor="AuthenticAMD",
        model="AMD fixture observed",
        perf_list_text=(
            "power/energy-pkg/ [Kernel PMU event]"
        ),
        probe_by_event={
            "power/energy-pkg/": {
                "probe_state": "not_supported",
                "measurement_available": False,
            },
        },
    )

    assert_energy(
        amd_observed,
        "EnergyPkg",
        exposed=True,
        state="not_supported",
        available=False,
    )
    assert_energy(
        amd_observed,
        "EnergyCores",
        exposed=False,
        state="event_not_exposed",
        available=False,
    )
    assert_energy(
        amd_observed,
        "EnergyRAM",
        exposed=False,
        state="event_not_exposed",
        available=False,
    )

    # --------------------------------------------------------
    # FIXTURE 2 — AMD sintético con eventos medibles.
    # Prueba explícita de que vendor AMD NO fuerza N/A.
    # --------------------------------------------------------
    all_events = "\n".join([
        "power/energy-pkg/ [Kernel PMU event]",
        "power/energy-cores/ [Kernel PMU event]",
        "power/energy-ram/ [Kernel PMU event]",
    ])

    numeric_probes = {
        "power/energy-pkg/": {
            "probe_state": "numeric",
            "measurement_available": True,
        },
        "power/energy-cores/": {
            "probe_state": "numeric",
            "measurement_available": True,
        },
        "power/energy-ram/": {
            "probe_state": "numeric",
            "measurement_available": True,
        },
    }

    amd_numeric = make_snapshot(
        vendor="AuthenticAMD",
        model="AMD fixture numeric",
        perf_list_text=all_events,
        probe_by_event=numeric_probes,
    )

    for metric in (
        "EnergyPkg",
        "EnergyCores",
        "EnergyRAM",
    ):
        assert_energy(
            amd_numeric,
            metric,
            exposed=True,
            state="numeric",
            available=True,
        )

    # --------------------------------------------------------
    # FIXTURE 3 — Intel sintético parcial.
    # Prueba explícita de que vendor Intel NO fuerza disponibilidad.
    # --------------------------------------------------------
    intel_partial = make_snapshot(
        vendor="GenuineIntel",
        model="Intel fixture partial",
        perf_list_text=(
            "power/energy-pkg/ [Kernel PMU event]"
        ),
        probe_by_event={
            "power/energy-pkg/": {
                "probe_state": "not_counted",
                "measurement_available": False,
            },
        },
    )

    assert_energy(
        intel_partial,
        "EnergyPkg",
        exposed=True,
        state="not_counted",
        available=False,
    )
    assert_energy(
        intel_partial,
        "EnergyCores",
        exposed=False,
        state="event_not_exposed",
        available=False,
    )
    assert_energy(
        intel_partial,
        "EnergyRAM",
        exposed=False,
        state="event_not_exposed",
        available=False,
    )

    # --------------------------------------------------------
    # FIXTURE 4 — Intel sintético con los tres eventos numéricos.
    # Contrato positivo, sin afirmar que todo Intel real sea así.
    # --------------------------------------------------------
    intel_numeric = make_snapshot(
        vendor="GenuineIntel",
        model="Intel fixture numeric",
        perf_list_text=all_events,
        probe_by_event=numeric_probes,
    )

    for metric in (
        "EnergyPkg",
        "EnergyCores",
        "EnergyRAM",
    ):
        assert_energy(
            intel_numeric,
            metric,
            exposed=True,
            state="numeric",
            available=True,
        )

    # --------------------------------------------------------
    # Results API contract.
    # Vendor/model sólo aparecen como contexto descriptivo.
    # --------------------------------------------------------
    amd_measurement_context = build_context(
        amd_observed
    )

    assert (
        amd_measurement_context["cpu"]["vendor"]
        == "AuthenticAMD"
    )
    assert (
        amd_measurement_context["backend"]["name"]
        == "perf"
    )
    assert (
        amd_measurement_context["backend"]["requested_scope"]
        == "process"
    )

    intel_measurement_context = build_context(
        intel_partial
    )

    assert (
        intel_measurement_context["cpu"]["vendor"]
        == "GenuineIntel"
    )

    # El contexto de métrica refleja la observación, no una inferencia.
    amd_pkg_context = metric_context(
        "EnergyPkg",
        amd_observed,
    )
    intel_pkg_context = metric_context(
        "EnergyPkg",
        intel_partial,
    )

    assert (
        amd_pkg_context["probe_state"]
        == "not_supported"
    )
    assert (
        intel_pkg_context["probe_state"]
        == "not_counted"
    )

    # Métricas no energéticas no reciben contexto energético.
    assert (
        metric_context(
            "Instructions",
            intel_numeric,
        )
        is None
    )

    # Nunca se introduce una bandera causal inventada.
    for snapshot in (
        amd_observed,
        amd_numeric,
        intel_partial,
        intel_numeric,
    ):
        assert (
            "hardware_supported"
            not in repr(snapshot)
        )

    print("AMD observed fixture: PASS")
    print("AMD numeric fixture: PASS")
    print("Intel partial fixture: PASS")
    print("Intel numeric fixture: PASS")
    print("vendor-agnostic availability contract: PASS")
    print("Results API context contract: PASS")
    print("")
    print("CORE-06C-5C hardware contract fixtures: PASS")


if __name__ == "__main__":
    main()
