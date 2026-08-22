import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from Server.tests.plotly_test_support import ensure_plotly_importable

ensure_plotly_importable()


def _load_app_module_without_starting_queue_thread():
    module_name = "Server.webapp.app"
    if module_name in sys.modules:
        return sys.modules[module_name]

    with patch("threading.Thread.start", autospec=True, return_value=None):
        return importlib.import_module(module_name)


class MultiCppPostprocessingTests(unittest.TestCase):
    def test_graph_processing_failure_is_isolated_per_execution(self):
        app_module = _load_app_module_without_starting_queue_thread()

        graph_calls = []
        completed_calls = []
        failed_calls = []

        with tempfile.TemporaryDirectory(prefix="multi01_test_") as tmp:
            base_dir = Path(tmp)
            status_dir = base_dir / "status"
            static_dir = base_dir / "static"
            status_dir.mkdir()
            static_dir.mkdir()

            names = ["execA", "execB", "execC"]
            file_names = ["A.cpp", "B.cpp", "C.cpp"]

            for codename in names:
                (status_dir / codename).write_text(
                    "IN QUEUE",
                    encoding="utf-8",
                )

            queue_item = [
                [
                    str(base_dir / "A.cpp"),
                    str(base_dir / "B.cpp"),
                    str(base_dir / "C.cpp"),
                ],
                names,
                "-O3",
                "size",
                "1000",
                "10",
                file_names,
            ]

            def fake_read_legacy_outcome(
                codename,
                status_root,
                static_root,
            ):
                return SimpleNamespace(
                    kind="SUCCESS",
                    status_text="DONE",
                )

            def fake_persist_worker_outcome(codename, outcome):
                return {
                    "execution_state": "PROCESSING",
                    "codename": codename,
                }

            def fake_graph_results(codenames, originals, input_size):
                graph_calls.append(
                    (list(codenames), list(originals), str(input_size))
                )

                self.assertEqual(len(codenames), 1)

                codename = codenames[0]
                if codename == "execB":
                    raise RuntimeError(
                        "fallo controlado de postproceso B"
                    )

                output_dir = static_dir / codename
                output_dir.mkdir(parents=True, exist_ok=True)
                (output_dir / "CombinedResults.csv").write_text(
                    "InputSize,source\n"
                    f"1000,{originals[0]}\n",
                    encoding="utf-8",
                )

            def fake_mark_processing_failed(
                codename,
                error_code,
                error_message,
            ):
                failed_calls.append(
                    (codename, error_code, error_message)
                )

            def fake_mark_worker_completed(codename, result_path):
                completed_calls.append((codename, result_path))
                return {
                    "execution_state": "COMPLETED",
                    "state_version": 1,
                }

            patches = [
                patch.object(app_module, "BASE_DIR", str(base_dir)),
                patch.object(app_module, "STATUS_DIR", str(status_dir)),
                patch.object(app_module, "STATIC_DIR", str(static_dir)),
                patch.object(app_module, "queuelist", [queue_item]),
                patch.object(
                    app_module,
                    "mark_worker_started",
                    lambda codename: None,
                ),
                patch.object(
                    app_module,
                    "slave_serve",
                    lambda *args, **kwargs: None,
                ),
                patch.object(
                    app_module,
                    "read_legacy_outcome",
                    fake_read_legacy_outcome,
                ),
                patch.object(
                    app_module,
                    "persist_worker_outcome",
                    fake_persist_worker_outcome,
                ),
                patch.object(
                    app_module,
                    "graph_results",
                    fake_graph_results,
                ),
                patch.object(
                    app_module,
                    "mark_processing_failed",
                    fake_mark_processing_failed,
                ),
                patch.object(
                    app_module,
                    "mark_worker_completed",
                    fake_mark_worker_completed,
                ),
                patch.object(
                    app_module,
                    "escribir_estado",
                    lambda *args, **kwargs: None,
                ),
                patch.object(
                    app_module,
                    "get_execution_context",
                    lambda codename: {"submission_id": 777},
                ),
                patch.object(
                    app_module,
                    "update_submission_status",
                    lambda *args, **kwargs: None,
                ),
                patch.object(
                    app_module,
                    "sync_submission_terminal_status",
                    lambda *args, **kwargs: None,
                ),
            ]

            for current_patch in patches:
                current_patch.start()

            try:
                app_module.serve_next_inline()
            finally:
                for current_patch in reversed(patches):
                    current_patch.stop()

            self.assertEqual(
                graph_calls,
                [
                    (["execA"], ["A.cpp"], "1000"),
                    (["execB"], ["B.cpp"], "1000"),
                    (["execC"], ["C.cpp"], "1000"),
                ],
            )

            self.assertEqual(
                [row[0] for row in completed_calls],
                ["execA", "execC"],
            )
            self.assertEqual(
                [(row[0], row[1]) for row in failed_calls],
                [("execB", "GRAPH_PROCESSING_ERROR")],
            )

            paths_by_codename = dict(completed_calls)
            self.assertEqual(
                paths_by_codename["execA"],
                os.path.join(
                    "static",
                    "execA",
                    "CombinedResults.csv",
                ),
            )
            self.assertEqual(
                paths_by_codename["execC"],
                os.path.join(
                    "static",
                    "execC",
                    "CombinedResults.csv",
                ),
            )
            self.assertNotEqual(
                paths_by_codename["execA"],
                paths_by_codename["execC"],
            )

            self.assertTrue(
                (
                    static_dir
                    / "execA"
                    / "CombinedResults.csv"
                ).is_file()
            )
            self.assertFalse(
                (
                    static_dir
                    / "execB"
                    / "CombinedResults.csv"
                ).exists()
            )
            self.assertTrue(
                (
                    static_dir
                    / "execC"
                    / "CombinedResults.csv"
                ).is_file()
            )


if __name__ == "__main__":
    unittest.main()
