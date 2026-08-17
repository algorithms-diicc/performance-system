import tempfile
import unittest
from pathlib import Path

from Server.webapp.routes.results_routes import (
    ExecutionResultContractMismatch,
    ExecutionResultsNotReady,
    _assert_canonical_result_reference,
)


class ResultsExecutionContractTests(unittest.TestCase):
    def _roots(self, tmp):
        server_dir = Path(tmp) / "Server"
        static_dir = server_dir / "webapp" / "static"
        static_dir.mkdir(parents=True)
        return server_dir, static_dir

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
