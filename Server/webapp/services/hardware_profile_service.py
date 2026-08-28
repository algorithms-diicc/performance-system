import os
import json
import re

from ..repositories import hardware_profile_repository


PROFILE_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


class HardwareProfileError(ValueError):
    """El snapshot no puede convertirse en un HardwareProfile válido."""


def normalize_profile_key(value):
    profile_key = str(value or "").strip()

    if not PROFILE_KEY_RE.fullmatch(profile_key):
        raise HardwareProfileError(
            "profile_key must match [a-z0-9][a-z0-9_-]{0,63}."
        )

    return profile_key


def _optional_positive_int(value, field):
    if value in (None, ""):
        return None

    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise HardwareProfileError(
            "{} must be a positive integer when provided.".format(field)
        )

    if parsed <= 0:
        raise HardwareProfileError(
            "{} must be a positive integer when provided.".format(field)
        )

    return parsed


def _json_object(value):
    if not isinstance(value, dict):
        return {}
    return value


def build_profile_capabilities(hardware_snapshot):
    """
    Extrae únicamente evidencia operacional útil para HardwareProfile.

    No copia identidad de Execution ni asignación de MeasurementNode.
    Tampoco calcula scores de CPU ni infiere complejidad algorítmica.
    """
    snapshot = _json_object(hardware_snapshot)

    measurement = _json_object(snapshot.get("measurement"))
    energy = _json_object(snapshot.get("energy"))
    powercap = _json_object(snapshot.get("powercap"))
    toolchain = _json_object(snapshot.get("toolchain"))

    capabilities = {
        "snapshot_schema_version": snapshot.get("schema_version"),
        "measurement": {
            "backend": measurement.get("backend"),
            "perf_version": measurement.get("perf_version"),
            "perf_event_paranoid": measurement.get(
                "perf_event_paranoid"
            ),
        },
        "energy": {},
        "powercap": {
            "domains": _json_object(powercap.get("domains")),
        },
        "toolchain": toolchain,
    }

    for metric_name, metric_data in energy.items():
        if not isinstance(metric_data, dict):
            continue

        capabilities["energy"][metric_name] = {
            "event": metric_data.get("event"),
            "event_exposed": bool(
                metric_data.get("event_exposed", False)
            ),
            "measurement_available": bool(
                metric_data.get("measurement_available", False)
            ),
            "probe_state": metric_data.get("probe_state"),
        }

    return capabilities


def build_hardware_profile(
    profile_key,
    name,
    hardware_snapshot,
    *,
    ram_gb=None,
    description=None,
    is_active=True,
):
    """
    Construye el contrato persistible de HardwareProfile desde evidencia.

    HardwareProfile:
        identidad/capacidades operacionales relativamente estables.

    hardware_snapshot:
        evidencia concreta observada durante/proveniente del nodo.

    MeasurementNode:
        máquina física; se registra en otro gate.
    """
    profile_key = normalize_profile_key(profile_key)

    name = str(name or "").strip()
    if not name:
        raise HardwareProfileError("name is required.")

    snapshot = _json_object(hardware_snapshot)
    node = _json_object(snapshot.get("node"))

    cpu_vendor = node.get("cpu_vendor")
    cpu_model = node.get("cpu_model")
    architecture = node.get("architecture")
    logical_cpus = _optional_positive_int(
        node.get("logical_cpus"),
        "logical_cpus",
    )
    ram_gb = _optional_positive_int(ram_gb, "ram_gb")

    if not architecture:
        raise HardwareProfileError(
            "hardware_snapshot.node.architecture is required."
        )

    if not cpu_model:
        raise HardwareProfileError(
            "hardware_snapshot.node.cpu_model is required."
        )

    capabilities = build_profile_capabilities(snapshot)

    # Garantiza serialización JSON antes de llegar al repository.
    capabilities_json = json.dumps(
        capabilities,
        sort_keys=True,
        separators=(",", ":"),
    )

    return {
        "profile_key": profile_key,
        "name": name,
        "cpu_vendor": cpu_vendor,
        "cpu_model": cpu_model,
        "architecture": architecture,
        "logical_cpus": logical_cpus,
        "ram_gb": ram_gb,
        "capabilities": capabilities_json,
        "description": (
            str(description).strip()
            if description is not None
            else None
        ),
        "is_active": bool(is_active),
    }


def register_hardware_profile(
    profile_key,
    name,
    hardware_snapshot,
    *,
    ram_gb=None,
    description=None,
    is_active=True,
    conn=None,
):
    profile = build_hardware_profile(
        profile_key,
        name,
        hardware_snapshot,
        ram_gb=ram_gb,
        description=description,
        is_active=is_active,
    )

    return hardware_profile_repository.upsert_hardware_profile(
        **profile,
        conn=conn,
    )


POLICY_BENCHMARK_BY_BENCHMARK = {
    "LCS": "LCS",
    "CAMM": "CAMM",
    "CAMMR": "CAMM",
    "CAMMS": "CAMM",
    "CAMMSO": "CAMM",
    "SIZE": "SIZE",
}

POLICY_EXECUTION_PROFILES = frozenset({
    "QUICK",
    "BALANCED",
    "EXHAUSTIVE",
    "CUSTOM",
})


def normalize_policy_benchmark(value):
    """
    Convierte el benchmark real en su familia de política.

    CAMM, CAMMR, CAMMS y CAMMSO comparten familia operacional CAMM,
    pero la Execution conserva siempre su benchmark real.
    """
    benchmark = str(value or "").strip().upper()

    try:
        return POLICY_BENCHMARK_BY_BENCHMARK[benchmark]
    except KeyError:
        raise HardwareProfileError(
            "Unsupported benchmark for hardware policy: {!r}.".format(
                value
            )
        )


