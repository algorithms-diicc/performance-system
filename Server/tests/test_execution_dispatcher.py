import unittest

from Server.tests.plotly_test_support import ensure_plotly_importable

ensure_plotly_importable()

from Server import execution_dispatcher as dispatcher


class FakeSubmissionRepository:
    def __init__(self):
        self.calls = []

    def get_submission(self, submission_id):
        self.calls.append(submission_id)
        return {
            "id": submission_id,
            "file_path": "uploads/a.zip",
            "code_hash": "a" * 64,
        }


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return dict(self.row)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeLockConnection:
    def __init__(self, row):
        self.cursor_instance = FakeCursor(row)

    def cursor(self):
        return self.cursor_instance


def execution_row():
    return {
        "public_id": "00000000-0000-0000-0000-000000000001",
        "submission_id": 77,
        "codename": "execA",
        "execution_state": "RUNNING",
        "input_size": 1000,
        "samples": 10,
        "execution_config": {
            "compiler_flags": "-O2",
            "original_filename": "A.cpp",
            "source_index": 0,
        },
    }


class ExecutionDispatcherTests(unittest.TestCase):
    def test_singleton_lock_uses_postgresql_advisory_lock(self):
        conn = FakeLockConnection({"acquired": True})

        acquired = dispatcher.acquire_singleton_lock(
            conn,
            lock_key=1234,
        )

        self.assertTrue(acquired)
        sql, params = conn.cursor_instance.executed[0]
        self.assertIn(
            "pg_try_advisory_lock",
            sql,
        )
        self.assertEqual(params, (1234,))

    def test_empty_queue_does_nothing(self):
        result = dispatcher.run_dispatch_cycle(
            claim_func=lambda: None,
        )

        self.assertFalse(result["claimed"])
        self.assertIsNone(result["execution"])

    def test_claimed_execution_is_rehydrated_and_run_once(self):
        execution = execution_row()
        submission_repo = FakeSubmissionRepository()
        calls = {
            "materialize": [],
            "runner": [],
            "sync": [],
        }

        def materialize(
            execution_arg,
            submission,
            base_dir,
            test_dir,
        ):
            calls["materialize"].append(
                (
                    execution_arg["public_id"],
                    submission["id"],
                    str(base_dir),
                    str(test_dir),
                )
            )
            return {
                "source_path": "/tmp/execA.cpp",
                "original_filename": "A.cpp",
                "source_contract_version": None,
                "source_language": "C++",
                "compiler": "g++",
                "compiler_flags": "-O2",
                "technical_extension": ".cpp",
                "metadata_provenance": "inferred_legacy_cpp",
            }

        def runner(**kwargs):
            calls["runner"].append(kwargs)
            return {
                "execution_state": "COMPLETED",
                "state_version": 3,
            }

        def sync(submission_id):
            calls["sync"].append(submission_id)
            return {
                "updated": True,
                "status": "finished",
            }

        result = dispatcher.run_dispatch_cycle(
            base_dir="/srv/Server",
            test_dir="/srv/Server/test",
            status_dir="/srv/Server/status",
            static_dir="/srv/Server/webapp/static",
            claim_func=lambda: dict(execution),
            submission_repo=submission_repo,
            materialize_func=materialize,
            runner_func=runner,
            sync_func=sync,
        )

        self.assertTrue(result["claimed"])
        self.assertEqual(result["state"], "COMPLETED")
        self.assertEqual(submission_repo.calls, [77])
        self.assertEqual(calls["sync"], [77])
        self.assertEqual(len(calls["runner"]), 1)

        runner_args = calls["runner"][0]
        self.assertTrue(runner_args["already_claimed"])
        self.assertEqual(
            runner_args["public_id"],
            execution["public_id"],
        )
        self.assertEqual(
            runner_args["opt_cmd"],
            "-O2",
        )
        self.assertIsNone(runner_args["source_contract_version"])
        self.assertEqual(runner_args["source_language"], "C++")
        self.assertEqual(runner_args["compiler"], "g++")
        self.assertEqual(runner_args["technical_extension"], ".cpp")
        self.assertEqual(
            runner_args["codename"],
            "execA",
        )

    def test_v2_c_runtime_metadata_is_forwarded_as_a_closed_tuple(self):
        execution = execution_row()
        execution["execution_config"] = {
            "source_contract_version": 2,
            "source_language": "C",
            "compiler": "gcc",
            "compiler_flags": "-O3",
            "original_filename": "A.c",
            "source_index": 0,
        }
        runner_calls = []

        def materialize(*args, **kwargs):
            return {
                "source_path": "/tmp/execA.c",
                "original_filename": "A.c",
                "source_contract_version": 2,
                "source_language": "C",
                "compiler": "gcc",
                "compiler_flags": "-O3",
                "technical_extension": ".c",
                "metadata_provenance": "explicit",
            }

        result = dispatcher.run_dispatch_cycle(
            claim_func=lambda: dict(execution),
            submission_repo=FakeSubmissionRepository(),
            materialize_func=materialize,
            runner_func=lambda **kwargs: (
                runner_calls.append(kwargs)
                or {"execution_state": "COMPLETED"}
            ),
            sync_func=lambda _submission_id: {"updated": True},
        )

        self.assertEqual(result["state"], "COMPLETED")
        self.assertEqual(runner_calls[0]["source_language"], "C")
        self.assertEqual(runner_calls[0]["compiler"], "gcc")
        self.assertEqual(runner_calls[0]["compiler_flags"], "-O3")
        self.assertEqual(runner_calls[0]["technical_extension"], ".c")

    def test_dispatch_failure_marks_execution_and_syncs_submission(self):
        execution = execution_row()
        calls = {
            "failure": [],
            "sync": [],
        }

        def materialize(*args, **kwargs):
            raise RuntimeError("broken archive")

        def failure(execution_arg, exc):
            calls["failure"].append(
                (
                    execution_arg["public_id"],
                    str(exc),
                )
            )
            return {
                "execution_state": "FAILED",
            }

        def sync(submission_id):
            calls["sync"].append(submission_id)
            return {
                "updated": True,
                "status": "ERROR",
            }

        result = dispatcher.run_dispatch_cycle(
            claim_func=lambda: dict(execution),
            submission_repo=FakeSubmissionRepository(),
            materialize_func=materialize,
            runner_func=lambda **kwargs: None,
            sync_func=sync,
            failure_func=failure,
        )

        self.assertTrue(result["claimed"])
        self.assertEqual(result["state"], "FAILED")
        self.assertIn(
            "broken archive",
            result["error"],
        )
        self.assertEqual(len(calls["failure"]), 1)
        self.assertEqual(calls["sync"], [77])

    def test_submission_sync_failure_does_not_reclassify_completed_execution(self):
        execution = execution_row()

        def materialize(*args, **kwargs):
            return {
                "source_path": "/tmp/execA.cpp",
                "original_filename": "A.cpp",
                "source_contract_version": None,
                "source_language": "C++",
                "compiler": "g++",
                "compiler_flags": "-O2",
                "technical_extension": ".cpp",
                "metadata_provenance": "inferred_legacy_cpp",
            }

        def runner(**kwargs):
            return {
                "execution_state": "COMPLETED",
                "state_version": 3,
            }

        def sync(submission_id):
            raise RuntimeError("sync unavailable")

        result = dispatcher.run_dispatch_cycle(
            claim_func=lambda: dict(execution),
            submission_repo=FakeSubmissionRepository(),
            materialize_func=materialize,
            runner_func=runner,
            sync_func=sync,
        )

        self.assertEqual(result["state"], "COMPLETED")
        self.assertFalse(
            result["submissionSync"]["updated"]
        )
        self.assertIn(
            "sync unavailable",
            result["submissionSync"]["error"],
        )

    def test_default_compiler_flags_are_safe(self):
        self.assertEqual(
            dispatcher._compiler_flags(
                {
                    "execution_config": {
                        "compiler_flags": "",
                    }
                }
            ),
            "-O3",
        )


if __name__ == "__main__":
    unittest.main()
