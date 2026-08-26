import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.feedback_notifications_routes import (
    feedback_notifications_bp,
)


TEACHER = {
    "id": 20,
    "full_name": "Professor Persisted",
    "role_name": "Teacher",
}
OTHER_TEACHER = {
    "id": 21,
    "full_name": "Other Teacher",
    "role_name": "Teacher",
}
ADMIN = {
    "id": 99,
    "full_name": "Admin User",
    "role_name": "Admin",
}
STUDENT = {
    "id": 3,
    "full_name": "Ada Lovelace",
    "role_name": "Student",
}


def access_row(**overrides):
    row = {
        "submission_id": 5,
        "owner_user_id": STUDENT["id"],
        "course_id": 10,
        "course_teacher_user_id": TEACHER["id"],
    }
    row.update(overrides)
    return row


def feedback_row(**overrides):
    row = {
        "id": 8,
        "submission_id": 5,
        "author_user_id": TEACHER["id"],
        "message": "Revisa la variabilidad entre muestras.",
        "created_at": None,
        "author_full_name": TEACHER["full_name"],
        "author_role_name": "Teacher",
    }
    row.update(overrides)
    return row


def notification_row(**overrides):
    row = {
        "id": 12,
        "kind": "TEACHER_FEEDBACK",
        "submission_id": 5,
        "execution_id": None,
        "feedback_id": 8,
        "protocol_id": None,
        "actor_user_id": TEACHER["id"],
        "is_read": False,
        "read_at": None,
        "created_at": None,
        "submission_title": "Experimento LCS",
        "execution_public_id": None,
        "execution_codename": None,
        "execution_error_code": None,
        "feedback_message": "Revisa la variabilidad entre muestras.",
        "protocol_title": None,
        "protocol_course_id": None,
        "protocol_course_code": None,
        "protocol_course_name": None,
        "actor_full_name": TEACHER["full_name"],
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


class FeedbackNotificationsRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(
            TESTING=True,
            SECRET_KEY="test-only",
        )
        app.register_blueprint(
            feedback_notifications_bp
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
        conn = ScriptedConnection(responses)

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.feedback_notifications_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.open(
                path,
                method=method,
                **kwargs,
            )

        return response, conn

    def test_student_owner_can_read_feedback(self):
        response, conn = self._request(
            STUDENT,
            "GET",
            "/api/submissions/5/feedback",
            responses=[
                access_row(),
                [feedback_row()],
            ],
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(
            payload["items"][0]["message"],
            "Revisa la variabilidad entre muestras.",
        )

    def test_foreign_student_cannot_read_feedback(self):
        foreign_student = {
            "id": 4,
            "full_name": "Grace Hopper",
            "role_name": "Student",
        }
        response, _conn = self._request(
            foreign_student,
            "GET",
            "/api/submissions/5/feedback",
            responses=[access_row()],
        )

        self.assertEqual(response.status_code, 403)

    def test_teacher_can_read_feedback_for_owned_course(self):
        response, _conn = self._request(
            TEACHER,
            "GET",
            "/api/submissions/5/feedback",
            responses=[
                access_row(),
                [feedback_row()],
            ],
        )

        self.assertEqual(response.status_code, 200)

    def test_student_cannot_create_feedback(self):
        response, conn = self._request(
            STUDENT,
            "POST",
            "/api/submissions/5/feedback",
            json={"message": "No corresponde."},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(conn.executed, [])

    def test_foreign_teacher_cannot_create_feedback(self):
        response, _conn = self._request(
            OTHER_TEACHER,
            "POST",
            "/api/submissions/5/feedback",
            responses=[access_row()],
            json={"message": "No debería escribirse."},
        )

        self.assertEqual(response.status_code, 403)

    def test_feedback_requires_course_association(self):
        response, conn = self._request(
            ADMIN,
            "POST",
            "/api/submissions/5/feedback",
            responses=[
                access_row(
                    course_id=None,
                    course_teacher_user_id=None,
                ),
            ],
            json={"message": "Comentario."},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)

    def test_teacher_creates_feedback_and_owner_notification(self):
        created = feedback_row()
        response, conn = self._request(
            TEACHER,
            "POST",
            "/api/submissions/5/feedback",
            responses=[
                access_row(),
                created,
                {"id": 12},
                None,
            ],
            json={
                "message":
                    "  Revisa la variabilidad entre muestras.  "
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(conn.commits, 1)
        self.assertEqual(
            response.get_json()["feedback"]["message"],
            "Revisa la variabilidad entre muestras.",
        )

        normalized_sql = [
            " ".join(sql.split())
            for sql, _params in conn.executed
        ]
        self.assertTrue(
            any(
                "INSERT INTO teacher_feedback" in sql
                for sql in normalized_sql
            )
        )
        self.assertTrue(
            any(
                "INSERT INTO notifications" in sql
                for sql in normalized_sql
            )
        )
        self.assertTrue(
            any(
                "create_teacher_feedback" in str(params)
                for _sql, params in conn.executed
            )
        )

    def test_feedback_rejects_extra_fields(self):
        response, conn = self._request(
            TEACHER,
            "POST",
            "/api/submissions/5/feedback",
            json={
                "message": "Comentario.",
                "grade": 7.0,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(conn.executed, [])

    def test_notification_list_is_scoped_to_current_user(self):
        response, conn = self._request(
            STUDENT,
            "GET",
            "/api/notifications",
            responses=[
                {"unread_count": 1},
                [notification_row()],
            ],
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["unreadCount"], 1)
        self.assertEqual(
            payload["items"][0]["kind"],
            "TEACHER_FEEDBACK",
        )

        for sql, params in conn.executed:
            normalized = " ".join(sql.split())
            if "FROM notifications" in normalized:
                self.assertEqual(
                    params[0],
                    STUDENT["id"],
                )

    def test_notification_read_is_scoped_to_owner(self):
        response, conn = self._request(
            STUDENT,
            "POST",
            "/api/notifications/12/read",
            responses=[
                {
                    "id": 12,
                    "is_read": True,
                    "read_at": None,
                }
            ],
        )

        self.assertEqual(response.status_code, 200)
        sql, params = conn.executed[0]
        self.assertIn(
            "user_id = %s",
            " ".join(sql.split()),
        )
        self.assertEqual(
            params,
            (12, STUDENT["id"]),
        )

    def test_read_all_is_scoped_to_owner(self):
        response, conn = self._request(
            STUDENT,
            "POST",
            "/api/notifications/read-all",
            responses=[
                [{"id": 12}, {"id": 13}],
            ],
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["updated"],
            2,
        )
        _sql, params = conn.executed[0]
        self.assertEqual(
            params,
            (STUDENT["id"],),
        )


if __name__ == "__main__":
    unittest.main()