def normalize_policy_execution_profile(value):
    execution_profile = str(value or "").strip().upper()

    if execution_profile not in POLICY_EXECUTION_PROFILES:
        raise HardwareProfileError(
            "Unsupported execution_profile for hardware policy: "
            "{!r}.".format(value)
        )

    return execution_profile


def _required_positive_int(value, field):
    parsed = _optional_positive_int(value, field)

    if parsed is None:
        raise HardwareProfileError(
            "{} is required.".format(field)
        )

    return parsed


def build_hardware_profile_policy(
    hardware_profile_id,
    benchmark,
    execution_profile,
    *,
    minimum_input,
    default_input,
    recommended_max_input,
    hard_max_input,
    input_step,
    operational_timeout_seconds,
    is_active=True,
):
    """
    Valida el contrato de una política operacional.

    Los valores concretos deben provenir de calibración/decisión
    operacional; esta función no calcula límites ni CPU scores.
    """
    hardware_profile_id = _required_positive_int(
        hardware_profile_id,
        "hardware_profile_id",
    )

    benchmark = normalize_policy_benchmark(benchmark)
    execution_profile = normalize_policy_execution_profile(
        execution_profile
    )

    minimum_input = _required_positive_int(
        minimum_input,
        "minimum_input",
    )
    default_input = _required_positive_int(
        default_input,
        "default_input",
    )
    recommended_max_input = _required_positive_int(
        recommended_max_input,
        "recommended_max_input",
    )
    hard_max_input = _required_positive_int(
        hard_max_input,
        "hard_max_input",
    )
    input_step = _required_positive_int(
        input_step,
        "input_step",
    )
    operational_timeout_seconds = _required_positive_int(
        operational_timeout_seconds,
        "operational_timeout_seconds",
    )

    if not (
        minimum_input
        <= default_input
        <= recommended_max_input
        <= hard_max_input
    ):
        raise HardwareProfileError(
            "Hardware policy limits must satisfy "
            "minimum_input <= default_input <= "
            "recommended_max_input <= hard_max_input."
        )

    return {
        "hardware_profile_id": hardware_profile_id,
        "benchmark": benchmark,
        "execution_profile": execution_profile,
        "minimum_input": minimum_input,
        "default_input": default_input,
        "recommended_max_input": recommended_max_input,
        "hard_max_input": hard_max_input,
        "input_step": input_step,
        "operational_timeout_seconds":
            operational_timeout_seconds,
        "is_active": bool(is_active),
    }


def register_hardware_profile_policy(
    hardware_profile_id,
    benchmark,
    execution_profile,
    *,
    minimum_input,
    default_input,
    recommended_max_input,
    hard_max_input,
    input_step,
    operational_timeout_seconds,
    is_active=True,
    conn=None,
):
    policy = build_hardware_profile_policy(
        hardware_profile_id,
        benchmark,
        execution_profile,
        minimum_input=minimum_input,
        default_input=default_input,
        recommended_max_input=recommended_max_input,
        hard_max_input=hard_max_input,
        input_step=input_step,
        operational_timeout_seconds=
            operational_timeout_seconds,
        is_active=is_active,
    )

    return (
        hardware_profile_repository
        .upsert_hardware_profile_policy(
            **policy,
            conn=conn,
        )
    )


def resolve_hardware_profile_policy(
    profile_key,
    benchmark,
    execution_profile,
    conn=None,
):
    """
    Resuelve una política activa usando únicamente identificadores
    operacionales conocidos.

    benchmark puede ser CAMM/CAMMR/CAMMS/CAMMSO; las variantes se
    normalizan a la familia CAMM antes de consultar PostgreSQL.
    """
    profile_key = normalize_profile_key(profile_key)
    benchmark = normalize_policy_benchmark(benchmark)
    execution_profile = normalize_policy_execution_profile(
        execution_profile
    )

    row = (
        hardware_profile_repository
        .get_active_hardware_profile_policy(
            profile_key,
            benchmark,
            execution_profile,
            conn=conn,
        )
    )

    if row is None:
        raise HardwareProfileError(
            "No active hardware policy for "
            "profile_key={!r}, benchmark={!r}, "
            "execution_profile={!r}.".format(
                profile_key,
                benchmark,
                execution_profile,
            )
        )

    return dict(row)


def list_hardware_profile_policies(
    profile_key,
    conn=None,
):
    """
    Devuelve las políticas activas del perfil solicitado.
    """
    profile_key = normalize_profile_key(profile_key)

    rows = (
        hardware_profile_repository
        .list_active_hardware_profile_policies(
            profile_key,
            conn=conn,
        )
    )

    if not rows:
        raise HardwareProfileError(
            "No active hardware policies for "
            "profile_key={!r}.".format(profile_key)
        )

    return [dict(row) for row in rows]

MEASUREMENT_HARDWARE_PROFILE_KEY_ENV = (
    "MEASUREMENT_HARDWARE_PROFILE_KEY"
)

DEFAULT_MEASUREMENT_HARDWARE_PROFILE_KEY = (
    "shenu-intel-i5-9400"
)


def configured_measurement_profile_key():
    """
    Perfil operacional transitorio de la instalación.

    Gate 6+ sustituirá esta resolución estática por MeasurementNode +
    selección multinodo. El cliente nunca decide este identificador.
    """
    value = str(
        os.getenv(
            MEASUREMENT_HARDWARE_PROFILE_KEY_ENV,
            DEFAULT_MEASUREMENT_HARDWARE_PROFILE_KEY,
        )
        or ""
    ).strip()

    return (
        value
        or DEFAULT_MEASUREMENT_HARDWARE_PROFILE_KEY
    )
