import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.submissions_routes import submissions_bp


OWNER = {"id": 3, "role_name": "Student"}
ASSIGNED_TEACHER = {"id": 20, "role_name": "Teacher"}
FOREIGN_TEACHER = {"id": 21, "role_name": "Teacher"}
ADMIN = {"id": 99, "role_name": "Admin"}


def access_row(**overrides):
    row = {
        "submission_id": 7,
        "owner_user_id": OWNER["id"],
        "course_id": 10,
        "course_teacher_user_id": ASSIGNED_TEACHER["id"],
    }
    row.update(overrides)
    return row


def detail_row(**overrides):
    row = {
        "id": 7,
        "course_id": 10,
        "protocol_id": 5,
        "protocol_title": "LCS laboratorio",
        "title": "Experimento",
        "language": "C/C++",
        "original_filename": "algoritmos.zip",
        "archive_sha256": "a" * 64,
        "note": "Referencia privada",
        "is_pinned": True,
        "legacy_status": "QUEUED",
        "created_at": datetime(2026, 8, 17, tzinfo=timezone.utc),
        "course_code": "INF-101",
        "course_name": "Algoritmos",
        "course_year": 2026,
        "course_term": 2,
    }
    row.update(overrides)
    return row


def repository_submission_row(**overrides):
    row = {
        "id": 7,
        "user_id": OWNER["id"],
        "course_id": 10,
        "title": "Experimento",
        "language": "C++",
        "file_path": "uploads/internal.zip",
        "original_filename": "algoritmos.zip",
        "code_hash": "a" * 64,
        "note": "Referencia privada",
        "is_pinned": True,
        "created_at": None,
        "status": "QUEUED",
    }
    row.update(overrides)
    return row


