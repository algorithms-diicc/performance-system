from contextlib import ExitStack
import hashlib
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from flask import Flask

from Server.webapp.routes.trace_routes import trace_bp
from Server.webapp.utils.api_errors import APIError


OWNER = {"id": 3, "role_name": "Student"}
ASSIGNED_TEACHER = {"id": 20, "role_name": "Teacher"}
FOREIGN_TEACHER = {"id": 21, "role_name": "Teacher"}
ADMIN = {"id": 99, "role_name": "Admin"}


def make_zip(entries):
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    return output.getvalue()


class TraceRoutesTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server_root = Path(self.temp_dir.name) / "Server"
        self.uploads_root = self.server_root / "uploads"
        self.uploads_root.mkdir(parents=True)
        self.raw_source = b"\xef\xbb\xbfint main() {\r\n  return 0;\r\n}\r\n"
        self.archive_bytes = make_zip(
            [
                ("first.cpp", b"first\n"),
                ("nested/source.cpp", self.raw_source),
            ]
        )
        (self.uploads_root / "internal-uuid.zip").write_bytes(
            self.archive_bytes
        )

        self.access_row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70LCS",
            "execution_state": "COMPLETED",
            "submission_id": 7,
            "owner_user_id": OWNER["id"],
            "course_id": 10,
            "course_teacher_user_id": ASSIGNED_TEACHER["id"],
        }
        self.submission_access_row = {
            "submission_id": 7,
            "owner_user_id": OWNER["id"],
            "course_id": 10,
            "course_teacher_user_id": ASSIGNED_TEACHER["id"],
        }
        self.provenance_row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70LCS",
            "execution_state": "COMPLETED",
            "source_filename": "nested/source.cpp",
            "source_index": "1",
            "submission_id": 7,
            "submission_title": "Experimento",
            "archive_file_path": "uploads/internal-uuid.zip",
            "archive_original_filename": None,
            "archive_sha256": hashlib.sha256(self.archive_bytes).hexdigest(),
            "result_path": "/private/result.csv",
            "log_path": "/private/log.txt",
            "execution_config": {"private": True},
            "hardware_snapshot": {"private": True},
            "note": "private note",
            "is_pinned": True,
            "owner_email": "owner@example.test",
            "owner_name": "Private Owner",
        }
        self.siblings = [
            {
                "execution_id": 70,
                "public_id": "00000000-0000-0000-0000-000000000070",
                "codename": "exec70LCS",
                "execution_state": "COMPLETED",
                "source_filename": "nested/source.cpp",
                "source_index": "1",
            },
            {
                "execution_id": 60,
                "public_id": "00000000-0000-0000-0000-000000000060",
                "codename": "exec60LCS",
                "execution_state": "FAILED",
                "source_filename": "first.cpp",
                "source_index": "0",
            },
        ]
        self.archive_row = {
            "submission_id": 7,
            "submission_title": "Experimento",
            "archive_file_path": "uploads/internal-uuid.zip",
            "archive_original_filename": None,
            "archive_sha256": hashlib.sha256(self.archive_bytes).hexdigest(),
        }

        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(trace_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _request(
        self,
        user,
        path,
        *,
        execution_access=None,
        submission_access=None,
        provenance=None,
        siblings=None,
        archive_row=None,
    ):
        if execution_access is None:
            execution_access = self.access_row
        if submission_access is None:
            submission_access = self.submission_access_row
        if provenance is None:
            provenance = self.provenance_row
        if siblings is None:
            siblings = self.siblings
        if archive_row is None:
            archive_row = self.archive_row

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators.get_current_user",
                    return_value=user,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.repositories.execution_access_repository."
                    "get_execution_access_row_by_codename",
                    return_value=execution_access,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.repositories.submission_access_repository."
                    "get_submission_access_row_by_id",
                    return_value=submission_access,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.trace_routes.trace_repository."
                    "get_execution_provenance_by_codename",
                    return_value=provenance,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.trace_routes.trace_repository."
                    "list_submission_sources",
                    return_value=siblings,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.trace_routes.trace_repository."
                    "get_submission_archive_by_id",
                    return_value=archive_row,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.services.source_provenance_service.SERVER_ROOT",
                    self.server_root,
                )
            )
            return self.client.get(path)

    def test_owner_can_trace_view_and_download_exact_source_and_archive(self):
        trace = self._request(OWNER, "/api/executions/exec70LCS/trace")
        source = self._request(OWNER, "/api/executions/exec70LCS/source")
        source_download = self._request(
            OWNER,
            "/api/executions/exec70LCS/source/download",
        )
        archive_download = self._request(
            OWNER,
            "/api/submissions/7/archive",
        )

        self.assertEqual(trace.status_code, 200)
        trace_payload = trace.get_json()
        self.assertTrue(trace_payload["permissions"]["canDownloadArchive"])
        self.assertEqual(trace_payload["submission"]["archive"]["integrity"], "verified")
        self.assertIsNone(
            trace_payload["submission"]["archive"]["originalFilename"]
        )
        self.assertEqual(
            [item["sourceIndex"] for item in trace_payload["sources"]],
            [0, 1],
        )
        self.assertEqual(
            sum(item["isCurrent"] for item in trace_payload["sources"]),
            1,
        )

        self.assertEqual(source.status_code, 200)
        self.assertEqual(source.get_json()["source"]["content"].encode("utf-8"), self.raw_source)
        self.assertEqual(source_download.status_code, 200)
        self.assertEqual(source_download.data, self.raw_source)
        self.assertTrue(
            source_download.headers["Content-Type"].startswith(
                "text/x-c++src"
            )
        )
        self.assertIn(
            "filename=source.cpp",
            source_download.headers["Content-Disposition"],
        )
        self.assertEqual(source_download.headers["Cache-Control"], "no-store")

        self.assertEqual(archive_download.status_code, 200)
        self.assertEqual(archive_download.data, self.archive_bytes)
        self.assertIn(
            "filename=submission-7.zip",
            archive_download.headers["Content-Disposition"],
        )
        self.assertNotIn(
            "internal-uuid",
            archive_download.headers["Content-Disposition"],
        )

    def test_v2_c_source_download_uses_c_mime_and_filename(self):
        raw_source = b"int main(void) { return 0; }\n"
        archive_bytes = make_zip([("nested/source.c", raw_source)])
        (self.uploads_root / "internal-uuid.zip").write_bytes(
            archive_bytes
        )
        provenance = {
            **self.provenance_row,
            "source_filename": "nested/source.c",
            "source_index": "0",
            "source_contract_version": "2",
            "source_language": "C",
            "compiler": "gcc",
            "compiler_flags": "-O3",
            "execution_config": {
                "source_contract_version": 2,
                "source_language": "C",
                "compiler": "gcc",
                "compiler_flags": "-O3",
                "original_filename": "nested/source.c",
            },
            "archive_sha256": hashlib.sha256(archive_bytes).hexdigest(),
        }
        siblings = [
            {
                key: provenance.get(key)
                for key in (
                    "execution_id",
                    "public_id",
                    "codename",
                    "execution_state",
                    "source_filename",
                    "source_index",
                    "source_contract_version",
                    "source_language",
                    "compiler",
                    "compiler_flags",
                )
            }
        ]

        trace = self._request(
            OWNER,
            "/api/executions/exec70LCS/trace",
            provenance=provenance,
            siblings=siblings,
        )
        download = self._request(
            OWNER,
            "/api/executions/exec70LCS/source/download",
            provenance=provenance,
            siblings=siblings,
        )

        self.assertEqual(trace.status_code, 200)
        self.assertEqual(
            trace.get_json()["execution"]["source"]["language"],
            "C",
        )
        self.assertEqual(
            trace.get_json()["execution"]["source"]["metadataProvenance"],
            "explicit",
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.data, raw_source)
        self.assertTrue(
            download.headers["Content-Type"].startswith("text/x-csrc")
        )
        self.assertIn(
            "filename=source.c",
            download.headers["Content-Disposition"],
        )

    def test_assigned_teacher_can_use_source_endpoints_but_not_archive(self):
        for path in (
            "/api/executions/exec70LCS/trace",
            "/api/executions/exec70LCS/source",
            "/api/executions/exec70LCS/source/download",
        ):
            with self.subTest(path=path):
                response = self._request(ASSIGNED_TEACHER, path)
                self.assertEqual(response.status_code, 200)

        trace = self._request(
            ASSIGNED_TEACHER,
            "/api/executions/exec70LCS/trace",
        )
        self.assertFalse(
            trace.get_json()["permissions"]["canDownloadArchive"]
        )
        archive = self._request(
            ASSIGNED_TEACHER,
            "/api/submissions/7/archive",
        )
        self.assertEqual(archive.status_code, 403)

    def test_non_owner_admin_can_use_source_endpoints_but_not_archive(self):
        for path in (
            "/api/executions/exec70LCS/trace",
            "/api/executions/exec70LCS/source",
            "/api/executions/exec70LCS/source/download",
        ):
            with self.subTest(path=path):
                response = self._request(ADMIN, path)
                self.assertEqual(response.status_code, 200)

        archive = self._request(ADMIN, "/api/submissions/7/archive")
        self.assertEqual(archive.status_code, 403)

    def test_foreign_and_course_less_teachers_are_forbidden(self):
        foreign = self._request(
            FOREIGN_TEACHER,
            "/api/executions/exec70LCS/trace",
        )
        self.assertEqual(foreign.status_code, 403)

        course_less_access = dict(
            self.access_row,
            course_id=None,
            course_teacher_user_id=None,
        )
        course_less = self._request(
            ASSIGNED_TEACHER,
            "/api/executions/exec70LCS/source",
            execution_access=course_less_access,
        )
        self.assertEqual(course_less.status_code, 403)

    def test_trace_contract_excludes_internal_and_private_fields(self):
        response = self._request(OWNER, "/api/executions/exec70LCS/trace")
        self.assertEqual(response.status_code, 200)
        serialized = json.dumps(response.get_json())
        for forbidden in (
            "file_path",
            "filePath",
            "internal-uuid",
            "result_path",
            "resultPath",
            "log_path",
            "execution_config",
            "executionConfig",
            "hardware_snapshot",
            "hardwareSnapshot",
            "private note",
            "isPinned",
            "owner@example.test",
            "Private Owner",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_missing_archive_degrades_trace_and_denies_source(self):
        row = dict(
            self.provenance_row,
            archive_file_path="uploads/missing.zip",
        )
        trace = self._request(
            OWNER,
            "/api/executions/exec70LCS/trace",
            provenance=row,
        )
        source = self._request(
            OWNER,
            "/api/executions/exec70LCS/source",
            provenance=row,
        )

        self.assertEqual(trace.status_code, 200)
        self.assertEqual(
            trace.get_json()["submission"]["archive"]["integrity"],
            "unavailable",
        )
        self.assertFalse(
            trace.get_json()["execution"]["source"]["available"]
        )
        self.assertEqual(source.status_code, 404)

    def test_unverified_and_mismatched_archive_never_return_source(self):
        cases = (
            (None, "unverified", 409),
            ("0" * 64, "mismatch", 409),
        )
        for archive_sha256, integrity, expected_status in cases:
            with self.subTest(integrity=integrity):
                row = dict(
                    self.provenance_row,
                    archive_sha256=archive_sha256,
                )
                trace = self._request(
                    OWNER,
                    "/api/executions/exec70LCS/trace",
                    provenance=row,
                )
                download = self._request(
                    OWNER,
                    "/api/executions/exec70LCS/source/download",
                    provenance=row,
                )
                self.assertEqual(trace.status_code, 200)
                self.assertEqual(
                    trace.get_json()["submission"]["archive"]["integrity"],
                    integrity,
                )
                self.assertEqual(download.status_code, expected_status)
                self.assertNotEqual(download.data, self.raw_source)

    def test_unsafe_archive_and_source_references_are_sanitized(self):
        unsafe_rows = (
            dict(
                self.provenance_row,
                archive_file_path="uploads/../../secret.zip",
            ),
            dict(
                self.provenance_row,
                archive_file_path=str(Path(self.temp_dir.name) / "secret.zip"),
            ),
            dict(
                self.provenance_row,
                source_filename="../../secret.cpp",
            ),
            dict(
                self.provenance_row,
                source_filename="/private/secret.cpp",
            ),
        )
        for row in unsafe_rows:
            with self.subTest(row=row):
                response = self._request(
                    OWNER,
                    "/api/executions/exec70LCS/source",
                    provenance=row,
                )
                self.assertEqual(response.status_code, 422)
                body = response.get_data(as_text=True)
                self.assertNotIn(str(self.temp_dir.name), body)
                self.assertNotIn("secret.zip", body)
                self.assertNotIn("secret.cpp", body)

    def test_missing_zip_member_is_a_sanitized_not_found(self):
        row = dict(self.provenance_row, source_filename="missing.cpp")
        response = self._request(
            OWNER,
            "/api/executions/exec70LCS/source",
            provenance=row,
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "SOURCE_NOT_FOUND")
        self.assertNotIn(str(self.temp_dir.name), response.get_data(as_text=True))

    def test_invalid_codename_and_unauthenticated_request_are_rejected(self):
        invalid = self._request(
            OWNER,
            "/api/executions/bad!id/trace",
        )
        unauthenticated = self._request(
            None,
            "/api/executions/exec70LCS/trace",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(
            invalid.get_json()["error"]["code"],
            "INVALID_EXECUTION_ID",
        )
        self.assertEqual(unauthenticated.status_code, 401)


if __name__ == "__main__":
    unittest.main()
