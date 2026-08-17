import unittest

from Server.webapp.repositories import submission_repository


def submission_row(**overrides):
    row = {
        "id": 7,
        "user_id": 3,
        "course_id": None,
        "title": "Experimento",
        "language": "C++",
        "file_path": "uploads/internal-uuid.zip",
        "original_filename": "algoritmos.zip",
        "code_hash": "a" * 64,
        "note": None,
        "is_pinned": False,
        "created_at": None,
        "status": "QUEUED",
    }
    row.update(overrides)
    return row


class FakeCursor:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params):
        self.connection.executed.append((sql, params))

    def fetchone(self):
        return self.connection.rows.pop(0)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []

    def cursor(self, cursor_factory=None):
        return FakeCursor(self)


class SubmissionRepositoryTests(unittest.TestCase):
    def test_create_submission_persists_and_returns_metadata(self):
        conn = FakeConnection([
            submission_row(
                note="Caso de referencia",
                is_pinned=True,
            )
        ])

        result = submission_repository.create_submission(
            user_id=3,
            title="Experimento",
            language="C++",
            file_path="uploads/internal-uuid.zip",
            code_hash="a" * 64,
            status="QUEUED",
            conn=conn,
            original_filename="algoritmos.zip",
            note="Caso de referencia",
            is_pinned=True,
        )

        sql, params = conn.executed[0]
        self.assertIn("original_filename", sql)
        self.assertIn("note", sql)
        self.assertIn("is_pinned", sql)
        self.assertEqual(params[5], "algoritmos.zip")
        self.assertEqual(params[7], "Caso de referencia")
        self.assertIs(params[8], True)
        self.assertEqual(result["original_filename"], "algoritmos.zip")
        self.assertEqual(result["note"], "Caso de referencia")
        self.assertIs(result["is_pinned"], True)

    def test_update_submission_note_accepts_normalized_nullable_value(self):
        conn = FakeConnection([submission_row(note=None)])

        result = submission_repository.update_submission_note(
            7,
            None,
            conn=conn,
        )

        sql, params = conn.executed[0]
        self.assertIn("SET note = %s", sql)
        self.assertEqual(params, (None, 7))
        self.assertIsNone(result["note"])

    def test_repository_can_set_and_unset_is_pinned(self):
        conn = FakeConnection([
            submission_row(is_pinned=True),
            submission_row(is_pinned=False),
        ])

        pinned = submission_repository.set_submission_pinned(
            7,
            True,
            conn=conn,
        )
        unpinned = submission_repository.set_submission_pinned(
            7,
            False,
            conn=conn,
        )

        self.assertEqual(conn.executed[0][1], (True, 7))
        self.assertEqual(conn.executed[1][1], (False, 7))
        self.assertIs(pinned["is_pinned"], True)
        self.assertIs(unpinned["is_pinned"], False)

    def test_note_and_pin_are_updated_in_one_statement(self):
        conn = FakeConnection([
            submission_row(note="Referencia", is_pinned=True)
        ])

        result = submission_repository.update_submission_metadata(
            7,
            note="Referencia",
            is_pinned=True,
            conn=conn,
        )

        self.assertEqual(len(conn.executed), 1)
        sql, params = conn.executed[0]
        normalized_sql = " ".join(sql.split())
        self.assertIn("SET note = %s, is_pinned = %s", normalized_sql)
        self.assertEqual(params, ("Referencia", True, 7))
        self.assertEqual(result["note"], "Referencia")
        self.assertIs(result["is_pinned"], True)


if __name__ == "__main__":
    unittest.main()
