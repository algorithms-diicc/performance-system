import unittest

from Server.webapp.repositories import execution_query_repository


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, row):
        self.cursor_instance = FakeCursor(row)

    def cursor(self, cursor_factory=None):
        return self.cursor_instance


class ExecutionQueryRepositoryTests(unittest.TestCase):
    def test_snapshot_queue_position_uses_exact_fifo_contract(self):
        conn = FakeConnection({"public_id": "public-1", "queue_ahead": 2})

        result = execution_query_repository.get_execution_snapshot_row(
            "11111111-1111-1111-1111-111111111111",
            conn=conn,
        )

        sql, params = conn.cursor_instance.executed[0]
        normalized_sql = " ".join(sql.split())

        self.assertIn(
            "ROW_NUMBER() OVER ( ORDER BY queued_at ASC NULLS LAST, id ASC ) - 1",
            normalized_sql,
        )
        self.assertIn("WHERE execution_state = 'QUEUED'", normalized_sql)
        self.assertIn("LEFT JOIN ordered_queue oq ON oq.id = e.id", normalized_sql)
        self.assertIn(
            "WHEN e.execution_state = 'QUEUED' THEN oq.queue_ahead ELSE NULL",
            normalized_sql,
        )
        self.assertNotIn("FOR UPDATE", normalized_sql)
        self.assertEqual(
            params,
            ("11111111-1111-1111-1111-111111111111",),
        )
        self.assertEqual(result["queue_ahead"], 2)

    def test_fifo_order_places_null_timestamps_last_and_breaks_ties_by_id(self):
        rows = [
            {"id": 9, "queued_at": None},
            {"id": 4, "queued_at": "2026-08-22T10:00:00"},
            {"id": 3, "queued_at": "2026-08-22T10:00:00"},
            {"id": 2, "queued_at": "2026-08-22T09:00:00"},
            {"id": 8, "queued_at": None},
        ]

        ordered = sorted(
            rows,
            key=lambda item: (
                item["queued_at"] is None,
                item["queued_at"] or "",
                item["id"],
            ),
        )

        self.assertEqual([item["id"] for item in ordered], [2, 3, 4, 8, 9])


if __name__ == "__main__":
    unittest.main()
