import unittest
from datetime import datetime, timedelta

from Server.webapp.services.execution_history_service import (
    build_failure_payload,
    execution_status_filter_sql,
    map_execution_state_label,
    serialize_execution_history_row,
    summary_from_aggregate,
)


class ExecutionHistoryServiceTests(unittest.TestCase):
    def test_state_labels(self):
        self.assertEqual(
            map_execution_state_label("QUEUED"),
            "En cola",
        )
        self.assertEqual(
            map_execution_state_label("RUNNING"),
            "En ejecución",
        )
        self.assertEqual(
            map_execution_state_label("PROCESSING"),
            "Procesando",
        )
        self.assertEqual(
            map_execution_state_label("COMPLETED"),
            "Completado",
        )
        self.assertEqual(
            map_execution_state_label("FAILED"),
            "Error",
        )

    def test_completed_compatibility_filter(self):
        sql, params = execution_status_filter_sql(
            "Aprobado",
            "e",
        )
        self.assertIn("execution_state", sql)
        self.assertEqual(params, ["COMPLETED"])

    def test_timeout_compatibility_filter(self):
        sql, params = execution_status_filter_sql(
            "Rechazado",
            "e",
        )
        self.assertIn("EXECUTION_TIMEOUT", sql)
        self.assertEqual(params, [])

    def test_error_filter_excludes_timeout(self):
        sql, _ = execution_status_filter_sql(
            "Error",
            "e",
        )
        self.assertIn("FAILED", sql)
        self.assertIn("<> 'EXECUTION_TIMEOUT'", sql)

    def test_direct_running_filter(self):
        sql, params = execution_status_filter_sql(
            "RUNNING",
            "e",
        )
        self.assertIn("execution_state", sql)
        self.assertEqual(params, ["RUNNING"])

    def test_invalid_filter(self):
        with self.assertRaises(ValueError):
            execution_status_filter_sql(
                "NO_EXISTE",
                "e",
            )

    def test_failed_payload(self):
        failure = build_failure_payload(
            {
                "execution_state": "FAILED",
                "failure_stage": "COMPILATION",
                "error_code": "COMPILE_ERROR",
                "error_message": "No compila",
            }
        )
        self.assertEqual(
            failure["code"],
            "COMPILE_ERROR",
        )

    def test_completed_has_no_failure(self):
        self.assertIsNone(
            build_failure_payload(
                {
                    "execution_state": "COMPLETED",
                    "error_code": None,
                }
            )
        )

    def test_serializer_uses_canonical_state(self):
        start = datetime(2026, 8, 11, 1, 0, 0)
        row = {
            "execution_id": 60,
            "public_id": "uuid",
            "codename": "abcLCS",
            "submission_id": 56,
            "submission_title": "LCS",
            "execution_state": "FAILED",
            "failure_stage": "COMPILATION",
            "error_code": "COMPILE_ERROR",
            "error_message": "No compila",
            "started_at": start,
            "processing_at": None,
            "finished_at": start + timedelta(seconds=2),
            "duration_ms": None,
            "result_available": False,
            "hardware_name": None,
        }
        payload = serialize_execution_history_row(row)
        self.assertEqual(payload["state"], "FAILED")
        self.assertEqual(payload["rawStatus"], "FAILED")
        self.assertEqual(payload["status"], "Error")
        self.assertEqual(payload["durationMs"], 2000)

    def test_summary_keeps_legacy_alias(self):
        summary = summary_from_aggregate(
            {
                "executions_count": 7,
                "completed_executions": 2,
                "failed_executions": 2,
                "timeout_executions": 1,
                "error_executions": 1,
                "queued_executions": 1,
                "running_executions": 1,
                "processing_executions": 1,
                "cancelled_executions": 0,
            }
        )
        self.assertEqual(
            summary["okExecutions"],
            summary["completedExecutions"],
        )
        self.assertEqual(summary["failedExecutions"], 2)

    def test_all_filter_has_no_clause(self):
        sql, params = execution_status_filter_sql(
            "all",
            "e",
        )
        self.assertEqual(sql, "")
        self.assertEqual(params, [])


if __name__ == "__main__":
    unittest.main()
