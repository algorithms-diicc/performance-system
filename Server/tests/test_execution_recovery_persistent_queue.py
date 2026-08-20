import unittest

from Server.webapp.repositories import execution_repository


class FakeCursor:
    def __init__(self):
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchall(self):
        return []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self):
        self.cursor_instance = FakeCursor()

    def cursor(self, *args, **kwargs):
        return self.cursor_instance


class PersistentQueueRecoveryTests(unittest.TestCase):
    def test_stale_scan_only_selects_active_states(self):
        conn = FakeConnection()

        rows = execution_repository.list_stale_executions(
            active_before="active-cutoff",
            conn=conn,
        )

        self.assertEqual(rows, [])
        sql, params = conn.cursor_instance.executed[0]
        normalized = " ".join(sql.split())

        self.assertIn(
            "execution_state IN ('RUNNING', 'PROCESSING')",
            normalized,
        )
        self.assertNotIn(
            "execution_state = 'QUEUED'",
            normalized,
        )
        self.assertEqual(params, ("active-cutoff",))

    def test_atomic_stale_failure_rejects_queued(self):
        conn = FakeConnection()

        with self.assertRaises(
            execution_repository.ExecutionRepositoryError
        ):
            execution_repository.fail_execution_if_stale(
                public_id="00000000-0000-0000-0000-000000000001",
                expected_state="QUEUED",
                expected_version=0,
                stale_before="cutoff",
                failure_stage="INFRASTRUCTURE",
                error_code="QUEUE_STALE",
                error_message="should never be used",
                conn=conn,
            )

        self.assertEqual(
            conn.cursor_instance.executed,
            [],
        )


if __name__ == "__main__":
    unittest.main()
