import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.experimental_protocol_routes import (
    experimental_protocols_bp,
)


TEACHER = {
    "id": 20,
    "role_name": "Teacher",
}
OTHER_TEACHER = {
    "id": 21,
    "role_name": "Teacher",
}
ADMIN = {
    "id": 99,
    "role_name": "Admin",
}
STUDENT = {
    "id": 3,
    "role_name": "Student",
}


def course_row(**overrides):
    row = {
        "id": 10,
        "code": "INF-101",
        "name": "Algoritmos",
        "academic_year": 2026,
        "academic_term": 2,
        "teacher_user_id": TEACHER["id"],
        "is_active": True,
    }
    row.update(overrides)
    return row


def protocol_row(**overrides):
    row = {
        "id": 7,
        "course_id": 10,
        "title": "LCS base",
        "objective": "Comparar implementaciones.",
        "instructions": "Adjunta tu ZIP.",
        "benchmark": "LCS",
        "input_size": 1000,
        "execution_profile": "QUICK",
        "samples": 10,
        "data_type": None,
        "is_published": False,
        "is_active": True,
        "published_at": None,
        "deactivated_at": None,
        "created_at": None,
        "updated_at": None,
        "course_code": "INF-101",
        "course_name": "Algoritmos",
        "academic_year": 2026,
        "academic_term": 2,
    }
    row.update(overrides)
    return row


