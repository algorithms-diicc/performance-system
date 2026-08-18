import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from flask import Flask

from Server.webapp.repositories import submission_repository
from Server.webapp.routes.submissions_routes import submissions_bp


OWNER = {"id": 3, "role_name": "Student"}


def submission_row(**overrides):
    row = {
        "id": 7,
        "user_id": OWNER["id"],
        "course_id": None,
        "title": "Experimento",
        "language": "C++",
        "file_path": "uploads/internal-uuid.zip",
        "original_filename": "algoritmos.zip",
        "code_hash": "a" * 64,
        "archive_sha256": "a" * 64,
        "note": "Referencia privada",
        "is_pinned": True,
        "legacy_status": "QUEUED",
        "status": "QUEUED",
        "created_at": datetime(2026, 8, 17, tzinfo=timezone.utc),
        "course_code": None,
        "course_name": None,
        "course_year": None,
        "course_term": None,
        "last_execution_state": None,
        "last_execution_public_id": None,
        "last_execution_codename": None,
        "last_execution_at": None,
        "executions_count": 0,
    }
    row.update(overrides)
    return row


def submission_access_row(**overrides):
    row = {
        "submission_id": 7,
        "owner_user_id": OWNER["id"],
        "course_id": None,
        "course_teacher_user_id": None,
    }
    row.update(overrides)
    return row


class ScriptedCursor:
    def __init__(self, connection):
        self.connection = connection
        self.response = None

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))
        self.response = self.connection.responses.pop(0)

    def fetchone(self):
        return self.response

    def fetchall(self):
        return list(self.response)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ScriptedConnection:
    def __init__(self, responses):
        self.responses = list(responses)
        self.executed = []
        self.closed = False

    def cursor(self, cursor_factory=None):
        return ScriptedCursor(self)

    def close(self):
        self.closed = True


