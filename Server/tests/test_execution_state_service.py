import unittest

from Server.webapp.services.execution_state_service import (
    CANCELLED,
    COMPLETED,
    FAILED,
    PROCESSING,
    QUEUED,
    RUNNING,
    InvalidCompletionMetadata,
    InvalidExecutionTransition,
    InvalidFailureMetadata,
    can_transition,
    mark_cancelled,
    mark_completed,
    mark_failed,
    mark_processing,
    mark_running,
)


class FakeRepository:
    def __init__(self, state=QUEUED, version=0):
        self.row = {
            "public_id": "11111111-1111-1111-1111-111111111111",
            "execution_state": state,
            "state_version": version,
            "result_available": False,
            "result_path": None,
        }

    def get_execution(self, public_id, conn=None):
        return dict(self.row)

    def transition_execution(
        self,
        public_id,
        expected_state,
        expected_version,
        new_state,
        failure_stage=None,
        error_code=None,
        error_message=None,
        result_available=None,
        result_path=None,
        conn=None,
    ):
        if self.row["execution_state"] != expected_state:
            raise AssertionError("unexpected expected_state")
        if self.row["state_version"] != expected_version:
            raise AssertionError("unexpected expected_version")

        self.row.update({
            "execution_state": new_state,
            "failure_stage": failure_stage,
            "error_code": error_code,
            "error_message": error_message,
            "state_version": expected_version + 1,
        })

        if result_available is not None:
            self.row["result_available"] = result_available
        if result_path is not None:
            self.row["result_path"] = result_path

        return dict(self.row)

    def touch_heartbeat(self, public_id, conn=None):
        return {
            "public_id": public_id,
            "execution_state": self.row["execution_state"],
            "state_version": self.row["state_version"],
        }


class ExecutionStateServiceTests(unittest.TestCase):
    PUBLIC_ID = "11111111-1111-1111-1111-111111111111"

    def test_queued_can_move_to_running(self):
        repo = FakeRepository(QUEUED)
        row = mark_running(self.PUBLIC_ID, repository=repo)
        self.assertEqual(row["execution_state"], RUNNING)
        self.assertEqual(row["state_version"], 1)

    def test_running_can_move_to_processing(self):
        repo = FakeRepository(RUNNING, version=4)
        row = mark_processing(self.PUBLIC_ID, repository=repo)
        self.assertEqual(row["execution_state"], PROCESSING)
        self.assertEqual(row["state_version"], 5)

    def test_processing_can_complete_with_result_artifact(self):
        repo = FakeRepository(PROCESSING)
        row = mark_completed(
            self.PUBLIC_ID,
            "/tmp/example/CombinedResults.csv",
            repository=repo,
        )
        self.assertEqual(row["execution_state"], COMPLETED)
        self.assertTrue(row["result_available"])
        self.assertEqual(
            row["result_path"],
            "/tmp/example/CombinedResults.csv",
        )

    def test_completed_requires_result_path(self):
        repo = FakeRepository(PROCESSING)
        with self.assertRaises(InvalidCompletionMetadata):
            mark_completed(self.PUBLIC_ID, "", repository=repo)

    def test_queued_can_fail_with_structured_metadata(self):
        repo = FakeRepository(QUEUED)
        row = mark_failed(
            self.PUBLIC_ID,
            "VALIDATION",
            "INVALID_ARCHIVE",
            "ZIP inválido.",
            repository=repo,
        )
        self.assertEqual(row["execution_state"], FAILED)
        self.assertEqual(row["failure_stage"], "VALIDATION")
        self.assertEqual(row["error_code"], "INVALID_ARCHIVE")
        self.assertFalse(row["result_available"])

    def test_failed_requires_error_code(self):
        repo = FakeRepository(RUNNING)
        with self.assertRaises(InvalidFailureMetadata):
            mark_failed(
                self.PUBLIC_ID,
                "EXECUTION",
                "",
                repository=repo,
            )

    def test_failed_requires_known_failure_stage(self):
        repo = FakeRepository(RUNNING)
        with self.assertRaises(InvalidFailureMetadata):
            mark_failed(
                self.PUBLIC_ID,
                "WHATEVER",
                "ERROR",
                repository=repo,
            )

    def test_completed_is_terminal(self):
        repo = FakeRepository(COMPLETED)
        with self.assertRaises(InvalidExecutionTransition):
            mark_running(self.PUBLIC_ID, repository=repo)

    def test_failed_is_terminal(self):
        repo = FakeRepository(FAILED)
        with self.assertRaises(InvalidExecutionTransition):
            mark_processing(self.PUBLIC_ID, repository=repo)

    def test_cancelled_is_terminal(self):
        repo = FakeRepository(CANCELLED)
        with self.assertRaises(InvalidExecutionTransition):
            mark_running(self.PUBLIC_ID, repository=repo)

    def test_queued_can_be_cancelled(self):
        repo = FakeRepository(QUEUED)
        row = mark_cancelled(self.PUBLIC_ID, repository=repo)
        self.assertEqual(row["execution_state"], CANCELLED)

    def test_processing_cannot_be_cancelled(self):
        repo = FakeRepository(PROCESSING)
        with self.assertRaises(InvalidExecutionTransition):
            mark_cancelled(self.PUBLIC_ID, repository=repo)

    def test_direct_transition_matrix(self):
        self.assertTrue(can_transition(QUEUED, RUNNING))
        self.assertTrue(can_transition(RUNNING, PROCESSING))
        self.assertTrue(can_transition(PROCESSING, COMPLETED))
        self.assertFalse(can_transition(QUEUED, COMPLETED))
        self.assertFalse(can_transition(COMPLETED, RUNNING))