def execution_row(**overrides):
    row = {
        "execution_id": 70,
        "public_id": "00000000-0000-0000-0000-000000000070",
        "codename": "exec70LCS",
        "submission_id": 7,
        "benchmark": "LCS",
        "execution_state": "FAILED",
        "failure_stage": "COMPILATION",
        "error_code": "COMPILE_ERROR",
        "error_message": "No compila",
        "started_at": datetime(2026, 8, 17, tzinfo=timezone.utc),
        "processing_at": None,
        "finished_at": None,
        "duration_ms": 1750,
        "result_available": False,
        "original_filename": "solucion.cpp",
        "submission_title": "Experimento",
        "hardware_name": "Intel i5-9400",
        "result_path": "webapp/static/internal/CombinedResults.csv",
        "execution_config": {"secret": "internal"},
        "hardware_snapshot": {"cpu": "internal"},
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


class SubmissionDetailAccessRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(submissions_bp)
        self.client = app.test_client()

    def _request(self, user, method, path, conn, **kwargs):
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            return_value=conn,
        ):
            return self.client.open(path, method=method, **kwargs)

    def _get_detail(
        self,
        user,
        *,
        access_overrides=None,
        detail_overrides=None,
        missing=False,
    ):
        if missing:
            responses = [None]
        else:
            responses = [
                access_row(**(access_overrides or {})),
                detail_row(**(detail_overrides or {})),
                {},
                None,
            ]
        conn = ScriptedConnection(responses)
        response = self._request(
            user,
            "GET",
            "/api/submissions/7",
            conn,
        )
        return response, conn

    def _get_executions(
        self,
        user,
        *,
        access_overrides=None,
        execution_overrides=None,
        missing=False,
    ):
        if missing:
            responses = [None]
        else:
            responses = [
                access_row(**(access_overrides or {})),
                {"total": 1},
                [execution_row(**(execution_overrides or {}))],
            ]
        conn = ScriptedConnection(responses)
        response = self._request(
            user,
            "GET",
            "/api/submissions/7/executions",
            conn,
        )
        return response, conn

    def _patch_as(self, user):
        conn = ScriptedConnection([repository_submission_row()])
        response = self._request(
            user,
            "PATCH",
            "/api/submissions/7",
            conn,
            json={"note": "Intento no autorizado"},
        )
        return response, conn

    def test_owner_can_get_detail(self):
        response, _conn = self._get_detail(OWNER)

        self.assertEqual(response.status_code, 200)

    def test_assigned_teacher_can_get_detail(self):
        response, _conn = self._get_detail(ASSIGNED_TEACHER)

        self.assertEqual(response.status_code, 200)

    def test_foreign_teacher_cannot_get_detail(self):
        response, _conn = self._get_detail(FOREIGN_TEACHER)

        self.assertEqual(response.status_code, 403)

    def test_admin_can_get_detail(self):
        response, _conn = self._get_detail(ADMIN)

        self.assertEqual(response.status_code, 200)

    def test_teacher_cannot_get_course_less_detail(self):
        response, _conn = self._get_detail(
            ASSIGNED_TEACHER,
            access_overrides={
                "course_id": None,
                "course_teacher_user_id": None,
            },
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_get_course_less_detail(self):
        response, _conn = self._get_detail(
            ADMIN,
            access_overrides={
                "course_id": None,
                "course_teacher_user_id": None,
            },
            detail_overrides={
                "course_id": None,
                "course_code": None,
                "course_name": None,
                "course_year": None,
                "course_term": None,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["submission"]["course"])

    def test_missing_submission_returns_404(self):
        response, _conn = self._get_detail(OWNER, missing=True)

        self.assertEqual(response.status_code, 404)

    def test_owner_receives_private_metadata_and_permissions(self):
        response, _conn = self._get_detail(OWNER)

        payload = response.get_json()
        self.assertEqual(payload["submission"]["note"], "Referencia privada")
        self.assertIs(payload["submission"]["isPinned"], True)
        self.assertEqual(
            payload["permissions"],
            {
                "canEditMetadata": True,
                "canViewPrivateMetadata": True,
            },
        )

    def test_teacher_does_not_receive_private_metadata(self):
        response, _conn = self._get_detail(ASSIGNED_TEACHER)

        payload = response.get_json()
        self.assertNotIn("note", payload["submission"])
        self.assertNotIn("isPinned", payload["submission"])
        self.assertEqual(
            payload["permissions"],
            {
                "canEditMetadata": False,
                "canViewPrivateMetadata": False,
            },
        )

    def test_admin_does_not_receive_private_metadata(self):
        response, _conn = self._get_detail(ADMIN)

        submission = response.get_json()["submission"]
        self.assertNotIn("note", submission)
        self.assertNotIn("isPinned", submission)

    def test_detail_does_not_expose_internal_file_path(self):
        response, _conn = self._get_detail(OWNER)

        submission = response.get_json()["submission"]
        self.assertNotIn("filePath", submission)
        self.assertNotIn("file_path", submission)

    def test_detail_does_not_expose_owner_identity(self):
        response, _conn = self._get_detail(ADMIN)

        submission = response.get_json()["submission"]
        self.assertNotIn("ownerUserId", submission)
        self.assertNotIn("owner_user_id", submission)
        self.assertNotIn("email", submission)
        self.assertNotIn("fullName", submission)

    def test_detail_serializes_archive_hash_and_original_filename(self):
        response, _conn = self._get_detail(ASSIGNED_TEACHER)

        submission = response.get_json()["submission"]
        self.assertEqual(submission["archiveSha256"], "a" * 64)
        self.assertEqual(submission["originalFilename"], "algoritmos.zip")
        self.assertEqual(submission["language"], "C/C++")

    def test_detail_serializes_protocol_provenance_for_historical_record(self):
        response, _conn = self._get_detail(
            OWNER,
            detail_overrides={
                "protocol_id": 5,
                "protocol_title": "LCS laboratorio",
            },
        )

        submission = response.get_json()["submission"]
        self.assertEqual(submission["protocolId"], 5)
        self.assertEqual(
            submission["protocol"],
            {
                "id": 5,
                "title": "LCS laboratorio",
            },
        )

    def test_detail_handles_submission_without_protocol(self):
        response, _conn = self._get_detail(
            OWNER,
            detail_overrides={
                "protocol_id": None,
                "protocol_title": None,
            },
        )

        submission = response.get_json()["submission"]
        self.assertIsNone(submission["protocolId"])
        self.assertIsNone(submission["protocol"])

    def test_detail_handles_historical_null_archive_hash(self):
        response, _conn = self._get_detail(
            OWNER,
            detail_overrides={"archive_sha256": None},
        )

        self.assertIsNone(response.get_json()["submission"]["archiveSha256"])

    def test_owner_can_list_executions(self):
        response, _conn = self._get_executions(OWNER)

        self.assertEqual(response.status_code, 200)

    def test_assigned_teacher_can_list_executions(self):
        response, _conn = self._get_executions(ASSIGNED_TEACHER)

        self.assertEqual(response.status_code, 200)

    def test_foreign_teacher_cannot_list_executions(self):
        response, _conn = self._get_executions(FOREIGN_TEACHER)

        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_executions(self):
        response, _conn = self._get_executions(ADMIN)

        self.assertEqual(response.status_code, 200)

    def test_teacher_cannot_list_course_less_submission_executions(self):
        response, _conn = self._get_executions(
            ASSIGNED_TEACHER,
            access_overrides={
                "course_id": None,
                "course_teacher_user_id": None,
            },
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_course_less_submission_executions(self):
        response, _conn = self._get_executions(
            ADMIN,
            access_overrides={
                "course_id": None,
                "course_teacher_user_id": None,
            },
        )

        self.assertEqual(response.status_code, 200)

    def test_missing_submission_executions_returns_404(self):
        response, _conn = self._get_executions(OWNER, missing=True)

        self.assertEqual(response.status_code, 404)

    def test_execution_preserves_individual_original_filename(self):
        response, _conn = self._get_executions(OWNER)

        item = response.get_json()["items"][0]
        self.assertEqual(item["originalFilename"], "solucion.cpp")

    def test_execution_serializes_benchmark(self):
        response, _conn = self._get_executions(OWNER)

        self.assertEqual(response.get_json()["items"][0]["benchmark"], "LCS")

    def test_legacy_cpp_execution_exposes_public_source_identity(self):
        response, _conn = self._get_executions(OWNER)

        item = response.get_json()["items"][0]
        self.assertEqual(item["sourceLanguage"], "C++")
        self.assertEqual(item["compiler"], "g++")
        self.assertEqual(
            item["metadataProvenance"],
            "inferred_legacy_cpp",
        )

    def test_execution_keeps_duration_and_result_available(self):
        response, _conn = self._get_executions(OWNER)

        item = response.get_json()["items"][0]
        self.assertEqual(item["durationMs"], 1750)
        self.assertIs(item["resultAvailable"], False)

    def test_cancel_capability_is_owner_or_admin_and_only_while_queued(self):
        owner_response, _ = self._get_executions(
            OWNER,
            execution_overrides={"execution_state": "QUEUED"},
        )
        admin_response, _ = self._get_executions(
            ADMIN,
            execution_overrides={"execution_state": "QUEUED"},
        )
        teacher_response, _ = self._get_executions(
            ASSIGNED_TEACHER,
            execution_overrides={"execution_state": "QUEUED"},
        )
        running_response, _ = self._get_executions(
            OWNER,
            execution_overrides={"execution_state": "RUNNING"},
        )

        self.assertTrue(owner_response.get_json()["items"][0]["canCancel"])
        self.assertTrue(admin_response.get_json()["items"][0]["canCancel"])
        self.assertFalse(teacher_response.get_json()["items"][0]["canCancel"])
        self.assertFalse(running_response.get_json()["items"][0]["canCancel"])

    def test_execution_keeps_failure_contract(self):
        response, _conn = self._get_executions(OWNER)

        self.assertEqual(
            response.get_json()["items"][0]["failure"],
            {
                "stage": "COMPILATION",
                "code": "COMPILE_ERROR",
                "message": "El código no pudo compilarse correctamente.",
            },
        )

    def test_execution_does_not_expose_internal_paths_or_snapshots(self):
        response, _conn = self._get_executions(OWNER)

        item = response.get_json()["items"][0]
        self.assertNotIn("resultPath", item)
        self.assertNotIn("result_path", item)
        self.assertNotIn("executionConfig", item)
        self.assertNotIn("execution_config", item)
        self.assertNotIn("hardwareSnapshot", item)
        self.assertNotIn("hardware_snapshot", item)

    def test_assigned_teacher_cannot_patch_private_metadata(self):
        response, conn = self._patch_as(ASSIGNED_TEACHER)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(conn.executed), 1)

    def test_admin_cannot_patch_private_metadata(self):
        response, conn = self._patch_as(ADMIN)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(conn.executed), 1)

    def test_foreign_teacher_cannot_patch_private_metadata(self):
        response, conn = self._patch_as(FOREIGN_TEACHER)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(conn.executed), 1)


if __name__ == "__main__":
    unittest.main()