class TransactionConnection:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class SubmissionMetadataRoutesTests(unittest.TestCase):
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

    def _get_list(self, **row_overrides):
        row = submission_row(**row_overrides)
        conn = ScriptedConnection([{"total": 1}, [row]])
        with patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.get("/api/submissions")
        return response, conn

    def _get_detail(self, **row_overrides):
        row = submission_row(**row_overrides)
        conn = ScriptedConnection([
            submission_access_row(),
            row,
            {},
            None,
        ])
        with patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.get("/api/submissions/7")
        return response, conn

    def _patch_metadata(
        self,
        payload=None,
        *,
        row_overrides=None,
        missing=False,
        raw_body=None,
        content_type=None,
    ):
        state = submission_row(**(row_overrides or {}))
        conn = TransactionConnection()
        connection_factory = Mock(return_value=conn)

        get_mock = Mock()
        if missing:
            get_mock.side_effect = submission_repository.SubmissionNotFound(
                "missing"
            )
        else:
            get_mock.return_value = dict(state)

        def persist(_submission_id, conn=None, **updates):
            state.update(updates)
            return dict(state)

        update_mock = Mock(side_effect=persist)

        with patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            connection_factory,
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "submission_repository.get_submission",
            get_mock,
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "submission_repository.update_submission_metadata",
            update_mock,
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "submission_repository.update_submission_note",
            update_mock,
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "submission_repository.set_submission_pinned",
            update_mock,
        ):
            if raw_body is not None:
                response = self.client.patch(
                    "/api/submissions/7",
                    data=raw_body,
                    content_type=content_type,
                )
            else:
                response = self.client.patch(
                    "/api/submissions/7",
                    json=payload,
                )

        return {
            "response": response,
            "state": state,
            "connection": conn,
            "connection_factory": connection_factory,
            "get": get_mock,
            "update": update_mock,
        }

    def test_list_serializes_original_filename(self):
        response, conn = self._get_list()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["items"][0]["originalFilename"],
            "algoritmos.zip",
        )
        self.assertIn("s.original_filename", conn.executed[1][0])

    def test_list_serializes_owner_note(self):
        response, _conn = self._get_list(note="Solo para mí")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["items"][0]["note"],
            "Solo para mí",
        )

    def test_list_serializes_is_pinned(self):
        response, _conn = self._get_list(is_pinned=True)

        self.assertEqual(response.status_code, 200)
        self.assertIs(response.get_json()["items"][0]["isPinned"], True)

    def test_list_does_not_expose_internal_file_path(self):
        response, conn = self._get_list()

        item = response.get_json()["items"][0]
        self.assertNotIn("filePath", item)
        self.assertNotIn("file_path", item)
        self.assertNotIn("s.file_path", conn.executed[1][0])

    def test_detail_serializes_owner_metadata(self):
        response, conn = self._get_detail()

        self.assertEqual(response.status_code, 200)
        detail = response.get_json()["submission"]
        self.assertEqual(detail["originalFilename"], "algoritmos.zip")
        self.assertEqual(detail["note"], "Referencia privada")
        self.assertIs(detail["isPinned"], True)
        self.assertNotIn("filePath", detail)
        self.assertNotIn("s.file_path", conn.executed[0][0])

    def test_detail_handles_historical_null_metadata(self):
        response, _conn = self._get_detail(
            original_filename=None,
            note=None,
            is_pinned=False,
        )

        self.assertEqual(response.status_code, 200)
        detail = response.get_json()["submission"]
        self.assertIsNone(detail["originalFilename"])
        self.assertIsNone(detail["note"])
        self.assertIs(detail["isPinned"], False)

    def test_owner_updates_note(self):
        result = self._patch_metadata({"note": "  Nueva referencia  "})

        self.assertEqual(result["response"].status_code, 200)
        self.assertEqual(result["state"]["note"], "Nueva referencia")
        self.assertEqual(result["connection"].commits, 1)
        result["update"].assert_called_once()

    def test_owner_clears_note_with_whitespace(self):
        result = self._patch_metadata({"note": " \n\t "})

        self.assertEqual(result["response"].status_code, 200)
        self.assertIsNone(result["state"]["note"])

    def test_owner_can_set_note_to_null(self):
        result = self._patch_metadata({"note": None})

        self.assertEqual(result["response"].status_code, 200)
        self.assertIsNone(result["state"]["note"])

    def test_note_longer_than_500_characters_is_rejected(self):
        result = self._patch_metadata({"note": "n" * 501})

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_owner_pins_submission(self):
        result = self._patch_metadata(
            {"isPinned": True},
            row_overrides={"is_pinned": False},
        )

        self.assertEqual(result["response"].status_code, 200)
        self.assertIs(result["state"]["is_pinned"], True)

    def test_owner_unpins_submission(self):
        result = self._patch_metadata({"isPinned": False})

        self.assertEqual(result["response"].status_code, 200)
        self.assertIs(result["state"]["is_pinned"], False)

    def test_owner_updates_note_and_pin_together(self):
        result = self._patch_metadata(
            {"note": "Combinada", "isPinned": False}
        )

        self.assertEqual(result["response"].status_code, 200)
        payload = result["response"].get_json()
        self.assertEqual(payload["id"], 7)
        self.assertEqual(payload["originalFilename"], "algoritmos.zip")
        self.assertEqual(payload["note"], "Combinada")
        self.assertIs(payload["isPinned"], False)
        self.assertNotIn("filePath", payload)
        _args, kwargs = result["update"].call_args
        self.assertEqual(kwargs["note"], "Combinada")
        self.assertIs(kwargs["is_pinned"], False)

    def test_missing_submission_returns_404(self):
        result = self._patch_metadata({"note": "Nueva"}, missing=True)

        self.assertEqual(result["response"].status_code, 404)
        result["update"].assert_not_called()

    def test_foreign_submission_returns_403(self):
        result = self._patch_metadata(
            {"note": "Nueva"},
            row_overrides={"user_id": 99},
        )

        self.assertEqual(result["response"].status_code, 403)
        result["update"].assert_not_called()

    def test_empty_body_is_rejected(self):
        result = self._patch_metadata({})

        self.assertEqual(result["response"].status_code, 400)
        result["connection_factory"].assert_not_called()
        result["update"].assert_not_called()

    def test_unknown_field_is_rejected(self):
        result = self._patch_metadata({"userId": OWNER["id"]})

        self.assertEqual(result["response"].status_code, 400)
        self.assertEqual(
            result["response"].get_json()["error"]["fields"],
            ["userId"],
        )
        result["update"].assert_not_called()

    def test_original_filename_update_is_rejected(self):
        result = self._patch_metadata(
            {"originalFilename": "alterado.zip"}
        )

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_string_is_pinned_is_rejected(self):
        result = self._patch_metadata({"isPinned": "true"})

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_integer_is_pinned_is_rejected(self):
        result = self._patch_metadata({"isPinned": 1})

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_null_is_pinned_is_rejected(self):
        result = self._patch_metadata({"isPinned": None})

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_invalid_pin_does_not_partially_persist_valid_note(self):
        result = self._patch_metadata(
            {"note": "No debe persistir", "isPinned": "true"},
            row_overrides={"note": "Original"},
        )

        self.assertEqual(result["response"].status_code, 400)
        self.assertEqual(result["state"]["note"], "Original")
        result["connection_factory"].assert_not_called()
        result["update"].assert_not_called()

    def test_non_json_body_is_rejected(self):
        result = self._patch_metadata(
            raw_body="note=texto",
            content_type="application/x-www-form-urlencoded",
        )

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()

    def test_non_object_json_body_is_rejected(self):
        result = self._patch_metadata(
            raw_body='["note"]',
            content_type="application/json",
        )

        self.assertEqual(result["response"].status_code, 400)
        result["update"].assert_not_called()


if __name__ == "__main__":
    unittest.main()
