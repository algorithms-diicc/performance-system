import unittest

from Server.webapp.services.execution_pipeline_service import (
    LegacyOutcome,
    FailureDescriptor,
)
from Server.webapp.services.worker_execution_service import (
    PersistentExecutionMissing,
    UnexpectedWorkerOutcome,
    get_execution_context,
    mark_processing_failed,
    mark_worker_completed,
    mark_worker_failed,
    mark_worker_started,
    persist_worker_outcome,
)


class FakeRepository:
    def __init__(self, row=None):
        self.row = row
        self.heartbeat_calls = []

    def get_execution_by_codename(self, codename):
        return self.row

    def touch_heartbeat(self, public_id):
        self.heartbeat_calls.append(public_id)
        return True


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
        error_message=None,
    ):
        self.calls.append((
            "FAILED",
            public_id,
            failure_stage,
            error_code,
            error_message,
        ))
        return {"execution_state": "FAILED"}


class WorkerExecutionServiceTests(unittest.TestCase):
    def setUp(self):
        self.row = {
            "public_id": "11111111-1111-1111-1111-111111111111",
            "codename": "abcLCS",
            "execution_state": "QUEUED",
        }
        self.repo = FakeRepository(self.row)
        self.state = FakeStateService()

    def test_resolve_execution_by_codename(self):
        row = get_execution_context("abcLCS", repository=self.repo)
        self.assertEqual(row["public_id"], self.row["public_id"])

    def test_missing_execution_is_explicit(self):
        with self.assertRaises(PersistentExecutionMissing):
            get_execution_context(
                "missingLCS",
                repository=FakeRepository(None),
            )

    def test_worker_started_marks_running(self):
        mark_worker_started(
            "abcLCS",
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls,
            [("RUNNING", self.row["public_id"])],
        )
        self.assertEqual(
            self.repo.heartbeat_calls,
            [self.row["public_id"]],
        )

    def test_success_outcome_marks_processing(self):
        persist_worker_outcome(
            "abcLCS",
            LegacyOutcome("SUCCESS", "DONE"),
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls,
            [("PROCESSING", self.row["public_id"])],
        )

    def test_failure_outcome_preserves_metadata(self):
        failure = FailureDescriptor(
            "COMPILATION",
            "COMPILE_ERROR",
            "No compila",
        )
        persist_worker_outcome(
            "abcLCS",
            LegacyOutcome(
                "FAILED",
                "ERROR: compilación",
                worker_error_code=100,
                failure=failure,
            ),
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls[0][:4],
            (
                "FAILED",
                self.row["public_id"],
                "COMPILATION",
                "COMPILE_ERROR",
            ),
        )

    def test_pending_outcome_cannot_advance(self):
        with self.assertRaises(UnexpectedWorkerOutcome):
            persist_worker_outcome(
                "abcLCS",
                LegacyOutcome("PENDING", "IN QUEUE"),
                repository=self.repo,
                state_service=self.state,
            )

    def test_infrastructure_failure_is_explicit(self):
        mark_worker_failed(
            "abcLCS",
            "INFRASTRUCTURE",
            "MASTER_SLAVE_ERROR",
            "socket failed",
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls[0][2:4],
            ("INFRASTRUCTURE", "MASTER_SLAVE_ERROR"),
        )

    def test_processing_failure_uses_processing_stage(self):
        mark_processing_failed(
            "abcLCS",
            "GRAPH_PROCESSING_ERROR",
            "boom",
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls[0][2:4],
            ("PROCESSING", "GRAPH_PROCESSING_ERROR"),
        )

    def test_completed_persists_result_path(self):
        result_path = "webapp/static/abcLCS/CombinedResults.csv"
        mark_worker_completed(
            "abcLCS",
            result_path,
            repository=self.repo,
            state_service=self.state,
        )
        self.assertEqual(
            self.state.calls[0],
            ("COMPLETED", self.row["public_id"], result_path),
        )


if __name__ == "__main__":
    unittest.main()
