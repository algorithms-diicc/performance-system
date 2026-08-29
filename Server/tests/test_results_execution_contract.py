import tempfile
import unittest
from pathlib import Path

from Server.webapp.routes.results_routes import (
    ExecutionResultContractMismatch,
    ExecutionResultsNotReady,
    _attach_registered_measurement_context,
    _assert_canonical_result_reference,
)


class ResultsExecutionContractTests(unittest.TestCase):
    def _roots(self, tmp):
        server_dir = Path(tmp) / "Server"
        static_dir = server_dir / "webapp" / "static"
        static_dir.mkdir(parents=True)
        return server_dir, static_dir

    def test_registered_provenance_extends_observed_measurement_context(self):
        payload = {
            "execution": {
                "measurement_context": {
                    "source": "execution.hardware_snapshot",
                    "cpu": {
                        "model": (
                            "Intel(R) Core(TM) i5-9400 "
                            "CPU @ 2.90GHz"
                        ),
                    },
                },
            },
        }

        result = _attach_registered_measurement_context(
            payload,
            {
                "measurement_node_id": 1,
                "hardware_profile_id": 3,
                "measurement_node_key": "shenu",
                "measurement_node_name": "Shenu",
                "hardware_profile_key": (
                    "shenu-intel-i5-9400"
                ),
                "hardware_profile_name": (
                    "Shenu Intel i5-9400"
                ),
            },
        )

        context = result["execution"]["measurement_context"]

        self.assertEqual(
            context["cpu"]["model"],
            (
                "Intel(R) Core(TM) i5-9400 "
                "CPU @ 2.90GHz"
            ),
        )

        self.assertEqual(
            context["registry"]["measurement_node"],
            {
                "key": "shenu",
                "name": "Shenu",
            },
        )

        self.assertEqual(
            context["registry"]["hardware_profile"],
            {
                "key": "shenu-intel-i5-9400",
                "name": "Shenu Intel i5-9400",
            },
        )

        registry = context["registry"]

        self.assertNotIn(
            "measurement_node_id",
            registry,
        )
        self.assertNotIn(
            "hardware_profile_id",
            registry,
        )

    def test_completed_execution_accepts_own_persisted_result_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            server_dir, static_dir = self._roots(tmp)

            resolved = _assert_canonical_result_reference(
                "execA",
                {
                    "execution_state": "COMPLETED",
                    "result_available": True,
                    "result_path": (
                        "webapp/static/execA/CombinedResults.csv"
                    ),
                },
                static_dir=str(static_dir),
                server_dir=str(server_dir),
            )

            self.assertEqual(
                resolved,
                str(
                    (
                        static_dir
                        / "execA"
                        / "CombinedResults.csv"
                    ).resolve()
                ),
            )

    def test_sibling_result_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            server_dir, static_dir = self._roots(tmp)

            with self.assertRaises(
                ExecutionResultContractMismatch
            ):
                _assert_canonical_result_reference(
                    "execA",
                    {
                        "execution_state": "COMPLETED",
                        "result_available": True,
                        "result_path": (
                            "webapp/static/execB/"
                            "CombinedResults.csv"
                        ),
                    },
                    static_dir=str(static_dir),
                    server_dir=str(server_dir),
                )

    def test_completed_execution_requires_result_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            server_dir, static_dir = self._roots(tmp)

            with self.assertRaises(
                ExecutionResultContractMismatch
            ):
                _assert_canonical_result_reference(
                    "execA",
                    {
                        "execution_state": "COMPLETED",
                        "result_available": True,
                        "result_path": None,
                    },
                    static_dir=str(static_dir),
                    server_dir=str(server_dir),
                )

    def test_processing_execution_is_not_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            server_dir, static_dir = self._roots(tmp)

            with self.assertRaises(ExecutionResultsNotReady):
                _assert_canonical_result_reference(
                    "execA",
                    {
                        "execution_state": "PROCESSING",
                        "result_available": False,
                        "result_path": None,
                    },
                    static_dir=str(static_dir),
                    server_dir=str(server_dir),
                )

    def test_completed_without_result_available_is_not_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            server_dir, static_dir = self._roots(tmp)

            with self.assertRaises(ExecutionResultsNotReady):
                _assert_canonical_result_reference(
                    "execA",
                    {
                        "execution_state": "COMPLETED",
                        "result_available": False,
                        "result_path": (
                            "webapp/static/execA/"
                            "CombinedResults.csv"
                        ),
                    },
                    static_dir=str(static_dir),
                    server_dir=str(server_dir),
                )


if __name__ == "__main__":
    unittest.main()
