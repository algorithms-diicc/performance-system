"""Proyección pública y degradable del diagnóstico operacional Admin."""

from collections.abc import Mapping
from datetime import datetime, timedelta
import os
import re

from ..repositories import system_status_repository
from . import measurement_node_service


DATABASE_AVAILABLE = "AVAILABLE"
DATABASE_UNAVAILABLE = "UNAVAILABLE"
DATABASE_UNKNOWN = "UNKNOWN"
LOCK_UNKNOWN = "UNKNOWN"

DEFAULT_RUNTIME = {
    "executionMode": "local",
    "heartbeatSeconds": 10,
    "activeStaleSeconds": 90,
}
DEFAULT_LOCK_KEYS = {
    "dispatcher": 74040102,
    "watchdog": 74040101,
}

TECHNICAL_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:-]+$")


def _empty_queue():
    return {
        "queued": None,
        "running": None,
        "processing": None,
        "oldestQueuedAt": None,
        "staleActive": None,
        "latestCompletedAt": None,
        "latestFailedAt": None,
    }


def _empty_energy_signal():
    return {
        "eventExposed": None,
        "probeState": None,
        "measurementAvailable": None,
    }


def _empty_measurement_environment():
    return {
        "source": "LATEST_PERSISTED_EXECUTION",
        "historical": True,
        "observedAt": None,
        "snapshotSchemaVersion": None,
        "cpuModel": None,
        "architecture": None,
        "logicalCpus": None,
        "perfVersion": None,
        "perfEventParanoid": None,
        "energy": {
            "package": _empty_energy_signal(),
            "cores": _empty_energy_signal(),
            "ram": _empty_energy_signal(),
        },
    }


def _empty_measurement_nodes(status=DATABASE_UNKNOWN):
    return {
        "status": status,
        "items": [],
    }


