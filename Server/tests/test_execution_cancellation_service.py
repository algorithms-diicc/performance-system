import unittest

from Server.webapp.services.execution_cancellation_service import (
    ExecutionCancellationConflict,
    ExecutionCancellationForbidden,
    ExecutionCancellationNotFound,
    cancel_queued_execution,
)
from Server.webapp.services.execution_queue_service import (
    claim_next_queued_execution,
)


OWNER_ID = 10
ADMIN_ID = 99
TEACHER_ID = 20
OTHER_STUDENT_ID = 11


def execution(state="QUEUED", public_id="execution-1", **overrides):
    row = {
        "id": 1,
        "public_id": public_id,
        "owner_user_id": OWNER_ID,
        "execution_state": state,
        "state_version": 4,
        "result_available": False,
        "result_path": None,
        "failure_stage": None,
        "error_code": None,
        "error_message": None,
    }
    row.update(overrides)
    return row


class FakeConnection:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.closed = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed += 1


class FakeRepository:
    def __init__(self, rows):
        self.rows = {row["public_id"]: row for row in rows}
        self.locked = []

    def get_execution_cancellation_row(self, public_id, conn):
        self.locked.append((public_id, conn))
        return self.rows.get(public_id)

    def get_execution(self, public_id, conn):
        return self.rows[public_id]

    def list_queued_executions(self, limit, conn, for_update, skip_locked):
        return [
            row
            for row in self.rows.values()
            if row["execution_state"] == "QUEUED"
        ][:limit]


class FakeStateService:
    def mark_cancelled(self, public_id, conn, repository):
        row = repository.rows[public_id]
        if row["execution_state"] != "QUEUED":
            raise AssertionError("cancellation overwrote a claimed row")
        row["execution_state"] = "CANCELLED"
        row["state_version"] += 1
        return row

    def mark_running(self, public_id, conn, repository):
        row = repository.rows[public_id]
        if row["execution_state"] != "QUEUED":
            raise AssertionError("dispatcher selected a non-queued row")
        row["execution_state"] = "RUNNING"
        row["state_version"] += 1
        return row


class ExecutionCancellationServiceTests(unittest.TestCase):
    def cancel(self, repository, *, user_id=OWNER_ID, role="Student"):
        return cancel_queued_execution(
            "execution-1",
            current_user_id=user_id,
            current_role_name=role,
            conn=FakeConnection(),
            repository=repository,
            state_service=FakeStateService(),
        )

    def test_owner_cancels_queued_execution_without_fabricating_metadata(self):
        repository = FakeRepository([execution()])

        result = self.cancel(repository)

        row = repository.rows["execution-1"]
        self.assertEqual(result["state"], "CANCELLED")
        self.assertTrue(result["terminal"])
        self.assertFalse(result["canCancel"])
        self.assertEqual(row["execution_state"], "CANCELLED")
        self.assertIsNone(row["result_path"])
        self.assertIsNone(row["failure_stage"])
        self.assertIsNone(row["error_code"])

    def test_admin_can_cancel_another_users_queued_execution(self):
        repository = FakeRepository([execution(owner_user_id=123)])

        result = self.cancel(repository, user_id=ADMIN_ID, role="Admin")

        self.assertEqual(result["state"], "CANCELLED")

    def test_teacher_and_unrelated_student_cannot_cancel(self):
        for user_id, role in ((TEACHER_ID, "Teacher"), (OTHER_STUDENT_ID, "Student")):
            with self.subTest(role=role):
                repository = FakeRepository([execution()])
                with self.assertRaises(ExecutionCancellationForbidden):
                    self.cancel(repository, user_id=user_id, role=role)
                self.assertEqual(
                    repository.rows["execution-1"]["execution_state"],
                    "QUEUED",
                )

    def test_unknown_execution_is_not_found(self):
        with self.assertRaises(ExecutionCancellationNotFound):
            self.cancel(FakeRepository([]))

    def test_non_queued_states_return_conflict_without_mutation(self):
        for state in ("RUNNING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"):
            with self.subTest(state=state):
                repository = FakeRepository([execution(state=state)])
                with self.assertRaises(ExecutionCancellationConflict):
                    self.cancel(repository)
                self.assertEqual(
                    repository.rows["execution-1"]["execution_state"],
                    state,
                )

    def test_dispatcher_win_cannot_be_overwritten_by_cancellation(self):
        repository = FakeRepository([execution(state="RUNNING")])

        with self.assertRaises(ExecutionCancellationConflict):
            self.cancel(repository)

        self.assertEqual(
            repository.rows["execution-1"]["execution_state"],
            "RUNNING",
        )

    def test_cancelled_head_is_not_claimed_and_remaining_fifo_is_preserved(self):
        repository = FakeRepository([
            execution(public_id="execution-1"),
            execution(public_id="execution-2", id=2),
            execution(public_id="execution-3", id=3),
        ])
        connection = FakeConnection()
        state_service = FakeStateService()

        cancel_queued_execution(
            "execution-1",
            current_user_id=OWNER_ID,
            current_role_name="Student",
            conn=connection,
            repository=repository,
            state_service=state_service,
        )

        claimed = claim_next_queued_execution(
            conn=connection,
            repository=repository,
            state_service=state_service,
        )

        self.assertEqual(claimed["public_id"], "execution-2")
        self.assertEqual(
            repository.rows["execution-1"]["execution_state"],
            "CANCELLED",
        )
        self.assertEqual(
            repository.rows["execution-3"]["execution_state"],
            "QUEUED",
        )


if __name__ == "__main__":
    unittest.main()
