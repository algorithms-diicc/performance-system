import unittest
from datetime import datetime
from unittest.mock import Mock, patch

from flask import Flask

from Server.webapp.routes.admin_access_requests_routes import (
    admin_access_requests_bp,
)
from Server.webapp.routes.auth_routes import auth_bp
from Server.webapp.utils.api_errors import APIError


ADMIN = {
    "id": 1,
    "email": "admin@inf.udec.cl",
    "role_name": "Admin",
}
STUDENT = {
    "id": 2,
    "email": "student@udec.cl",
    "role_name": "Student",
}


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.calls = []

    def execute(self, statement, params=None):
        self.calls.append((statement, params))

    def fetchone(self):
        return self.rows.pop(0)


class FakeDbCursor:
    def __init__(self, cursor, events=None):
        self.cursor = cursor
        self.events = events if events is not None else []

    def __enter__(self):
        self.events.append("transaction_enter")
        return Mock(), self.cursor

    def __exit__(self, exc_type, exc_value, traceback):
        self.events.append("rollback" if exc_type else "commit")
        return False


class FailingCommitDbCursor(FakeDbCursor):
    def __exit__(self, exc_type, exc_value, traceback):
        self.events.extend(["commit_failed", "rollback"])
        raise RuntimeError("commit failed")


def pending_request_rows(status="PENDING"):
    created_at = datetime(2026, 8, 25, 12, 0, 0)
    request = {
        "id": 10,
        "status": status,
        "user_id": 42,
        "requested_role_id": 2,
        "professor_email": "profesor@inf.udec.cl",
        "course_code": "INF-123",
        "message": "Necesito acceso.",
        "created_at": created_at,
        "resolved_at": None,
        "resolved_by": None,
        "full_name": "Ada Lovelace",
        "email": "ada@udec.cl",
        "is_active": False,
        "current_role_id": 2,
    }
    user = {
        "id": 42,
        "full_name": "Ada Lovelace",
        "email": "ada@udec.cl",
        "role_id": 2,
        "is_active": True,
        "created_at": created_at,
        "last_login": None,
    }
    approved = dict(request)
    approved.update(
        {
            "status": "APPROVED",
            "resolved_at": created_at,
            "resolved_by": ADMIN["id"],
        }
    )
    return request, user, approved


class AccessRequestRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(auth_bp)
        app.register_blueprint(admin_access_requests_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _public_payload(self, professor_email):
        return {
            "full_name": "Ada Lovelace",
            "email": "ada@udec.cl",
            "professor_email": professor_email,
            "course_code": "INF-123",
            "message": "Necesito acceso.",
        }

    def _public_rows(self, professor_email):
        created_at = datetime(2026, 8, 25, 12, 0, 0)
        return [
            None,
            {"id": 2},
            {"id": 42},
            None,
            {
                "id": 10,
                "status": "PENDING",
                "professor_email": professor_email,
                "course_code": "INF-123",
                "message": "Necesito acceso.",
                "created_at": created_at,
            },
        ]

    def test_professor_email_accepts_udec_domains_and_normalizes(self):
        cases = [
            "profesor@udec.cl",
            "profesor@inf.udec.cl",
            "profesor@sub.inf.udec.cl",
            "  Profesor@INF.UDEC.CL  ",
        ]

        for value in cases:
            with self.subTest(value=value):
                normalized = value.strip().lower()
                cursor = FakeCursor(self._public_rows(normalized))
                with patch(
                    "Server.webapp.routes.auth_routes.db_cursor",
                    return_value=FakeDbCursor(cursor),
                ):
                    response = self.client.post(
                        "/api/public/access-requests",
                        json=self._public_payload(value),
                    )

                self.assertEqual(response.status_code, 201)
                self.assertEqual(
                    response.get_json()["professor_email"],
                    normalized,
                )
                insert_call = next(
                    call
                    for call in cursor.calls
                    if "INSERT INTO access_requests" in call[0]
                )
                self.assertEqual(insert_call[1][2], normalized)

    def test_professor_email_rejects_external_boundary_and_malformed_values(self):
        cases = [
            "profesor@gmail.com",
            "profesor@eviludec.cl",
            "profesor@udec.cl.evil.com",
            "profesor@@inf.udec.cl",
            "profesor@.udec.cl",
            "profesor@foo..udec.cl",
            "profesor@",
            "@inf.udec.cl",
        ]

        for value in cases:
            with self.subTest(value=value):
                db_cursor = Mock()
                with patch(
                    "Server.webapp.routes.auth_routes.db_cursor",
                    db_cursor,
                ):
                    response = self.client.post(
                        "/api/public/access-requests",
                        json=self._public_payload(value),
                    )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"]["field"],
                    "professor_email",
                )
                db_cursor.assert_not_called()

    def _approve(
        self,
        *,
        mail_effect,
        status="PENDING",
        user=ADMIN,
        commit_fails=False,
    ):
        request_row, user_row, approved_row = pending_request_rows(status)
        rows = (
            [request_row, user_row, approved_row]
            if status == "PENDING"
            else [request_row]
        )
        cursor = FakeCursor(rows)
        events = []
        db_context_class = (
            FailingCommitDbCursor
            if commit_fails
            else FakeDbCursor
        )

        def mail_side_effect(**kwargs):
            events.append("mail")
            if isinstance(mail_effect, Exception):
                raise mail_effect
            return mail_effect

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.admin_access_requests_routes.db_cursor",
            return_value=db_context_class(cursor, events),
        ) as db_cursor, patch(
            "Server.webapp.routes.admin_access_requests_routes."
            "mail_service.send_access_approval_email",
            side_effect=mail_side_effect,
        ) as send_mail:
            response = self.client.post(
                "/api/admin/access-requests/10/approve"
            )

        return response, cursor, events, db_cursor, send_mail

    def test_approval_commits_before_successful_email_and_preserves_audit(self):
        response, cursor, events, _, send_mail = self._approve(
            mail_effect={"sent": True, "status": "SENT"}
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["request"]["status"], "APPROVED")
        self.assertTrue(payload["user"]["isActive"])
        self.assertEqual(
            payload["notification"]["email"],
            {"sent": True, "status": "SENT"},
        )
        self.assertLess(events.index("commit"), events.index("mail"))
        self.assertTrue(
            any("FOR UPDATE" in statement for statement, _ in cursor.calls)
        )
        self.assertTrue(
            any(
                "INSERT INTO audit_log" in statement
                for statement, _ in cursor.calls
            )
        )
        send_mail.assert_called_once_with(
            recipient_name="Ada Lovelace",
            recipient_email="ada@udec.cl",
        )

    def test_smtp_exception_does_not_turn_approval_into_failure(self):
        with self.assertLogs(
            "Server.webapp.routes.admin_access_requests_routes",
            level="WARNING",
        ):
            response, _, events, _, _ = self._approve(
                mail_effect=RuntimeError("smtp unavailable")
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["notification"]["email"],
            {"sent": False, "status": "FAILED"},
        )
        self.assertLess(events.index("commit"), events.index("mail"))

    def test_disabled_notification_is_returned_after_persisted_approval(self):
        response, _, events, _, _ = self._approve(
            mail_effect={"sent": False, "status": "DISABLED"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["notification"]["email"],
            {"sent": False, "status": "DISABLED"},
        )
        self.assertLess(events.index("commit"), events.index("mail"))

    def test_failed_approval_commit_never_attempts_email(self):
        response, _, events, _, send_mail = self._approve(
            mail_effect={"sent": True, "status": "SENT"},
            commit_fails=True,
        )

        self.assertEqual(response.status_code, 500)
        self.assertIn("rollback", events)
        send_mail.assert_not_called()

    def test_already_resolved_request_does_not_send_email(self):
        response, _, _, _, send_mail = self._approve(
            mail_effect={"sent": True, "status": "SENT"},
            status="APPROVED",
        )

        self.assertEqual(response.status_code, 400)
        send_mail.assert_not_called()

    def test_non_admin_cannot_approve_or_send_email(self):
        response, _, _, db_cursor, send_mail = self._approve(
            mail_effect={"sent": True, "status": "SENT"},
            user=STUDENT,
        )

        self.assertEqual(response.status_code, 403)
        db_cursor.assert_not_called()
        send_mail.assert_not_called()


if __name__ == "__main__":
    unittest.main()