def _positive_integer(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _signed_bigint(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if -(2 ** 63) <= parsed <= (2 ** 63) - 1:
        return parsed
    return default


def _runtime_configuration(environment):
    execution_mode = str(
        environment.get("EXECUTION_MODE", DEFAULT_RUNTIME["executionMode"])
    ).strip().casefold()
    if execution_mode not in {"local", "remote"}:
        execution_mode = "unknown"

    return {
        "executionMode": execution_mode,
        "heartbeatSeconds": _positive_integer(
            environment.get("EXECUTION_HEARTBEAT_SECONDS"),
            DEFAULT_RUNTIME["heartbeatSeconds"],
        ),
        "activeStaleSeconds": _positive_integer(
            environment.get("RECOVERY_ACTIVE_STALE_SECONDS"),
            DEFAULT_RUNTIME["activeStaleSeconds"],
        ),
    }


def _lock_keys(environment):
    return {
        "dispatcher": _signed_bigint(
            environment.get("EXECUTION_DISPATCHER_LOCK_KEY"),
            DEFAULT_LOCK_KEYS["dispatcher"],
        ),
        "watchdog": _signed_bigint(
            environment.get("RECOVERY_WATCHDOG_LOCK_KEY"),
            DEFAULT_LOCK_KEYS["watchdog"],
        ),
    }


def _timestamp(value):
    if value is None:
        return None
    isoformat = getattr(value, "isoformat", None)
    if not callable(isoformat):
        return None
    return isoformat()


def _count(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


def _safe_text(value, *, token=False, maximum=256):
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    normalized = "".join(character for character in value if character.isprintable())
    normalized = normalized.strip()[:maximum]
    if not normalized:
        return None
    if token and not TECHNICAL_TOKEN_RE.fullmatch(normalized):
        return None
    return normalized


def _optional_bool(value):
    return value if isinstance(value, bool) else None


def _optional_logical_cpus(value):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value


def _nonnegative_number(value):
    if isinstance(value, bool):
        return None
    if not isinstance(value, (int, float)):
        return None
    if value < 0:
        return None
    return value


def _snapshot_row_is_valid(row):
    if not isinstance(row, Mapping):
        return False
    if row.get("snapshot_schema_version") != "1.0":
        return False

    scalar_types = (
        ("cpu_model", str),
        ("architecture", str),
        ("perf_version", str),
        ("perf_event_paranoid", str),
        ("package_probe_state", str),
        ("cores_probe_state", str),
        ("ram_probe_state", str),
    )
    for key, expected_type in scalar_types:
        value = row.get(key)
        if value is not None and not isinstance(value, expected_type):
            return False

    logical_cpus = row.get("logical_cpus")
    if logical_cpus is not None and (
        isinstance(logical_cpus, bool)
        or not isinstance(logical_cpus, int)
        or logical_cpus <= 0
    ):
        return False

    for key in (
        "package_event_exposed",
        "package_measurement_available",
        "cores_event_exposed",
        "cores_measurement_available",
        "ram_event_exposed",
        "ram_measurement_available",
    ):
        value = row.get(key)
        if value is not None and not isinstance(value, bool):
            return False

    return True


def _measurement_environment(row):
    environment = _empty_measurement_environment()
    if not _snapshot_row_is_valid(row):
        return environment

    environment.update(
        {
            "observedAt": _timestamp(row.get("observed_at")),
            "snapshotSchemaVersion": "1.0",
            "cpuModel": _safe_text(row.get("cpu_model")),
            "architecture": _safe_text(
                row.get("architecture"), token=True, maximum=64
            ),
            "logicalCpus": _optional_logical_cpus(
                row.get("logical_cpus")
            ),
            "perfVersion": _safe_text(row.get("perf_version")),
            "perfEventParanoid": _safe_text(
                row.get("perf_event_paranoid"), maximum=64
            ),
        }
    )

    for public_name, row_prefix in (
        ("package", "package"),
        ("cores", "cores"),
        ("ram", "ram"),
    ):
        environment["energy"][public_name] = {
            "eventExposed": _optional_bool(
                row.get("{}_event_exposed".format(row_prefix))
            ),
            "probeState": _safe_text(
                row.get("{}_probe_state".format(row_prefix)),
                token=True,
                maximum=64,
            ),
            "measurementAvailable": _optional_bool(
                row.get("{}_measurement_available".format(row_prefix))
            ),
        }

    return environment


def _measurement_nodes(rows, *, environment, now):
    if rows is None:
        return _empty_measurement_nodes(DATABASE_UNKNOWN)

    if not isinstance(rows, list):
        return _empty_measurement_nodes(DATABASE_UNKNOWN)

    stale_seconds = (
        measurement_node_service.configured_stale_seconds(
            environment
        )
    )

    items = []

    for row in rows:
        if not isinstance(row, Mapping):
            return _empty_measurement_nodes(DATABASE_UNKNOWN)

        for boolean_field in (
            "is_enabled",
            "is_validation_only",
            "is_draining",
            "hardware_profile_is_active",
        ):
            if not isinstance(row.get(boolean_field), bool):
                return _empty_measurement_nodes(DATABASE_UNKNOWN)

        try:
            projected = (
                measurement_node_service.project_measurement_node_status(
                    row,
                    now=now,
                    stale_after_seconds=stale_seconds,
                )
            )
        except Exception:
            return _empty_measurement_nodes(DATABASE_UNKNOWN)

        node_key = _safe_text(
            projected.get("node_key"),
            token=True,
            maximum=64,
        )
        state = projected.get("operational_state")

        if not node_key or state not in {
            measurement_node_service.AVAILABLE,
            measurement_node_service.OFFLINE,
            measurement_node_service.DRAINING,
        }:
            return _empty_measurement_nodes(DATABASE_UNKNOWN)

        items.append(
            {
                "key": node_key,
                "name": _safe_text(
                    projected.get("display_name")
                ),
                "state": state,
                "hardwareProfile": {
                    "key": _safe_text(
                        projected.get(
                            "hardware_profile_key"
                        ),
                        token=True,
                        maximum=128,
                    ),
                    "name": _safe_text(
                        projected.get(
                            "hardware_profile_name"
                        )
                    ),
                },
                "enabled": _optional_bool(
                    projected.get("is_enabled")
                ),
                "validationOnly": _optional_bool(
                    projected.get(
                        "is_validation_only"
                    )
                ),
                "draining": _optional_bool(
                    projected.get("is_draining")
                ),
                "lastHeartbeatAt": _timestamp(
                    projected.get(
                        "last_heartbeat_at"
                    )
                ),
                "heartbeatAgeSeconds": (
                    _nonnegative_number(
                        projected.get(
                            "heartbeat_age_seconds"
                        )
                    )
                ),
            }
        )

    return {
        "status": DATABASE_AVAILABLE,
        "items": items,
    }


def _queue(row):
    return {
        "queued": _count(row.get("queued")),
        "running": _count(row.get("running")),
        "processing": _count(row.get("processing")),
        "oldestQueuedAt": _timestamp(row.get("oldest_queued_at")),
        "staleActive": _count(row.get("stale_active")),
        "latestCompletedAt": _timestamp(row.get("latest_completed_at")),
        "latestFailedAt": _timestamp(row.get("latest_failed_at")),
    }


def _process_signals(signals):
    allowed = {"LOCK_OBSERVED", "LOCK_NOT_OBSERVED", LOCK_UNKNOWN}
    signals = signals if isinstance(signals, Mapping) else {}

    def signal_for(name):
        value = (signals or {}).get(name)
        return value if value in allowed else LOCK_UNKNOWN

    return {
        "dispatcher": {"signal": signal_for("dispatcher")},
        "watchdog": {"signal": signal_for("watchdog")},
    }


def build_system_status(
    *,
    repository=system_status_repository,
    environment=None,
    now=None,
):
    """Construye el contrato público sin propagar detalles de fallos internos."""
    environment = os.environ if environment is None else environment
    checked_at = now or datetime.now().astimezone()
    if checked_at.tzinfo is None:
        checked_at = checked_at.astimezone()

    runtime = _runtime_configuration(environment)
    keys = _lock_keys(environment)
    active_before = checked_at.replace(tzinfo=None) - timedelta(
        seconds=runtime["activeStaleSeconds"]
    )

    database_status = DATABASE_AVAILABLE
    queue = _empty_queue()
    process_signals = _process_signals({})
    measurement_environment = _empty_measurement_environment()
    measurement_nodes = _empty_measurement_nodes()

    try:
        diagnostic = repository.fetch_system_status(
            active_before=active_before,
            dispatcher_lock_key=keys["dispatcher"],
            watchdog_lock_key=keys["watchdog"],
        )
    except system_status_repository.DatabaseUnavailable:
        database_status = DATABASE_UNAVAILABLE
        measurement_nodes = _empty_measurement_nodes(
            DATABASE_UNAVAILABLE
        )
    except system_status_repository.DiagnosticQueryUnavailable:
        database_status = DATABASE_UNKNOWN
    except Exception:
        database_status = DATABASE_UNKNOWN
    else:
        if not isinstance(diagnostic, Mapping):
            database_status = DATABASE_UNKNOWN
        else:
            row = diagnostic.get("operational")
            if not isinstance(row, Mapping):
                database_status = DATABASE_UNKNOWN
            else:
                queue = _queue(row)
                process_signals = _process_signals(
                    diagnostic.get("lock_signals")
                )
                measurement_environment = _measurement_environment(row)
                measurement_nodes = _measurement_nodes(
                    diagnostic.get("measurement_nodes"),
                    environment=environment,
                    now=checked_at.replace(tzinfo=None),
                )

    return {
        "checkedAt": checked_at.isoformat(),
        "backend": {"status": DATABASE_AVAILABLE},
        "database": {"status": database_status},
        "queue": queue,
        "runtime": runtime,
        "processSignals": process_signals,
        "measurementNodes": measurement_nodes,
        "measurementEnvironment": measurement_environment,
    }
