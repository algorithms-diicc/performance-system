import unittest

from Server.webapp.repositories import submission_access_repository
from Server.webapp.services.submission_access_service import (
    SubmissionAccessForbidden,
    SubmissionAccessNotFound,
    assert_submission_viewer,
    is_submission_owner,
)


def access_row(**overrides):
    row = {
        "submission_id": 7,
        "owner_user_id": 3,
        "course_id": 10,
        "course_teacher_user_id": 20,
    }
    row.update(overrides)
    return row


class FakeRepository:
    def __init__(self, row):
        self.row = row

    def get_submission_access_row_by_id(self, submission_id):
        if self.row is None:
            return None
        result = dict(self.row)
        result.setdefault("submission_id", submission_id)
        return result


class FakeCursor:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params):
        self.connection.executed.append((sql, params))

    def fetchone(self):
        return self.connection.row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.executed = []

    def cursor(self, cursor_factory=None):
        return FakeCursor(self)


class SubmissionAccessServiceTests(unittest.TestCase):
    def test_missing_submission_raises_not_found(self):
        with self.assertRaises(SubmissionAccessNotFound):
            assert_submission_viewer(
                7,
                3,
                "Student",
                repository=FakeRepository(None),
            )

    def test_owner_is_allowed(self):
        row = assert_submission_viewer(
            7,
            3,
            "Student",
            repository=FakeRepository(access_row()),
        )

        self.assertTrue(is_submission_owner(row, 3))

    def test_assigned_teacher_is_allowed(self):
        row = assert_submission_viewer(
            7,
            20,
            "Teacher",
            repository=FakeRepository(access_row()),
        )

        self.assertEqual(row["course_teacher_user_id"], 20)

    def test_foreign_teacher_is_forbidden(self):
        with self.assertRaises(SubmissionAccessForbidden):
            assert_submission_viewer(
                7,
                21,
                "Teacher",
                repository=FakeRepository(access_row()),
            )

    def test_admin_is_allowed(self):
        row = assert_submission_viewer(
            7,
            99,
            "Admin",
            repository=FakeRepository(access_row()),
        )

        self.assertEqual(row["submission_id"], 7)

    def test_teacher_cannot_view_course_less_submission(self):
        with self.assertRaises(SubmissionAccessForbidden):
            assert_submission_viewer(
                7,
                20,
                "Teacher",
                repository=FakeRepository(
                    access_row(
                        course_id=None,
                        course_teacher_user_id=None,
                    )
                ),
            )

    def test_admin_can_view_course_less_submission(self):
        row = assert_submission_viewer(
            7,
            99,
            "Admin",
            repository=FakeRepository(
                access_row(
                    course_id=None,
                    course_teacher_user_id=None,
                )
            ),
        )

        self.assertIsNone(row["course_id"])

    def test_repository_uses_persisted_teacher_without_active_filter(self):
        conn = FakeConnection(access_row())

        result = submission_access_repository.get_submission_access_row_by_id(
            7,
            conn=conn,
        )

        sql, params = conn.executed[0]
        self.assertIn("LEFT JOIN courses", sql)
        self.assertIn("c.teacher_user_id", sql)
        self.assertNotIn("is_active", sql)
        self.assertEqual(params, (7,))
        self.assertEqual(result["course_teacher_user_id"], 20)


if __name__ == "__main__":
    unittest.main()
