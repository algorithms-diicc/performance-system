import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.submissions_routes import submissions_bp


OWNER = {
    "id": 7,
    "email": "student@example.com",
    "role_name": "Student",
}


class ScriptedCursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))

    def fetchall(self):
        return list(self.connection.rows)


class ScriptedConnection:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []
        self.closed = False

    def cursor(self, cursor_factory=None):
        return ScriptedCursor(self)

    def close(self):
        self.closed = True


class SubmissionHistoryFilterOptionsTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(submissions_bp)
        self.client = app.test_client()

        auth_patch = patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=OWNER,
        )
        auth_patch.start()
        self.addCleanup(auth_patch.stop)

    def test_lists_distinct_courses_from_the_owners_history(self):
        rows = [
            {
                "id": 9,
                "code": "CC4102",
                "name": "Diseño y Análisis de Algoritmos",
                "academic_year": 2026,
                "academic_term": 2,
            },
            {
                "id": 4,
                "code": "CC3001",
                "name": "Algoritmos",
                "academic_year": 2025,
                "academic_term": 2,
            },
        ]
        conn = ScriptedConnection(rows)

        with patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.get(
                "/api/submissions/history-filter-options"
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(conn.closed)
        self.assertEqual(
            response.get_json(),
            {
                "courses": [
                    {
                        "id": 9,
                        "code": "CC4102",
                        "name": "Diseño y Análisis de Algoritmos",
                        "academicYear": 2026,
                        "academicTerm": 2,
                    },
                    {
                        "id": 4,
                        "code": "CC3001",
                        "name": "Algoritmos",
                        "academicYear": 2025,
                        "academicTerm": 2,
                    },
                ]
            },
        )

        self.assertEqual(len(conn.executed), 1)
        sql, params = conn.executed[0]
        self.assertIn("FROM submissions s", sql)
        self.assertIn("JOIN courses c", sql)
        self.assertIn("WHERE s.user_id = %s", sql)
        self.assertIn("s.course_id IS NOT NULL", sql)
        self.assertEqual(params, (OWNER["id"],))


if __name__ == "__main__":
    unittest.main()
