from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from flask import Flask

from Server.webapp.routes.export_routes import export_bp
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


class ExportRoutesTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server_root = Path(self.temp_dir.name) / "Server"
        self.uploads_root = self.server_root / "uploads"
        self.static_root = self.server_root / "webapp" / "static"
        self.result_dir = self.static_root / "exec70SIZE"
        self.uploads_root.mkdir(parents=True)
        self.result_dir.mkdir(parents=True)

        self.source_bytes = b"int main() {\r\n  return 0;\r\n}\r\n"
        self.csv_bytes = b"InputSize,Time\r\n100,1.25\r\n"
        self.archive_bytes = make_zip(
            [("nested/source.cpp", self.source_bytes)]
        )
        (self.uploads_root / "internal-uuid.zip").write_bytes(
            self.archive_bytes
        )
        (self.result_dir / "CombinedResults.csv").write_bytes(
            self.csv_bytes
        )

        self.access_row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70SIZE",
            "execution_state": "COMPLETED",
            "result_available": True,
            "result_path": "webapp/static/exec70SIZE/CombinedResults.csv",
            "hardware_snapshot": {},
            "submission_id": 134,
            "owner_user_id": OWNER["id"],
            "course_id": 10,
            "course_teacher_user_id": ASSIGNED_TEACHER["id"],
        }
        self.export_row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70SIZE",
            "execution_state": "COMPLETED",
            "benchmark": "SIZE",
            "input_size": 1000,
            "samples": 10,
            "execution_profile": "QUICK",
            "execution_config": {
                "compiler_flags": "-O3",
                "original_filename": "nested/source.cpp",
                "source_index": 0,
                "measurement": {
                    "schema_version": "1.0",
                    "points": 10,
                    "samples_per_point": 10,
                    "warmup_rounds": 1,
                    "perf_scope": "process",
                    "single_event_fallback": True,
                },
            },
            "source_filename": "nested/source.cpp",
            "source_index": "0",
            "hardware_snapshot": {
                "node": {
                    "cpu_vendor": "GenuineIntel",
                    "cpu_model": "Intel Core i5-9400",
                    "architecture": "x86_64",
                    "logical_cpus": 6,
                },
                "measurement": {
                    "backend": "perf",
                    "perf_version": "perf version 6.8",
                    "requested_perf_scope": "process",
                    "perf_event_paranoid": "-1",
                },
            },
            "created_at": datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc),
            "started_at": datetime(2026, 8, 18, 10, 1, tzinfo=timezone.utc),
            "finished_at": datetime(2026, 8, 18, 10, 2, tzinfo=timezone.utc),
            "result_available": True,
            "result_path": "webapp/static/exec70SIZE/CombinedResults.csv",
            "submission_id": 134,
            "submission_title": "Ordenamiento reproducible",
            "archive_file_path": "uploads/internal-uuid.zip",
            "archive_original_filename": None,
            "archive_sha256": hashlib.sha256(self.archive_bytes).hexdigest(),
            "file_path": "/private/archive.zip",
            "log_path": "/private/log.txt",
            "note": "private note",
            "is_pinned": True,
            "owner_email": "owner@example.test",
        }

        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(export_bp)

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
        access_row=None,
        export_row=None,
    ):
        selected_access_row = self.access_row if access_row is None else access_row
        selected_export_row = self.export_row if export_row is None else export_row
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
                    return_value=selected_access_row,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.export_routes.export_repository."
                    "get_execution_export_row_by_codename",
                    return_value=selected_export_row,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.services.source_provenance_service.SERVER_ROOT",
                    self.server_root,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.services.result_artifact_service.SERVER_ROOT",
                    self.server_root,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.services.result_artifact_service.STATIC_ROOT",
                    self.static_root,
                )
            )
            return self.client.get(path)

    def test_owner_gets_all_exports_with_exact_names_bytes_and_no_store(self):
        manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest",
        )
        manifest_download = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest/download",
        )
        csv_download = self._request(
            OWNER,
            "/api/executions/exec70SIZE/measurements/download",
        )
        bundle = self._request(
            OWNER,
            "/api/executions/exec70SIZE/bundle",
        )

        for response in (manifest, manifest_download, csv_download, bundle):
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["Cache-Control"], "no-store")

        payload = manifest.get_json()
        self.assertEqual(payload["execution"]["publicId"], self.export_row["public_id"])
        self.assertEqual(payload["execution"]["codename"], "exec70SIZE")
        self.assertEqual(json.loads(manifest_download.data), payload)
        self.assertTrue(manifest_download.data.endswith(b"\n"))
        self.assertIn(
            "filename=performance-system-exec70SIZE-manifest.json",
            manifest_download.headers["Content-Disposition"],
        )
        self.assertEqual(csv_download.data, self.csv_bytes)
        self.assertIn(
            "filename=performance-system-exec70SIZE.csv",
            csv_download.headers["Content-Disposition"],
        )
        self.assertIn(
            "filename=performance-system-exec70SIZE-bundle.zip",
            bundle.headers["Content-Disposition"],
        )
        with zipfile.ZipFile(BytesIO(bundle.data), "r") as archive:
            self.assertEqual(
                archive.namelist(),
                [
                    "manifest.json",
                    "CombinedResults.csv",
                    "source/source.cpp",
                ],
            )

    def test_teacher_and_admin_can_download_manifest_csv_and_bundle(self):
        paths = (
            "/api/executions/exec70SIZE/manifest",
            "/api/executions/exec70SIZE/manifest/download",
            "/api/executions/exec70SIZE/measurements/download",
            "/api/executions/exec70SIZE/bundle",
        )
        for user in (ASSIGNED_TEACHER, ADMIN):
            for path in paths:
                with self.subTest(user=user["role_name"], path=path):
                    self.assertEqual(self._request(user, path).status_code, 200)

    def test_foreign_and_course_less_teachers_are_forbidden(self):
        foreign = self._request(
            FOREIGN_TEACHER,
            "/api/executions/exec70SIZE/manifest",
        )
        self.assertEqual(foreign.status_code, 403)

        course_less = dict(
            self.access_row,
            course_id=None,
            course_teacher_user_id=None,
        )
        response = self._request(
            ASSIGNED_TEACHER,
            "/api/executions/exec70SIZE/bundle",
            access_row=course_less,
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_and_invalid_codename_are_rejected(self):
        unauthenticated = self._request(
            None,
            "/api/executions/exec70SIZE/manifest",
        )
        invalid = self._request(
            OWNER,
            "/api/executions/bad!id/manifest",
        )
        self.assertEqual(unauthenticated.status_code, 401)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(
            invalid.get_json()["error"]["code"],
            "INVALID_EXECUTION_ID",
        )

    def test_failed_execution_manifest_is_available_but_csv_and_bundle_are_not(self):
        failed_row = dict(
            self.export_row,
            execution_state="FAILED",
            result_available=False,
            result_path=None,
        )
        failed_access = dict(
            self.access_row,
            execution_state="FAILED",
            result_available=False,
            result_path=None,
        )
        manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest",
            access_row=failed_access,
            export_row=failed_row,
        )
        csv_download = self._request(
            OWNER,
            "/api/executions/exec70SIZE/measurements/download",
            access_row=failed_access,
            export_row=failed_row,
        )
        bundle = self._request(
            OWNER,
            "/api/executions/exec70SIZE/bundle",
            access_row=failed_access,
            export_row=failed_row,
        )

        self.assertEqual(manifest.status_code, 200)
        self.assertEqual(manifest.get_json()["execution"]["state"], "FAILED")
        self.assertFalse(
            manifest.get_json()["artifacts"]["measurements"]["available"]
        )
        self.assertEqual(csv_download.status_code, 409)
        self.assertEqual(bundle.status_code, 409)

    def test_source_unavailable_degrades_manifest_and_denies_bundle(self):
        row = dict(self.export_row, source_filename="missing.cpp")
        manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest",
            export_row=row,
        )
        bundle = self._request(
            OWNER,
            "/api/executions/exec70SIZE/bundle",
            export_row=row,
        )
        self.assertEqual(manifest.status_code, 200)
        self.assertFalse(manifest.get_json()["source"]["available"])
        self.assertEqual(bundle.status_code, 409)
        self.assertEqual(
            bundle.get_json()["error"]["code"],
            "BUNDLE_SOURCE_UNAVAILABLE",
        )

    def test_downloads_are_byte_deterministic(self):
        first_manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest/download",
        ).data
        second_manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest/download",
        ).data
        first_bundle = self._request(
            OWNER,
            "/api/executions/exec70SIZE/bundle",
        ).data
        second_bundle = self._request(
            OWNER,
            "/api/executions/exec70SIZE/bundle",
        ).data
        self.assertEqual(first_manifest, second_manifest)
        self.assertEqual(first_bundle, second_bundle)

    def test_private_fields_and_filesystem_paths_never_reach_payload_or_errors(self):
        manifest = self._request(
            OWNER,
            "/api/executions/exec70SIZE/manifest",
        )
        unsafe_row = dict(
            self.export_row,
            result_path=str(Path(self.temp_dir.name) / "private.csv"),
        )
        error = self._request(
            OWNER,
            "/api/executions/exec70SIZE/measurements/download",
            export_row=unsafe_row,
        )
        self.assertEqual(manifest.status_code, 200)
        self.assertEqual(error.status_code, 422)

        combined = manifest.get_data(as_text=True) + error.get_data(as_text=True)
        for forbidden in (
            "file_path",
            "filePath",
            "archive_file_path",
            "result_path",
            "resultPath",
            "log_path",
            "execution_config",
            "executionConfig",
            "hardwareSnapshot",
            "private note",
            "owner@example.test",
            "internal-uuid",
            str(self.temp_dir.name),
        ):
            self.assertNotIn(forbidden, combined)


if __name__ == "__main__":
    unittest.main()
