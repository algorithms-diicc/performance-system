import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from Server.webapp.services.execution_runner_service import (
    legacy_submission_status_from_counts,
    run_single_execution,
    sync_submission_terminal_status,
)


class FakeExecutionRepository:
    def __init__(self, counts):
        self.counts = counts
        self.calls = []

    def summarize_submission_execution_states(self, submission_id):
        self.calls.append(submission_id)
        return dict(self.counts)


class FakeSubmissionRepository:
    def __init__(self):
        self.calls = []

    def update_submission_status(self, submission_id, status):
        self.calls.append((submission_id, status))
        return {
            "id": submission_id,
            "status": status,
        }


class ExecutionRunnerTests(unittest.TestCase):
    def _base_dependencies(self, static_dir):
        calls = {
            "started": [],
            "claimed": [],
            "failed": [],
            "processing_failed": [],
            "completed": [],
            "graphs": [],
            "status": [],
        }

        def mark_started(codename):
            calls["started"].append(codename)
            return {"execution_state": "RUNNING"}

        def activate(codename, public_id):
            calls["claimed"].append((codename, public_id))
            return {"execution_state": "RUNNING"}

        def mark_failed(
            codename,
            failure_stage,
            error_code,
            error_message,
        ):
            calls["failed"].append(
                (
                    codename,
                    failure_stage,
                    error_code,
                    error_message,
                )
            )
            return {
                "execution_state": "FAILED",
                "error_code": error_code,
            }

        def persist(codename, outcome):
            return {
                "execution_state": "PROCESSING",
                "codename": codename,
            }

        def graphs(codenames, originals, input_size):
            calls["graphs"].append(
                (
                    list(codenames),
                    list(originals),
                    str(input_size),
                )
            )
            output_dir = Path(static_dir) / codenames[0]
            output_dir.mkdir(parents=True, exist_ok=True)
            (output_dir / "CombinedResults.csv").write_text(
                "InputSize,source\n1000,A.cpp\n",
                encoding="utf-8",
            )

        def processing_failed(
            codename,
            error_code,
            error_message,
        ):
            calls["processing_failed"].append(
                (codename, error_code, error_message)
            )
            return {
                "execution_state": "FAILED",
                "error_code": error_code,
            }

        def completed(codename, result_path):
            calls["completed"].append(
                (codename, result_path)
            )
            return {
                "execution_state": "COMPLETED",
                "state_version": 3,
            }

        def status_writer(codename, message, **kwargs):
            calls["status"].append(
                (codename, message, kwargs)
            )

        return calls, {
            "slave_serve_func": lambda *args, **kwargs: None,
            "status_writer_func": status_writer,
            "read_legacy_outcome_func": (
                lambda *args, **kwargs: SimpleNamespace(
                    kind="SUCCESS",
                    status_text="DONE",
                )
            ),
            "mark_worker_started_func": mark_started,
            "activate_claimed_execution_func": activate,
            "mark_worker_failed_func": mark_failed,
            "persist_worker_outcome_func": persist,
            "graph_results_func": graphs,
            "result_bundle_exists_func": (
                lambda codenames, root: (
                    Path(root)
                    / codenames[0]
                    / "CombinedResults.csv"
                ).is_file()
            ),
            "execution_result_path_func": (
                lambda codename, root: str(
                    Path(root)
                    / codename
                    / "CombinedResults.csv"
                )
            ),
            "mark_processing_failed_func": processing_failed,
            "mark_worker_completed_func": completed,
        }

    def test_successful_single_execution_completes_independently(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            status_dir = base / "status"
            static_dir = base / "static"
            source = base / "A.cpp"
            source.write_text(
                "int main(){return 0;}\n",
                encoding="utf-8",
            )

            calls, dependencies = self._base_dependencies(
                static_dir
            )

            result = run_single_execution(
                source_path=str(source),
                codename="execA",
                original_filename="A.cpp",
                input_size="1000",
                samples="10",
                status_dir=str(status_dir),
                static_dir=str(static_dir),
                base_dir=str(base),
                **dependencies,
            )

            self.assertEqual(
                result["execution_state"],
                "COMPLETED",
            )
            self.assertEqual(calls["started"], ["execA"])
            self.assertEqual(calls["claimed"], [])
            self.assertEqual(
                calls["graphs"],
                [(["execA"], ["A.cpp"], "1000")],
            )
            self.assertEqual(
                calls["completed"][0][1],
                os.path.join(
                    "static",
                    "execA",
                    "CombinedResults.csv",
                ),
            )

    def test_claimed_execution_uses_claim_activation(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            status_dir = base / "status"
            static_dir = base / "static"
            source = base / "A.cpp"
            source.write_text("x", encoding="utf-8")

            calls, dependencies = self._base_dependencies(
                static_dir
            )

            run_single_execution(
                source_path=str(source),
                codename="execA",
                original_filename="A.cpp",
                input_size=1000,
                samples=10,
                status_dir=str(status_dir),
                static_dir=str(static_dir),
                base_dir=str(base),
                already_claimed=True,
                public_id="uuid-1",
                **dependencies,
            )

            self.assertEqual(calls["started"], [])
            self.assertEqual(
                calls["claimed"],
                [("execA", "uuid-1")],
            )

    def test_graph_failure_is_terminal_for_only_that_execution(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            status_dir = base / "status"
            static_dir = base / "static"
            source = base / "A.cpp"
            source.write_text("x", encoding="utf-8")

            calls, dependencies = self._base_dependencies(
                static_dir
            )

            def fail_graph(*args, **kwargs):
                raise RuntimeError("boom")

            dependencies["graph_results_func"] = fail_graph

            result = run_single_execution(
                source_path=str(source),
                codename="execA",
                original_filename="A.cpp",
                input_size=1000,
                samples=10,
                status_dir=str(status_dir),
                static_dir=str(static_dir),
                base_dir=str(base),
                **dependencies,
            )

            self.assertEqual(
                result["execution_state"],
                "FAILED",
            )
            self.assertEqual(
                calls["processing_failed"][0][1],
                "GRAPH_PROCESSING_ERROR",
            )
            self.assertEqual(calls["completed"], [])

    def test_submission_status_waits_for_active_sibling(self):
        self.assertIsNone(
            legacy_submission_status_from_counts(
                {
                    "total": 2,
                    "queued": 1,
                    "running": 0,
                    "processing": 0,
                    "completed": 1,
                    "failed": 0,
                    "cancelled": 0,
                }
            )
        )

    def test_submission_status_finishes_only_when_all_completed(self):
        self.assertEqual(
            legacy_submission_status_from_counts(
                {
                    "total": 2,
                    "queued": 0,
                    "running": 0,
                    "processing": 0,
                    "completed": 2,
                    "failed": 0,
                    "cancelled": 0,
                }
            ),
            "finished",
        )

    def test_submission_status_is_error_after_terminal_failure(self):
        self.assertEqual(
            legacy_submission_status_from_counts(
                {
                    "total": 2,
                    "queued": 0,
                    "running": 0,
                    "processing": 0,
                    "completed": 1,
                    "failed": 1,
                    "cancelled": 0,
                }
            ),
            "ERROR",
        )

    def test_sync_does_not_update_while_submission_is_active(self):
        execution_repo = FakeExecutionRepository(
            {
                "total": 2,
                "queued": 1,
                "running": 0,
                "processing": 0,
                "completed": 1,
                "failed": 0,
                "cancelled": 0,
            }
        )
        submission_repo = FakeSubmissionRepository()

        result = sync_submission_terminal_status(
            77,
            execution_repo=execution_repo,
            submission_repo=submission_repo,
        )

        self.assertFalse(result["updated"])
        self.assertEqual(submission_repo.calls, [])

    def test_sync_updates_terminal_submission(self):
        execution_repo = FakeExecutionRepository(
            {
                "total": 2,
                "queued": 0,
                "running": 0,
                "processing": 0,
                "completed": 2,
                "failed": 0,
                "cancelled": 0,
            }
        )
        submission_repo = FakeSubmissionRepository()

        result = sync_submission_terminal_status(
            77,
            execution_repo=execution_repo,
            submission_repo=submission_repo,
        )

        self.assertTrue(result["updated"])
        self.assertEqual(
            submission_repo.calls,
            [(77, "finished")],
        )


if __name__ == "__main__":
    unittest.main()
