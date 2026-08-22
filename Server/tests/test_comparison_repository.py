import unittest

from Server.webapp.repositories.comparison_repository import (
    list_previous_candidate_executions,
    list_recent_candidate_executions,
    list_reference_candidate_executions,
)


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.query = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params):
        self.query = query
        self.params = params

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows):
        self.cursor_instance = FakeCursor(rows)
        self.closed = False

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def close(self):
        self.closed = True


class ComparisonRepositoryTests(unittest.TestCase):
    def _list(self, role, rows=None, limit=200):
        connection = FakeConnection(rows or [{"codename": "candidateA"}])
        payload = list_recent_candidate_executions(
            current_user_id=7,
            current_role_name=role,
            excluded_codenames=["selectedA", "selectedB"],
            limit=limit,
            conn=connection,
        )
        return payload, connection.cursor_instance

    def test_student_query_is_owner_scoped_and_deterministic(self):
        payload, cursor = self._list("Student")
        self.assertIn("s.user_id = %s", cursor.query)
        self.assertNotIn("c.teacher_user_id = %s", cursor.query)
        self.assertIn("e.execution_state = 'COMPLETED'", cursor.query)
        self.assertIn("ORDER BY e.created_at DESC NULLS LAST, e.id DESC", cursor.query)
        self.assertEqual(cursor.params, [["selectedA", "selectedB"], 7, 201])
        self.assertEqual(payload["items"], [{"codename": "candidateA"}])

    def test_teacher_query_covers_owner_and_assigned_courses(self):
        _, cursor = self._list("Teacher")
        self.assertIn(
            "s.user_id = %s OR c.teacher_user_id = %s",
            cursor.query,
        )
        self.assertEqual(
            cursor.params,
            [["selectedA", "selectedB"], 7, 7, 201],
        )

    def test_admin_query_has_no_actor_filter(self):
        _, cursor = self._list("Admin")
        self.assertNotIn("s.user_id = %s", cursor.query)
        self.assertNotIn("c.teacher_user_id = %s", cursor.query)
        self.assertEqual(cursor.params, [["selectedA", "selectedB"], 201])

    def test_hard_cap_and_truncated_use_one_lookahead_row(self):
        rows = [{"codename": "candidate{}".format(index)} for index in range(4)]
        payload, cursor = self._list("Student", rows=rows, limit=3)
        self.assertEqual(len(payload["items"]), 3)
        self.assertTrue(payload["truncated"])
        self.assertEqual(cursor.params[-1], 4)

    def test_reference_candidates_are_owner_pinned_completed_and_bounded(self):
        connection = FakeConnection([{"codename": "referenceA"}])
        payload = list_reference_candidate_executions(
            owner_user_id=7,
            excluded_codename="currentA",
            limit=10,
            conn=connection,
        )
        cursor = connection.cursor_instance

        self.assertIn("s.user_id = %s", cursor.query)
        self.assertIn("s.is_pinned = TRUE", cursor.query)
        self.assertIn("e.execution_state = 'COMPLETED'", cursor.query)
        self.assertIn("e.codename <> %s", cursor.query)
        self.assertIn(
            "ORDER BY e.created_at DESC NULLS LAST, e.id DESC",
            cursor.query,
        )
        self.assertEqual(cursor.params, (7, "currentA", 11))
        self.assertEqual(payload["items"], [{"codename": "referenceA"}])

    def test_previous_candidates_are_same_owner_strictly_older_and_nearest(self):
        connection = FakeConnection([{"codename": "previousA"}])
        payload = list_previous_candidate_executions(
            current_codename="currentA",
            owner_user_id=7,
            limit=10,
            conn=connection,
        )
        cursor = connection.cursor_instance

        self.assertIn(
            "s.user_id = current_submission.user_id",
            cursor.query,
        )
        self.assertIn("current_submission.user_id = %s", cursor.query)
        self.assertIn(
            "e.created_at < current_execution.created_at",
            cursor.query,
        )
        self.assertIn("e.id < current_execution.id", cursor.query)
        self.assertIn(
            "ORDER BY e.created_at DESC NULLS LAST, e.id DESC",
            cursor.query,
        )
        self.assertIn("OFFSET %s", cursor.query)
        self.assertEqual(cursor.params, ("currentA", 7, 11, 0))
        self.assertEqual(payload["items"], [{"codename": "previousA"}])
        self.assertFalse(payload["truncated"])


if __name__ == "__main__":
    unittest.main()