class ScriptedCursor:
    def __init__(self, connection):
        self.connection = connection
        self.response = None

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))
        if self.connection.responses:
            self.response = self.connection.responses.pop(0)
        else:
            self.response = None

    def fetchone(self):
        return self.response

    def fetchall(self):
        return list(self.response or [])

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ScriptedConnection:
    def __init__(self, responses=()):
        self.responses = list(responses)
        self.executed = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self, cursor_factory=None):
        return ScriptedCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class ExperimentalProtocolRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(
            TESTING=True,
            SECRET_KEY="test-only",
        )
        app.register_blueprint(
            experimental_protocols_bp
        )
        self.client = app.test_client()

    def _request(
        self,
        user,
        method,
        path,
        responses=(),
        **kwargs,
    ):
        conn = ScriptedConnection(
            responses
        )

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.experimental_protocol_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.open(
                path,
                method=method,
                **kwargs,
            )

        return response, conn

    def test_student_cannot_use_teacher_protocol_routes(self):
        response, conn = self._request(
            STUDENT,
            "GET",
            "/api/teacher/courses/10/protocols",
        )

        self.assertEqual(
            response.status_code,
            403,
        )
        self.assertEqual(
            conn.executed,
            [],
        )

    def test_teacher_can_list_protocols_only_for_owned_course(self):
        response, conn = self._request(
            TEACHER,
            "GET",
            "/api/teacher/courses/10/protocols",
            responses=[
                course_row(),
                [protocol_row()],
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )
        self.assertEqual(
            response.get_json()["total"],
            1,
        )

        course_sql, course_params = (
            conn.executed[0]
        )
        self.assertIn(
            "c.teacher_user_id = %s",
            course_sql,
        )
        self.assertEqual(
            list(course_params),
            [10, TEACHER["id"]],
        )

    def test_foreign_teacher_course_is_hidden(self):
        response, conn = self._request(
            OTHER_TEACHER,
            "GET",
            "/api/teacher/courses/10/protocols",
            responses=[None],
        )

        self.assertEqual(
            response.status_code,
            404,
        )
        self.assertEqual(
            len(conn.executed),
            1,
        )

    def test_admin_can_access_any_teacher_course(self):
        response, conn = self._request(
            ADMIN,
            "GET",
            "/api/teacher/courses/10/protocols",
            responses=[
                course_row(),
                [protocol_row()],
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        course_sql, course_params = (
            conn.executed[0]
        )
        self.assertIn(
            "AND (TRUE)",
            course_sql,
        )
        self.assertEqual(
            list(course_params),
            [10],
        )

    def test_teacher_and_admin_cannot_consume_student_endpoint(self):
        for user in (
            TEACHER,
            ADMIN,
        ):
            with self.subTest(
                role=user["role_name"]
            ):
                response, conn = (
                    self._request(
                        user,
                        "GET",
                        "/api/student/protocols",
                    )
                )

                self.assertEqual(
                    response.status_code,
                    403,
                )
                self.assertEqual(
                    conn.executed,
                    [],
                )

    def test_student_list_query_enforces_publication_and_active_context(self):
        response, conn = self._request(
            STUDENT,
            "GET",
            "/api/student/protocols",
            responses=[
                [
                    protocol_row(
                        is_published=True
                    )
                ],
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )
        self.assertEqual(
            response.get_json()["total"],
            1,
        )

        sql, params = conn.executed[0]
        normalized = " ".join(
            sql.split()
        )

        for fragment in (
            "p.is_active = TRUE",
            "p.is_published = TRUE",
            "c.is_active = TRUE",
            "cm.is_active = TRUE",
        ):
            self.assertIn(
                fragment,
                normalized,
            )

        self.assertEqual(
            params,
            (STUDENT["id"],),
        )

    def test_unavailable_student_protocol_returns_404(self):
        response, conn = self._request(
            STUDENT,
            "GET",
            "/api/student/protocols/7",
            responses=[None],
        )

        self.assertEqual(
            response.status_code,
            404,
        )

        sql, _params = conn.executed[0]
        normalized = " ".join(
            sql.split()
        )
        self.assertIn(
            "p.is_published = TRUE",
            normalized,
        )
        self.assertIn(
            "p.is_active = TRUE",
            normalized,
        )
        self.assertIn(
            "cm.is_active = TRUE",
            normalized,
        )

    def test_publish_reactivates_protocol_on_active_owned_course(self):
        current = protocol_row()
        published = protocol_row(
            is_published=True,
            is_active=True,
        )

        response, conn = self._request(
            TEACHER,
            "POST",
            "/api/teacher/courses/10/protocols/7/publish",
            responses=[
                course_row(),
                current,
                published,
                None,
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )
        payload = response.get_json()[
            "protocol"
        ]
        self.assertIs(
            payload["isPublished"],
            True,
        )
        self.assertIs(
            payload["isActive"],
            True,
        )
        self.assertEqual(
            conn.commits,
            1,
        )

        update_sql = " ".join(
            conn.executed[2][0].split()
        )
        self.assertIn(
            "SET is_published = TRUE",
            update_sql,
        )
        self.assertIn(
            "is_active = TRUE",
            update_sql,
        )

        notification_sql = [
            " ".join(sql.split())
            for sql, _params in conn.executed
            if "INSERT INTO notifications" in sql
        ]
        self.assertEqual(len(notification_sql), 1)
        self.assertIn(
            "cm.is_active = TRUE",
            notification_sql[0],
        )
        self.assertIn(
            "LOWER(r.name) = 'student'",
            notification_sql[0],
        )

    def test_publish_already_available_protocol_does_not_duplicate_notification(self):
        current = protocol_row(
            is_published=True,
            is_active=True,
        )
        published = protocol_row(
            is_published=True,
            is_active=True,
        )

        response, conn = self._request(
            TEACHER,
            "POST",
            "/api/teacher/courses/10/protocols/7/publish",
            responses=[
                course_row(),
                current,
                published,
                None,
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )
        self.assertEqual(
            conn.commits,
            1,
        )

        notification_sql = [
            " ".join(sql.split())
            for sql, _params in conn.executed
            if "INSERT INTO notifications" in sql
        ]
        self.assertEqual(
            notification_sql,
            [],
        )

    def test_deactivate_hides_protocol_without_delete(self):
        current = protocol_row(
            is_published=True,
        )
        inactive = protocol_row(
            is_published=False,
            is_active=False,
        )

        response, conn = self._request(
            TEACHER,
            "POST",
            "/api/teacher/courses/10/protocols/7/deactivate",
            responses=[
                course_row(),
                current,
                inactive,
                None,
            ],
        )

        self.assertEqual(
            response.status_code,
            200,
        )
        payload = response.get_json()[
            "protocol"
        ]
        self.assertIs(
            payload["isPublished"],
            False,
        )
        self.assertIs(
            payload["isActive"],
            False,
        )
        self.assertEqual(
            conn.commits,
            1,
        )

        update_sql = " ".join(
            conn.executed[2][0].split()
        )
        self.assertIn(
            "SET is_published = FALSE",
            update_sql,
        )
        self.assertIn(
            "is_active = FALSE",
            update_sql,
        )
        self.assertNotIn(
            "DELETE FROM",
            update_sql.upper(),
        )


if __name__ == "__main__":
    unittest.main()
