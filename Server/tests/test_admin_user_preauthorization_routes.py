import unittest
from unittest.mock import Mock, patch
from flask import Flask
from Server.webapp.routes.admin_users_routes import admin_users_bp

ADMIN = {"id": 1, "email": "admin@inf.udec.cl", "role_name": "Admin"}
STUDENT = {"id": 2, "email": "student@inf.udec.cl", "role_name": "Student"}

class FakeCursor:
    def __init__(self, rows, session_rowcount=2):
        self.rows = list(rows)
        self.calls = []
        self.rowcount = 0
        self.session_rowcount = session_rowcount
    def execute(self, statement, params=None):
        self.calls.append((statement, params))
        self.rowcount = self.session_rowcount if "UPDATE sessions" in statement else 0
    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

class FakeDbCursor:
    def __init__(self, cursor, events):
        self.cursor = cursor
        self.events = events
    def __enter__(self):
        self.events.append("transaction_enter")
        return Mock(), self.cursor
    def __exit__(self, exc_type, exc_value, traceback):
        self.events.append("rollback" if exc_type else "commit")
        return False

class AdminUserPreauthorizationTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(admin_users_bp)
        self.client = app.test_client()

    def _post(self, rows, user=ADMIN, payload=None):
        cursor = FakeCursor(rows)
        events = []
        with patch("Server.webapp.utils.auth_decorators.get_current_user", return_value=user), patch(
            "Server.webapp.routes.admin_users_routes.db_cursor",
            return_value=FakeDbCursor(cursor, events),
        ):
            response = self.client.post("/api/admin/users", json=payload or {
                "fullName": "External Evaluator",
                "email": "  Evaluator@Example.COM  ",
                "role": "Teacher",
            })
        return response, cursor, events

    def test_admin_can_preauthorize_external_email_and_role(self):
        response, cursor, events = self._post([
            None, None, {"id": 3},
            {"id": 42, "full_name": "External Evaluator", "email": "evaluator@example.com", "is_active": True},
        ])
        self.assertEqual(response.status_code, 201)
        body = response.get_json()["user"]
        self.assertEqual(body["email"], "evaluator@example.com")
        self.assertEqual(body["role"], "Teacher")
        self.assertTrue(body["isActive"])
        self.assertTrue(body["preauthorized"])
        self.assertIn("commit", events)
        self.assertTrue(any("INSERT INTO audit_log" in sql for sql, _ in cursor.calls))
        self.assertFalse(any("auth_identities" in sql for sql, _ in cursor.calls))

    def test_preauthorization_is_generic(self):
        for email in ("professor@inf.udec.cl", "student@udec.cl", "person@example.com"):
            with self.subTest(email=email):
                response, _, _ = self._post([
                    None, None, {"id": 2},
                    {"id": 42, "full_name": "Known User", "email": email, "is_active": True},
                ], payload={"fullName": "Known User", "email": email, "role": "Student"})
                self.assertEqual(response.status_code, 201)

    def test_existing_normalized_email_is_conflict(self):
        response, cursor, events = self._post([
            {"id": 55, "email": "evaluator@example.com", "is_active": True, "role_name": "Student"}, None,
        ])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "USER_EMAIL_EXISTS")
        self.assertIn("rollback", events)
        self.assertFalse(any("INSERT INTO users" in sql or "UPDATE users" in sql for sql, _ in cursor.calls))

    def test_duplicate_casefolded_rows_fail_closed(self):
        response, _, events = self._post([
            {"id": 55, "email": "User@example.com", "is_active": True, "role_name": "Student"},
            {"id": 56, "email": "user@example.com", "is_active": True, "role_name": "Student"},
        ])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "NORMALIZED_EMAIL_CONFLICT")
        self.assertIn("rollback", events)

    def test_non_admin_cannot_preauthorize(self):
        db_cursor = Mock()
        with patch("Server.webapp.utils.auth_decorators.get_current_user", return_value=STUDENT), patch(
            "Server.webapp.routes.admin_users_routes.db_cursor", db_cursor,
        ):
            response = self.client.post("/api/admin/users", json={"fullName": "Known", "email": "known@example.com", "role": "Student"})
        self.assertEqual(response.status_code, 403)
        db_cursor.assert_not_called()

    def _patch_access(self, rows, requested_active, user=ADMIN, session_rowcount=2):
        cursor = FakeCursor(rows, session_rowcount=session_rowcount)
        events = []
        with patch("Server.webapp.utils.auth_decorators.get_current_user", return_value=user), patch(
            "Server.webapp.routes.admin_users_routes.db_cursor",
            return_value=FakeDbCursor(cursor, events),
        ):
            response = self.client.patch("/api/admin/users/42/access", json={"isActive": requested_active})
        return response, cursor, events

    def test_revoke_invalidates_sessions_atomically(self):
        target = {"id": 42, "full_name": "External", "email": "external@example.com", "is_active": True, "role_name": "Student"}
        response, cursor, events = self._patch_access([target], False, session_rowcount=3)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["user"]["isActive"])
        self.assertEqual(response.get_json()["invalidatedSessions"], 3)
        self.assertTrue(any("UPDATE sessions" in sql and "is_active = FALSE" in sql for sql, _ in cursor.calls))
        self.assertIn("commit", events)

    def test_reactivate_rejects_pending_request(self):
        target = {"id": 42, "full_name": "Pending", "email": "pending@udec.cl", "is_active": False, "role_name": "Student"}
        response, cursor, events = self._patch_access([target, {"id": 91}], True)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "USER_HAS_PENDING_ACCESS_REQUEST")
        self.assertIn("rollback", events)
        self.assertFalse(any("UPDATE users" in sql for sql, _ in cursor.calls))

    def test_reactivate_revoked_user_does_not_restore_old_sessions(self):
        target = {"id": 42, "full_name": "Revoked", "email": "revoked@example.com", "is_active": False, "role_name": "Teacher"}
        response, cursor, events = self._patch_access([target, None], True)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["user"]["isActive"])
        self.assertEqual(response.get_json()["invalidatedSessions"], 0)
        self.assertFalse(any("UPDATE sessions" in sql for sql, _ in cursor.calls))
        self.assertIn("commit", events)

    def test_admin_target_access_is_protected(self):
        target = {"id": 42, "full_name": "Admin Two", "email": "admin2@inf.udec.cl", "is_active": True, "role_name": "Admin"}
        response, _, events = self._patch_access([target], False)
        self.assertEqual(response.status_code, 403)
        self.assertIn("rollback", events)

    def test_non_admin_cannot_revoke(self):
        db_cursor = Mock()
        with patch("Server.webapp.utils.auth_decorators.get_current_user", return_value=STUDENT), patch(
            "Server.webapp.routes.admin_users_routes.db_cursor", db_cursor,
        ):
            response = self.client.patch("/api/admin/users/42/access", json={"isActive": False})
        self.assertEqual(response.status_code, 403)
        db_cursor.assert_not_called()

if __name__ == "__main__":
    unittest.main()
