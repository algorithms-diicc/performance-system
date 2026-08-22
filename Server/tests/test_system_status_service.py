import json
import unittest
from datetime import datetime, timedelta, timezone

from Server.webapp.repositories import system_status_repository
from Server.webapp.services import system_status_service as service


class FakeRepository:
    DatabaseUnavailable = system_status_repository.DatabaseUnavailable
    DiagnosticQueryUnavailable = (
        system_status_repository.DiagnosticQueryUnavailable
    )

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def fetch_system_status(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.result


def valid_operational_row(**overrides):
    row = {
        "queued": 4,
        "running": 1,
        "processing": 2,
        "oldest_queued_at": datetime(2026, 8, 22, 9, 15, 30),
        "stale_active": 1,
        "latest_completed_at": datetime(2026, 8, 22, 10, 20, 30),
        "latest_failed_at": datetime(2026, 8, 22, 11, 25, 35),
        "observed_at": datetime(2026, 8, 22, 11, 30, 40),
        "snapshot_schema_version": "1.0",
        "cpu_model": "AMD EPYC 7763",
        "architecture": "x86_64",
        "logical_cpus": 16,
        "perf_version": "perf version 6.8.0",
        "perf_event_paranoid": "2",
        "package_event_exposed": True,
        "package_probe_state": "numeric",
        "package_measurement_available": True,
        "cores_event_exposed": True,
        "cores_probe_state": "permission_denied",
        "cores_measurement_available": False,
        "ram_event_exposed": False,
        "ram_probe_state": "event_not_exposed",
        "ram_measurement_available": False,
    }
    row.update(overrides)
    return row


def diagnostic(row=None, locks=None):
    return {
        "operational": row or valid_operational_row(),
        "lock_signals": locks
        or {
            "dispatcher": "LOCK_OBSERVED",
            "watchdog": "LOCK_NOT_OBSERVED",
        },
    }


class SystemStatusServiceTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(
            2026,
            8,
            22,
            13,
            30,
            tzinfo=timezone(timedelta(hours=-4)),
        )
        self.environment = {
            "EXECUTION_MODE": "remote",
            "EXECUTION_HEARTBEAT_SECONDS": "12",
            "RECOVERY_ACTIVE_STALE_SECONDS": "120",
            "EXECUTION_DISPATCHER_LOCK_KEY": "-7",
            "RECOVERY_WATCHDOG_LOCK_KEY": "9",
            "DB_PASSWORD": "must-not-leak",
        }

    def test_available_contract_serializes_db_timestamps_without_inventing_utc(self):
        repository = FakeRepository(result=diagnostic())

        payload = service.build_system_status(
            repository=repository,
            environment=self.environment,
            now=self.now,
        )

        self.assertEqual(payload["checkedAt"], "2026-08-22T13:30:00-04:00")
        self.assertEqual(payload["backend"], {"status": "AVAILABLE"})
        self.assertEqual(payload["database"], {"status": "AVAILABLE"})
        self.assertEqual(payload["queue"]["queued"], 4)
        self.assertEqual(
            payload["queue"]["oldestQueuedAt"], "2026-08-22T09:15:30"
        )
        self.assertFalse(payload["queue"]["oldestQueuedAt"].endswith("Z"))
        self.assertEqual(
            repository.calls[0]["active_before"],
            datetime(2026, 8, 22, 13, 28),
        )

    def test_runtime_is_observed_safely_and_lock_keys_never_leave_service(self):
        repository = FakeRepository(result=diagnostic())

        payload = service.build_system_status(
            repository=repository,
            environment=self.environment,
            now=self.now,
        )

        self.assertEqual(
            payload["runtime"],
            {
                "executionMode": "remote",
                "heartbeatSeconds": 12,
                "activeStaleSeconds": 120,
            },
        )
        self.assertEqual(repository.calls[0]["dispatcher_lock_key"], -7)
        self.assertEqual(repository.calls[0]["watchdog_lock_key"], 9)
        serialized = json.dumps(payload)
        self.assertNotIn("must-not-leak", serialized)
        self.assertNotIn("lock_key", serialized.casefold())
        self.assertNotIn('"-7"', serialized)

    def test_connection_failure_is_unavailable_with_null_diagnostics(self):
        payload = service.build_system_status(
            repository=FakeRepository(
                error=system_status_repository.DatabaseUnavailable()
            ),
            environment={},
            now=self.now,
        )

        self.assertEqual(payload["database"]["status"], "UNAVAILABLE")
        self.assertTrue(all(value is None for value in payload["queue"].values()))
        self.assertEqual(
            payload["processSignals"],
            {
                "dispatcher": {"signal": "UNKNOWN"},
                "watchdog": {"signal": "UNKNOWN"},
            },
        )
        self.assertIsNone(payload["measurementEnvironment"]["observedAt"])

    def test_main_query_failure_is_unknown_not_unavailable(self):
        payload = service.build_system_status(
            repository=FakeRepository(
                error=system_status_repository.DiagnosticQueryUnavailable()
            ),
            environment={},
            now=self.now,
        )

        self.assertEqual(payload["database"]["status"], "UNKNOWN")
        self.assertIsNone(payload["queue"]["staleActive"])

    def test_malformed_repository_result_degrades_to_unknown(self):
        payload = service.build_system_status(
            repository=FakeRepository(result=None),
            environment={},
            now=self.now,
        )

        self.assertEqual(payload["database"]["status"], "UNKNOWN")
        self.assertIsNone(payload["queue"]["queued"])
        self.assertEqual(
            payload["processSignals"]["watchdog"]["signal"], "UNKNOWN"
        )

    def test_lock_query_failure_does_not_degrade_available_database(self):
        payload = service.build_system_status(
            repository=FakeRepository(
                result=diagnostic(
                    locks={"dispatcher": "UNKNOWN", "watchdog": "UNKNOWN"}
                )
            ),
            environment={},
            now=self.now,
        )

        self.assertEqual(payload["database"]["status"], "AVAILABLE")
        self.assertEqual(
            payload["processSignals"]["dispatcher"]["signal"], "UNKNOWN"
        )

    def test_valid_snapshot_uses_strict_public_whitelist_and_energy_mapping(self):
        row = valid_operational_row()
        row.update(
            {
                "hostname": "private-host",
                "event": "power/energy-pkg/",
                "env": {"HOME": "/private/home"},
            }
        )
        payload = service.build_system_status(
            repository=FakeRepository(result=diagnostic(row=row)),
            environment={},
            now=self.now,
        )

        measurement = payload["measurementEnvironment"]
        self.assertTrue(measurement["historical"])
        self.assertEqual(measurement["source"], "LATEST_PERSISTED_EXECUTION")
        self.assertEqual(measurement["snapshotSchemaVersion"], "1.0")
        self.assertEqual(measurement["cpuModel"], "AMD EPYC 7763")
        self.assertEqual(measurement["logicalCpus"], 16)
        self.assertEqual(
            measurement["energy"]["package"],
            {
                "eventExposed": True,
                "probeState": "numeric",
                "measurementAvailable": True,
            },
        )
        serialized = json.dumps(payload)
        for forbidden in ("private-host", "/private/home", "energy-pkg"):
            self.assertNotIn(forbidden, serialized)

    def test_legacy_or_malformed_snapshot_is_ignored_completely(self):
        rows = (
            valid_operational_row(snapshot_schema_version="0.9"),
            valid_operational_row(logical_cpus="sixteen"),
            valid_operational_row(package_event_exposed="yes"),
        )

        for row in rows:
            with self.subTest(row=row):
                payload = service.build_system_status(
                    repository=FakeRepository(result=diagnostic(row=row)),
                    environment={},
                    now=self.now,
                )
                measurement = payload["measurementEnvironment"]
                self.assertIsNone(measurement["snapshotSchemaVersion"])
                self.assertIsNone(measurement["cpuModel"])
                self.assertIsNone(measurement["energy"]["package"]["probeState"])

    def test_invalid_runtime_and_unknown_lock_values_are_sanitized(self):
        payload = service.build_system_status(
            repository=FakeRepository(
                result=diagnostic(
                    locks={
                        "dispatcher": "HEALTHY",
                        "watchdog": "ONLINE",
                    }
                )
            ),
            environment={
                "EXECUTION_MODE": "remote;password=private",
                "EXECUTION_HEARTBEAT_SECONDS": "0",
                "RECOVERY_ACTIVE_STALE_SECONDS": "not-a-number",
            },
            now=self.now,
        )

        self.assertEqual(payload["runtime"]["executionMode"], "unknown")
        self.assertEqual(payload["runtime"]["heartbeatSeconds"], 10)
        self.assertEqual(payload["runtime"]["activeStaleSeconds"], 90)
        self.assertEqual(
            payload["processSignals"]["dispatcher"]["signal"], "UNKNOWN"
        )
        self.assertNotIn("private", json.dumps(payload))


if __name__ == "__main__":
    unittest.main()
