import unittest
from datetime import datetime, timedelta

from Server.webapp.services import execution_recovery_service as service


class FakeRepository:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.fail_calls = []
        self.fail_result = {"execution_state": "FAILED"}

    def list_stale_executions(self, active_before):
        self.active_before = active_before
        return list(self.rows)

    def fail_execution_if_stale(self, **kwargs):
        self.fail_calls.append(kwargs)
        return self.fail_result


class ExecutionRecoveryServiceTests(unittest.TestCase):
    def test_scan_computes_active_cutoff(self):
        now = datetime(2026, 8, 11, 10, 0, 0)
        repo = FakeRepository()
        service.scan_stale_executions(
            now=now,
            active_stale_seconds=90,
            repository=repo,
        )
        self.assertEqual(
            repo.active_before,
            now - timedelta(seconds=90),
        )

    def test_invalid_threshold_rejected(self):
        with self.assertRaises(ValueError):
            service.scan_stale_executions(
                active_stale_seconds=0,
                repository=FakeRepository(),
            )

    def test_queued_is_not_recoverable_by_age(self):
        self.assertNotIn("QUEUED", service.RECOVERABLE_STATES)
        with self.assertRaises(ValueError):
            service.recovery_descriptor("QUEUED")

    def test_running_descriptor_is_coordinator_heartbeat(self):
        d = service.recovery_descriptor("RUNNING")
        self.assertEqual(
            d["error_code"],
            "COORDINATOR_HEARTBEAT_LOST",
        )

    def test_processing_descriptor(self):
        d = service.recovery_descriptor("PROCESSING")
        self.assertEqual(
            d["error_code"],
            "PROCESSING_HEARTBEAT_LOST",
        )

    def test_terminal_state_descriptor_rejected(self):
        with self.assertRaises(ValueError):
            service.recovery_descriptor("COMPLETED")

    def test_dry_run_does_not_update(self):
        repo = FakeRepository(
            [
                {
                    "id": 1,
                    "public_id": "uuid",
                    "codename": "c",
                    "execution_state": "RUNNING",
                    "state_version": 0,
                    "last_activity_at": None,
                }
            ]
        )
        result = service.recover_stale_executions(
            dry_run=True,
            repository=repo,
        )
        self.assertEqual(len(result["candidates"]), 1)
        self.assertEqual(repo.fail_calls, [])

    def test_apply_uses_atomic_repository_operation(self):
        repo = FakeRepository(
            [
                {
                    "id": 1,
                    "public_id": "uuid",
                    "codename": "c",
                    "execution_state": "RUNNING",
                    "state_version": 2,
                    "last_activity_at": None,
                }
            ]
        )
        result = service.recover_stale_executions(
            dry_run=False,
            repository=repo,
        )
        self.assertEqual(len(repo.fail_calls), 1)
        self.assertEqual(len(result["recovered"]), 1)

    def test_race_is_reported_as_skipped(self):
        repo = FakeRepository(
            [
                {
                    "id": 1,
                    "public_id": "uuid",
                    "codename": "c",
                    "execution_state": "PROCESSING",
                    "state_version": 3,
                    "last_activity_at": None,
                }
            ]
        )
        repo.fail_result = None
        result = service.recover_stale_executions(
            dry_run=False,
            repository=repo,
        )
        self.assertEqual(result["recovered"], [])
        self.assertEqual(len(result["skipped_race"]), 1)


if __name__ == "__main__":
    unittest.main()
