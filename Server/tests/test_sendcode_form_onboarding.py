import io
import importlib
import os
import sys
import tempfile
import unittest
from contextlib import ExitStack
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

from Server.webapp.services.execution_creation_service import (
    normalize_submission_note,
)


# /sendcode no utiliza el postproceso científico ni sockets durante estos
# tests. Se aíslan esos módulos legacy para no convertir Plotly en una
# dependencia accidental de una prueba dirigida del contrato HTTP.
data_processing_stub = ModuleType("Server.webapp.dataProcessing")
socket_utils_stub = ModuleType("Server.webapp.socketUtils")
socket_utils_stub.escribir_estado = lambda *_args, **_kwargs: None

with patch.dict(
    sys.modules,
    {
        "Server.webapp.dataProcessing": data_processing_stub,
        "Server.webapp.socketUtils": socket_utils_stub,
    },
):
    app_module = importlib.import_module("Server.webapp.app")


CURRENT_USER = {
    "id": 7,
    "email": "student@inf.udec.cl",
    "role_name": "Student",
}
MISSING = object()


class SendcodeFormOnboardingTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)

        self.test_dir = os.path.join(self.tempdir.name, "test")
        self.status_dir = os.path.join(self.tempdir.name, "status")
        self.static_dir = os.path.join(self.tempdir.name, "static")
        self.upload_dir = os.path.join(self.tempdir.name, "uploads")
        for directory in (
            self.test_dir,
            self.status_dir,
            self.static_dir,
            self.upload_dir,
        ):
            os.makedirs(directory, exist_ok=True)

        app_module.app.config.update(
            TESTING=True,
            SECRET_KEY="test-only",
        )
        self.client = app_module.app.test_client()

        auth_patch = patch.dict(
            app_module.cap_code.__globals__,
            {"get_current_user": Mock(return_value=CURRENT_USER)},
        )
        auth_patch.start()
        self.addCleanup(auth_patch.stop)

    def _post_sendcode(self, note=MISSING):
        stored_upload = SimpleNamespace(
            stored_path=os.path.join(self.upload_dir, "internal.zip"),
            sha256="a" * 64,
            original_filename="algoritmos.zip",
            sources=[
                SimpleNamespace(
                    original_filename="src/main.cpp",
                    content="int main() { return 0; }\n",
                )
            ],
        )
        observed_normalized_notes = []

        def create_bundle(**kwargs):
            observed_normalized_notes.append(
                normalize_submission_note(kwargs.get("note"))
            )
            return {
                "submission": {"id": 81, "status": "QUEUED"},
                "executions": [
                    {
                        "public_id": "00000000-0000-0000-0000-000000000081",
                        "codename": "onboardingLCS",
                        "execution_state": "QUEUED",
                    }
                ],
            }

        form = {
            "file": (io.BytesIO(b"zip"), "algoritmos.zip"),
            "task_type": "lcs",
            "input_size": "500",
            "samples": "30",
            "course_id": "12",
            "title": "  Experimento de algoritmos  ",
        }
        if note is not MISSING:
            form["note"] = note

        queue = []
        create_mock = Mock(side_effect=create_bundle)
        remove_mock = Mock()
        update_status_mock = Mock()

        with ExitStack() as stack:
            stack.enter_context(
                patch.object(
                    app_module,
                    "store_and_inspect_zip",
                    return_value=stored_upload,
                )
            )
            stack.enter_context(
                patch.object(
                    app_module,
                    "create_submission_bundle",
                    create_mock,
                )
            )
            stack.enter_context(
                patch.object(
                    app_module,
                    "remove_stored_upload",
                    remove_mock,
                )
            )
            stack.enter_context(
                patch.object(app_module, "escribir_estado")
            )
            stack.enter_context(
                patch.object(
                    app_module,
                    "update_submission_status",
                    update_status_mock,
                )
            )
            stack.enter_context(
                patch.object(app_module, "BASE_DIR", self.tempdir.name)
            )
            stack.enter_context(
                patch.object(app_module, "UPLOAD_DIR", self.upload_dir)
            )
            stack.enter_context(
                patch.object(app_module, "TEST_DIR", self.test_dir)
            )
            stack.enter_context(
                patch.object(app_module, "STATUS_DIR", self.status_dir)
            )
            stack.enter_context(
                patch.object(app_module, "STATIC_DIR", self.static_dir)
            )
            stack.enter_context(
                patch.object(app_module, "queuelist", queue)
            )

            response = self.client.post(
                "/sendcode",
                data=form,
                content_type="multipart/form-data",
            )

        return {
            "response": response,
            "create": create_mock,
            "remove": remove_mock,
            "update_status": update_status_mock,
            "queue": queue,
            "normalized_notes": observed_normalized_notes,
        }

    def test_note_absent_keeps_single_transactional_creation(self):
        result = self._post_sendcode()

        self.assertEqual(result["response"].status_code, 202)
        result["create"].assert_called_once()
        self.assertIsNone(result["create"].call_args.kwargs["note"])
        self.assertEqual(result["normalized_notes"], [None])
        self.assertEqual(len(result["queue"]), 1)
        result["update_status"].assert_not_called()

    def test_valid_note_reaches_creation_and_existing_normalizer(self):
        result = self._post_sendcode("  Comparar con la versión base  ")

        self.assertEqual(result["response"].status_code, 202)
        self.assertEqual(
            result["create"].call_args.kwargs["note"],
            "  Comparar con la versión base  ",
        )
        self.assertEqual(
            result["normalized_notes"],
            ["Comparar con la versión base"],
        )

    def test_blank_note_is_normalized_to_null(self):
        result = self._post_sendcode("   \t  ")

        self.assertEqual(result["response"].status_code, 202)
        self.assertEqual(result["normalized_notes"], [None])

    def test_note_over_500_is_rejected_before_queue_side_effects(self):
        result = self._post_sendcode("n" * 501)

        self.assertEqual(result["response"].status_code, 400)
        self.assertEqual(
            result["response"].get_json()["error"]["code"],
            "VALIDATION_ERROR",
        )
        result["create"].assert_called_once()
        result["remove"].assert_called_once()
        self.assertEqual(result["queue"], [])
        result["update_status"].assert_not_called()

    def test_course_title_and_original_filename_contract_do_not_regress(self):
        result = self._post_sendcode("Nota válida")
        kwargs = result["create"].call_args.kwargs

        self.assertEqual(result["response"].status_code, 202)
        self.assertEqual(kwargs["course_id"], "12")
        self.assertEqual(kwargs["title"], "Experimento de algoritmos")
        self.assertEqual(kwargs["original_filename"], "algoritmos.zip")
        self.assertEqual(
            kwargs["source_specs"],
            [{"original_filename": "src/main.cpp"}],
        )
        result["create"].assert_called_once()


if __name__ == "__main__":
    unittest.main()
