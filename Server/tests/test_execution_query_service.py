import unittest
from datetime import datetime, timedelta

from Server.webapp.services.execution_query_service import (
    ExecutionSnapshotForbidden,
    ExecutionSnapshotNotFound,
    build_execution_snapshot,
)

def row(state="QUEUED"):
    t = datetime(2026, 8, 11, 1, 0, 0)
    return {
        "public_id": "11111111-1111-1111-1111-111111111111",
        "submission_id": 77,
        "submission_title": "LCS prueba",
        "owner_user_id": 5,
        "codename": "abc123LCS",
        "execution_state": state,
        "state_version": 0,
        "failure_stage": None,
        "error_code": None,
        "error_message": None,
        "created_at": t,
        "queued_at": t,
        "started_at": None,
        "processing_at": None,
        "finished_at": None,
        "updated_at": t,
        "benchmark": "LCS",
        "input_size": 500,
        "samples": 30,
        "execution_profile": "BALANCED",
        "execution_config": {"original_filename": "lcs_template.cpp"},
        "result_available": False,
        "result_path": None,
        "duration_ms": None,
        "hardware_profile_name": None,
    }

class Tests(unittest.TestCase):
    def test_not_found(self):
        with self.assertRaises(ExecutionSnapshotNotFound):
            build_execution_snapshot(None, 5)

    def test_forbidden(self):
        with self.assertRaises(ExecutionSnapshotForbidden):
            build_execution_snapshot(row(), 999)

    def test_queued(self):
        p = build_execution_snapshot(row("QUEUED"), 5)
        self.assertFalse(p["terminal"])

    def test_running(self):
        r = row("RUNNING")
        r["state_version"] = 1
        r["started_at"] = r["queued_at"] + timedelta(seconds=1)
        p = build_execution_snapshot(r, 5)
        self.assertEqual(p["stateVersion"], 1)

    def test_processing(self):
        r = row("PROCESSING")
        r["state_version"] = 2
        r["processing_at"] = r["queued_at"] + timedelta(seconds=5)
        p = build_execution_snapshot(r, 5)
        self.assertEqual(p["state"], "PROCESSING")

    def test_completed_results_url(self):
        r = row("COMPLETED")
        r["state_version"] = 3
        r["result_available"] = True
        r["result_path"] = "webapp/static/abc123LCS/CombinedResults.csv"
        p = build_execution_snapshot(r, 5)
        self.assertTrue(p["terminal"])
        self.assertTrue(p["resultAvailable"])
        self.assertEqual(p["resultsUrl"], "/api/executions/abc123LCS/results")
        self.assertNotIn("resultPath", p)

    def test_duration(self):
        r = row("COMPLETED")
        r["started_at"] = r["queued_at"]
        r["finished_at"] = r["started_at"] + timedelta(milliseconds=1250)
        p = build_execution_snapshot(r, 5)
        self.assertEqual(p["durationMs"], 1250)

    def test_failed(self):
        r = row("FAILED")
        r["failure_stage"] = "COMPILATION"
        r["error_code"] = "COMPILE_ERROR"
        r["error_message"] = "No compila"
        p = build_execution_snapshot(r, 5)
        self.assertEqual(p["failure"]["code"], "COMPILE_ERROR")
        self.assertEqual(
            p["failure"]["message"],
            "El código no pudo compilarse correctamente.",
        )
        self.assertNotIn("No compila", p["failure"]["message"])
        self.assertFalse(p["resultAvailable"])

    def test_failed_does_not_expose_unknown_internal_message(self):
        r = row("FAILED")
        r["failure_stage"] = "INFRASTRUCTURE"
        r["error_code"] = "UNEXPECTED_DATABASE_DRIVER_ERROR"
        r["error_message"] = (
            "psycopg2.OperationalError at /srv/app/db_connection.py:42"
        )

        p = build_execution_snapshot(r, 5)

        self.assertEqual(
            p["failure"]["message"],
            "La infraestructura de ejecución no estuvo disponible.",
        )
        self.assertNotIn("psycopg2", p["failure"]["message"])

    def test_cancelled(self):
        p = build_execution_snapshot(row("CANCELLED"), 5)
        self.assertTrue(p["terminal"])
        self.assertIsNone(p["failure"])

    def test_original_filename(self):
        p = build_execution_snapshot(row(), 5)
        self.assertEqual(p["originalFilename"], "lcs_template.cpp")

if __name__ == "__main__":
    unittest.main()
