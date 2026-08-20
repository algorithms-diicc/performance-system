import unittest
from unittest.mock import patch

from Server.webapp.repositories import execution_repository
from Server.webapp.services.execution_queue_service import (
    claim_next_queued_execution,
)


class FakeCursor:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchall(self):
        return list(self.rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, rows=None):
        self.cursor_instance = FakeCursor(rows)
        self.commits = 0
        self.rollbacks = 0
        self.closed = 0

    def cursor(self, cursor_factory=None):
        return self.cursor_instance

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed += 1


class FakeQueueRepository:
    def __init__(self, candidates):
        self.candidates = list(candidates)
        self.calls = []

    def list_queued_executions(
        self,
        limit,
        conn,
        for_update,
        skip_locked,
    ):
        self.calls.append(
            {
                "limit": limit,
                "conn": conn,
                "for_update": for_update,
                "skip_locked": skip_locked,
            }
        )
        return list(self.candidates)


class FakeStateService:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def mark_running(
        self,
        public_id,
        conn,
        repository,
    ):
        self.calls.append(
            {
                "public_id": public_id,
                "conn": conn,
                "repository": repository,
            }
        )
        if self.error is not None:
            raise self.error
        return self.result


class ExecutionQueueRepositoryTests(unittest.TestCase):
    def test_fifo_query_uses_row_lock_and_skip_locked(self):
        conn = FakeConnection(
            rows=[
                {
                    "id": 10,
                    "public_id": "uuid-10",
                    "execution_state": "QUEUED",
                }
            ]
        )

        rows = execution_repository.list_queued_executions(
            limit=1,
            conn=conn,
            for_update=True,
            skip_locked=True,
        )

        sql, params = conn.cursor_instance.executed[0]
        normalized_sql = " ".join(sql.split())

        self.assertIn(
            "WHERE e.execution_state = 'QUEUED'",
            normalized_sql,
        )
        self.assertIn(
            "ORDER BY e.queued_at ASC NULLS LAST, e.id ASC",
            normalized_sql,
        )
        self.assertIn(
            "FOR UPDATE SKIP LOCKED",
            normalized_sql,
        )
        self.assertEqual(params, (1,))
        self.assertEqual(rows[0]["id"], 10)

    def test_skip_locked_requires_row_lock(self):
        with self.assertRaises(ValueError):
            execution_repository.list_queued_executions(
                limit=1,
                conn=FakeConnection(),
                for_update=False,
                skip_locked=True,
            )


class ExecutionQueueServiceTests(unittest.TestCase):
    def test_claim_transitions_oldest_candidate_to_running(self):
        conn = FakeConnection()
        repository = FakeQueueRepository(
            [
                {
                    "id": 10,
                    "public_id": "uuid-10",
                }
            ]
        )
        expected = {
            "id": 10,
            "public_id": "uuid-10",
            "execution_state": "RUNNING",
        }
        state_service = FakeStateService(result=expected)

        result = claim_next_queued_execution(
            conn=conn,
            repository=repository,
            state_service=state_service,
        )

        self.assertEqual(result, expected)
        self.assertEqual(len(repository.calls), 1)
        self.assertTrue(repository.calls[0]["for_update"])
        self.assertTrue(repository.calls[0]["skip_locked"])
        self.assertEqual(
            state_service.calls[0]["public_id"],
            "uuid-10",
        )
        self.assertIs(
            state_service.calls[0]["conn"],
            conn,
        )

    def test_empty_queue_returns_none_without_transition(self):
        repository = FakeQueueRepository([])
        state_service = FakeStateService()

        result = claim_next_queued_execution(
            conn=FakeConnection(),
            repository=repository,
            state_service=state_service,
        )

        self.assertIsNone(result)
        self.assertEqual(state_service.calls, [])

    def test_owned_connection_commits_and_closes(self):
        conn = FakeConnection()
        repository = FakeQueueRepository([])

        with patch(
            "Server.webapp.services.execution_queue_service.get_connection",
            return_value=conn,
        ):
            result = claim_next_queued_execution(
                repository=repository,
                state_service=FakeStateService(),
            )

        self.assertIsNone(result)
        self.assertEqual(conn.commits, 1)
        self.assertEqual(conn.rollbacks, 0)
        self.assertEqual(conn.closed, 1)

    def test_owned_connection_rolls_back_on_transition_error(self):
        conn = FakeConnection()
        repository = FakeQueueRepository(
            [{"id": 10, "public_id": "uuid-10"}]
        )

        with patch(
            "Server.webapp.services.execution_queue_service.get_connection",
            return_value=conn,
        ):
            with self.assertRaises(RuntimeError):
                claim_next_queued_execution(
                    repository=repository,
                    state_service=FakeStateService(
                        error=RuntimeError("boom")
                    ),
                )

        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.closed, 1)


if __name__ == "__main__":
    unittest.main()
