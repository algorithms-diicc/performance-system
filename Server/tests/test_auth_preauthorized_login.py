import unittest
from unittest.mock import patch

from Server import auth


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.calls = []
        self.closed = False

    def execute(self, statement, params=None):
        self.calls.append((statement, params))

    def fetchone(self):
        if not self.rows:
            return None
        return self.rows.pop(0)

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, rows):
        self.cursor_obj = FakeCursor(rows)
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


def user(
    user_id=10,
    email="person@example.com",
    active=True,
    role_id=2,
):
    return {
        "id": user_id,
        "full_name": "Person",
        "email": email,
        "role_id": role_id,
        "is_active": active,
    }


def claims(email, subject="google-subject"):
    return {
        "email": email,
        "name": "Person",
        "sub": subject,
    }


class PreauthorizedLoginTests(unittest.TestCase):
    def _run(self, claim_data, rows):
        conn = FakeConnection(rows)

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            result = auth.get_or_create_user_from_claims(
                claim_data
            )

        return result, conn

    def test_external_active_exact_email_is_allowed_and_normalized(self):
        target = user(
            email="external@example.com"
        )
        result, conn = self._run(
            claims("  External@Example.COM  "),
            [
                target,
                None,
                None,
                None,
            ],
        )

        self.assertEqual(result["id"], target["id"])
        self.assertEqual(conn.commits, 1)
        lookup = conn.cursor_obj.calls[0]
        self.assertIn("LOWER(email)", lookup[0])
        self.assertEqual(
            lookup[1],
            ("external@example.com",),
        )
        self.assertTrue(
            any(
                "INSERT INTO auth_identities"
                in statement
                for statement, _ in conn.cursor_obj.calls
            )
        )

    def test_external_unknown_email_fails_closed(self):
        conn = FakeConnection([None, None])

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "invitación previa",
            ):
                auth.get_or_create_user_from_claims(
                    claims("nobody@example.com")
                )

        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)

    def test_external_inactive_email_is_denied(self):
        target = user(
            email="external@example.com",
            active=False,
        )
        conn = FakeConnection([target, None])

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "deshabilitada",
            ):
                auth.get_or_create_user_from_claims(
                    claims("external@example.com")
                )

    def test_preprovisioned_inf_teacher_is_preserved(self):
        target = user(
            email="teacher@inf.udec.cl",
            role_id=3,
        )
        result, conn = self._run(
            claims("TEACHER@INF.UDEC.CL"),
            [
                target,
                None,
                None,
                None,
            ],
        )

        self.assertEqual(result["role_id"], 3)
        self.assertFalse(
            any(
                "INSERT INTO users"
                in statement
                for statement, _ in conn.cursor_obj.calls
            )
        )

    def test_udec_pending_keeps_request_flow(self):
        target = user(
            email="student@udec.cl",
            active=False,
        )
        conn = FakeConnection(
            [target, None, {"id": 91}]
        )

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "aún no ha sido aprobada",
            ):
                auth.get_or_create_user_from_claims(
                    claims("student@udec.cl")
                )

    def test_udec_revoked_without_pending_is_disabled(self):
        target = user(
            email="student@udec.cl",
            active=False,
        )
        conn = FakeConnection(
            [target, None, None]
        )

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "deshabilitada",
            ):
                auth.get_or_create_user_from_claims(
                    claims("student@udec.cl")
                )

    def test_provider_subject_cannot_move_to_other_user(self):
        target = user(
            email="external@example.com"
        )
        conn = FakeConnection(
            [
                target,
                None,
                {
                    "id": 7,
                    "user_id": 999,
                    "provider_subject":
                        "google-subject",
                },
            ]
        )

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "No fue posible vincular",
            ):
                auth.get_or_create_user_from_claims(
                    claims("external@example.com")
                )

        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)

    def test_existing_user_identity_blocks_second_subject(self):
        target = user(
            email="external@example.com"
        )
        conn = FakeConnection(
            [
                target,
                None,
                None,
                {
                    "id": 8,
                    "provider_subject":
                        "old-google-subject",
                },
            ]
        )

        with patch.object(
            auth,
            "get_connection",
            return_value=conn,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "No fue posible vincular",
            ):
                auth.get_or_create_user_from_claims(
                    claims(
                        "external@example.com",
                        "new-google-subject",
                    )
                )

    def test_business_error_code_for_external_invitation(self):
        from Server.webapp.routes.auth_routes import (
            _business_auth_error_code,
        )

        self.assertEqual(
            _business_auth_error_code(
                "El acceso externo requiere una invitación previa del administrador."
            ),
            "EXTERNAL_ACCESS_REQUIRED",
        )


if __name__ == "__main__":
    unittest.main()
