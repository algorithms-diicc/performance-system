
import json
import tempfile
import unittest
from pathlib import Path

from Server.webapp.services.execution_pipeline_service import (
    classify_status_text,
    combined_result_path,
    execution_result_path,
    map_worker_error,
    read_legacy_outcome,
    result_bundle_exists,
)

class ExecutionPipelineServiceTests(unittest.TestCase):
    def test_done_is_success(self):
        self.assertEqual(classify_status_text("DONE").kind, "SUCCESS")

    def test_in_queue_is_pending(self):
        self.assertEqual(classify_status_text("IN QUEUE").kind, "PENDING")

    def test_compile_error_mapping(self):
        f = map_worker_error(100)
        self.assertEqual((f.failure_stage, f.error_code), ("COMPILATION", "COMPILE_ERROR"))

    def test_timeout_mapping(self):
        f = map_worker_error(200)
        self.assertEqual((f.failure_stage, f.error_code), ("EXECUTION", "EXECUTION_TIMEOUT"))

    def test_csv_error_mapping(self):
        f = map_worker_error(300)
        self.assertEqual((f.failure_stage, f.error_code), ("MEASUREMENT", "RESULT_CSV_MISSING"))

    def test_execution_error_mapping(self):
        f = map_worker_error(400)
        self.assertEqual((f.failure_stage, f.error_code), ("EXECUTION", "EXECUTION_ERROR"))

    def test_unknown_worker_error(self):
        self.assertEqual(map_worker_error(999).error_code, "UNKNOWN_WORKER_ERROR")

    def test_no_machine_is_infrastructure_failure(self):
        o = classify_status_text("ERROR: no machines available")
        self.assertEqual((o.kind, o.failure.failure_stage), ("FAILED", "INFRASTRUCTURE"))

    def test_master_wait_timeout(self):
        o = classify_status_text("ERROR: timeout exceeded")
        self.assertEqual(o.failure.error_code, "MASTER_WAIT_TIMEOUT")

    def test_worker_error_code_drives_failure_classification(self):
        o = classify_status_text("ERROR: compilación", worker_error_code=100)
        self.assertEqual(o.failure.error_code, "COMPILE_ERROR")

    def test_read_outcome_uses_sidecar_error_code(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            status_dir = root / "status"
            static_dir = root / "static"
            status_dir.mkdir()
            static_dir.mkdir()
            codename = "abcLCS"
            (status_dir / codename).write_text("ERROR: compilación", encoding="utf-8")
            (static_dir / (codename + "_status.json")).write_text(
                json.dumps({"status": "ERROR", "error_code": 100}),
                encoding="utf-8",
            )
            o = read_legacy_outcome(codename, status_dir, static_dir)
            self.assertEqual(o.failure.error_code, "COMPILE_ERROR")

    def test_stale_sidecar_does_not_override_done(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            status_dir = root / "status"
            static_dir = root / "static"
            status_dir.mkdir()
            static_dir.mkdir()
            codename = "abcLCS"
            (status_dir / codename).write_text("DONE", encoding="utf-8")
            (static_dir / (codename + "_status.json")).write_text(
                json.dumps({"status": "IN QUEUE"}),
                encoding="utf-8",
            )
            o = read_legacy_outcome(codename, status_dir, static_dir)
            self.assertEqual(o.kind, "SUCCESS")

    def test_execution_result_path_is_independent_per_execution(self):
        first = execution_result_path("firstLCS", "/tmp/static")
        second = execution_result_path("secondLCS", "/tmp/static")

        self.assertEqual(
            first,
            "/tmp/static/firstLCS/CombinedResults.csv",
        )
        self.assertEqual(
            second,
            "/tmp/static/secondLCS/CombinedResults.csv",
        )
        self.assertNotEqual(first, second)

    def test_combined_result_path_accepts_single_execution(self):
        p = combined_result_path(["firstLCS"], "/tmp/static")
        self.assertEqual(
            p,
            "/tmp/static/firstLCS/CombinedResults.csv",
        )

    def test_combined_result_path_rejects_multi_execution_bundle(self):
        with self.assertRaises(ValueError):
            combined_result_path(
                ["firstLCS", "secondLCS"],
                "/tmp/static",
            )

    def test_result_bundle_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "abcLCS" / "CombinedResults.csv"
            p.parent.mkdir()
            p.write_text("InputSize\\n500\\n", encoding="utf-8")
            self.assertTrue(result_bundle_exists(["abcLCS"], tmp))