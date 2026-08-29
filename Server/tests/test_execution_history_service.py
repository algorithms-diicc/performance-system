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
        self.assertEqual(
            failure["message"],
            "El código no pudo compilarse correctamente.",
        )
        self.assertNotIn("No compila", failure["message"])

    def test_failed_payload_never_exposes_internal_diagnostic(self):
        internal = (
            "psycopg2 OperationalError /home/perf/private/results.csv "
            "ssh measurement-node -- secret-token"
        )
        failure = build_failure_payload(
            {
                "execution_state": "FAILED",
                "failure_stage": "INFRASTRUCTURE",
                "error_code": "MASTER_SLAVE_ERROR",
                "error_message": internal,
            }
        )

        self.assertEqual(failure["stage"], "INFRASTRUCTURE")
        self.assertEqual(failure["code"], "MASTER_SLAVE_ERROR")
        self.assertEqual(
            failure["message"],
            "Se perdió la comunicación con el nodo de medición.",
        )
        self.assertNotIn("psycopg2", failure["message"])
        self.assertNotIn("/home/", failure["message"])
        self.assertNotIn("ssh ", failure["message"])
        self.assertNotIn("secret-token", failure["message"])

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
            "original_filename": "solucion.cpp",
            "submission_id": 56,
            "submission_title": "LCS",
            "benchmark": "LCS",
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
        self.assertEqual(payload["benchmark"], "LCS")
        self.assertEqual(
            payload["originalFilename"],
            "solucion.cpp",
        )
        self.assertEqual(payload["sourceLanguage"], "C++")
        self.assertEqual(payload["compiler"], "g++")
        self.assertEqual(
            payload["metadataProvenance"],
            "inferred_legacy_cpp",
        )

    def test_serializer_exposes_v2_c_source_identity(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 65,
                "execution_state": "COMPLETED",
                "original_filename": "nested/solution.c",
                "execution_config": {
                    "source_contract_version": 2,
                    "source_language": "C",
                    "compiler": "gcc",
                    "compiler_flags": "-O3",
                },
            }
        )

        self.assertEqual(payload["sourceLanguage"], "C")
        self.assertEqual(payload["compiler"], "gcc")
        self.assertEqual(payload["metadataProvenance"], "explicit")

    def test_serializer_rejects_inconsistent_v2_source_identity(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 66,
                "execution_state": "COMPLETED",
                "original_filename": "solution.c",
                "execution_config": {
                    "source_contract_version": 2,
                    "source_language": "C++",
                    "compiler": "g++",
                    "compiler_flags": "-O3",
                },
            }
        )

        self.assertIsNone(payload["sourceLanguage"])
        self.assertIsNone(payload["compiler"])
        self.assertIsNone(payload["metadataProvenance"])

    def test_serializer_falls_back_to_codename_for_original_filename(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 61,
                "codename": "fallbackSIZE",
                "original_filename": "  ",
                "submission_id": 56,
                "execution_state": "COMPLETED",
                "result_available": True,
            }
        )
        self.assertEqual(
            payload["originalFilename"],
            "fallbackSIZE",
        )

    def test_serializer_prefers_named_hardware_profile(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 62,
                "execution_state": "COMPLETED",
                "hardware_name": "Laboratorio Ryzen",
                "hardware_snapshot": {
                    "node": {
                        "cpu_model": "AMD Ryzen 5 3600",
                    },
                },
            }
        )

        self.assertEqual(
            payload["hardwareProfile"],
            "Laboratorio Ryzen",
        )

    def test_serializer_exposes_registered_measurement_node_name(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 67,
                "execution_state": "COMPLETED",
                "measurement_node_key": "shenu",
                "measurement_node_name": "Shenu",
            }
        )

        self.assertEqual(
            payload["measurementNode"],
            "Shenu",
        )

    def test_serializer_falls_back_to_measurement_node_key(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 68,
                "execution_state": "COMPLETED",
                "measurement_node_key": "ryzen-validation",
                "measurement_node_name": " ",
            }
        )

        self.assertEqual(
            payload["measurementNode"],
            "ryzen-validation",
        )

    def test_serializer_does_not_reinterpret_observed_cpu_as_registered_profile(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 63,
                "execution_state": "COMPLETED",
                "hardware_name": None,
                "hardware_snapshot": {
                    "node": {
                        "cpu_model": "Intel Core i5-9400",
                    },
                },
            }
        )

        self.assertIsNone(
            payload["hardwareProfile"]
        )

    def test_serializer_keeps_hardware_fallback_empty_for_legacy_rows(self):
        payload = serialize_execution_history_row(
            {
                "execution_id": 64,
                "execution_state": "COMPLETED",
                "hardware_name": " ",
                "hardware_snapshot": {},
            }
        )

        self.assertIsNone(payload["hardwareProfile"])
        self.assertIsNone(payload["measurementNode"])

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
