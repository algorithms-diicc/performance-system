import time
import unittest

from Server.webapp.services import worker_execution_service as service


class FakeRepository:
    def __init__(self):
        self.row = {
            "public_id": "00000000-0000-0000-0000-000000000001",
            "codename": "abcLCS",
        }
        self.heartbeats = 0

    def get_execution_by_codename(self, codename):
        return dict(self.row)

    def touch_heartbeat(self, public_id):
        self.heartbeats += 1
        return {
            "public_id": public_id,
            "execution_state": "RUNNING",
        }


class FakeStateService:
    def __init__(self):
        self.calls = []

    def mark_running(self, public_id):
        self.calls.append(("RUNNING", public_id))
        return {"execution_state": "RUNNING"}

    def mark_processing(self, public_id):
        self.calls.append(("PROCESSING", public_id))
        return {"execution_state": "PROCESSING"}

    def mark_completed(self, public_id, result_path):
        self.calls.append(("COMPLETED", public_id, result_path))
        return {"execution_state": "COMPLETED"}

    def mark_failed(
        self,
        public_id,
        failure_stage,
        error_code,
        error_message,
    ):
        self.calls.append(
            (
                "FAILED",
                public_id,
                failure_stage,
                error_code,
                error_message,
            )
        )
        return {"execution_state": "FAILED"}


class Outcome:
    def __init__(self, kind, failure=None):
        self.kind = kind
        self.failure = failure


class Failure:
    failure_stage = "EXECUTION"
    error_code = "EXECUTION_ERROR"
    message = "boom"


class WorkerHeartbeatTests(unittest.TestCase):
    def tearDown(self):
        for codename in service.active_heartbeat_codenames():
            service.stop_heartbeat_lease(codename)

    def test_start_marks_running_and_immediate_heartbeat(self):
        repo = FakeRepository()
        state = FakeStateService()
        row = service.mark_worker_started(
            "abcLCS",
            repository=repo,
            state_service=state,
        )
        self.assertEqual(row["execution_state"], "RUNNING")
        self.assertEqual(repo.heartbeats, 1)
        self.assertIn("abcLCS", service.active_heartbeat_codenames())

    def test_success_keeps_heartbeat_lease(self):
        repo = FakeRepository()
        state = FakeStateService()
        service.mark_worker_started(
            "abcLCS",
            repository=repo,
            state_service=state,
        )
        service.persist_worker_outcome(
            "abcLCS",
            Outcome("SUCCESS"),
            repository=repo,
            state_service=state,
        )
        self.assertIn("abcLCS", service.active_heartbeat_codenames())
        self.assertIn(
            ("PROCESSING", repo.row["public_id"]),
            state.calls,
        )

    def test_completed_stops_lease(self):
        repo = FakeRepository()
        state = FakeStateService()
        service.mark_worker_started(
            "abcLCS",
            repository=repo,
            state_service=state,
        )
        service.mark_worker_completed(
            "abcLCS",
            "static/x/CombinedResults.csv",
            repository=repo,
            state_service=state,
        )
        self.assertNotIn(
            "abcLCS",
            service.active_heartbeat_codenames(),
        )

    def test_failed_stops_lease(self):
        repo = FakeRepository()
        state = FakeStateService()
        service.mark_worker_started(
            "abcLCS",
            repository=repo,
            state_service=state,
        )
        service.persist_worker_outcome(
            "abcLCS",
            Outcome("FAILED", Failure()),
            repository=repo,
            state_service=state,
        )
        self.assertNotIn(
            "abcLCS",
            service.active_heartbeat_codenames(),
        )

    def test_duplicate_lease_is_rejected(self):
        repo = FakeRepository()
        self.assertTrue(
            service.start_heartbeat_lease(
                "abcLCS",
                repo.row["public_id"],
                repository=repo,
                interval_seconds=10,
            )
        )
        self.assertFalse(
            service.start_heartbeat_lease(
                "abcLCS",
                repo.row["public_id"],
                repository=repo,
                interval_seconds=10,
            )
        )


if __name__ == "__main__":
    unittest.main()
