import hashlib
from pathlib import Path
import tempfile
import unittest

from Server.webapp.services.result_artifact_service import (
    ResultArtifactError,
    ResultArtifactInvalidReference,
    ResultArtifactNotReady,
    assert_canonical_result_reference,
    inspect_result_artifact,
    require_result_artifact,
)


class ResultArtifactServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server_root = Path(self.temp_dir.name) / "Server"
        self.static_root = self.server_root / "webapp" / "static"
        self.result_dir = self.static_root / "execA"
        self.result_dir.mkdir(parents=True)
        self.result_path = self.result_dir / "CombinedResults.csv"
        self.result_bytes = b"InputSize,Time\r\n100,1.25\r\n"
        self.row = {
            "execution_state": "COMPLETED",
            "result_available": True,
            "result_path": "webapp/static/execA/CombinedResults.csv",
        }

    def tearDown(self):
        self.temp_dir.cleanup()

    def _inspect(self, row=None, **kwargs):
        return inspect_result_artifact(
            "execA",
            row or self.row,
            static_dir=self.static_root,
            server_dir=self.server_root,
            **kwargs,
        )

    def test_canonical_csv_returns_exact_bytes_size_and_sha256(self):
        self.result_path.write_bytes(self.result_bytes)

        resolved = assert_canonical_result_reference(
            "execA",
            self.row,
            static_dir=self.static_root,
            server_dir=self.server_root,
        )
        snapshot = self._inspect()
        artifact = require_result_artifact(snapshot)

        self.assertEqual(resolved, str(self.result_path))
        self.assertTrue(snapshot.available)
        self.assertEqual(artifact.content_bytes, self.result_bytes)
        self.assertEqual(artifact.size_bytes, len(self.result_bytes))
        self.assertEqual(
            artifact.sha256,
            hashlib.sha256(self.result_bytes).hexdigest(),
        )

    def test_non_completed_or_unavailable_result_is_not_ready(self):
        cases = (
            dict(self.row, execution_state="FAILED"),
            dict(self.row, execution_state="PROCESSING"),
            dict(self.row, result_available=False),
        )
        for row in cases:
            with self.subTest(row=row):
                with self.assertRaises(ResultArtifactNotReady):
                    assert_canonical_result_reference(
                        "execA",
                        row,
                        static_dir=self.static_root,
                        server_dir=self.server_root,
                    )
                snapshot = self._inspect(row)
                self.assertEqual(snapshot.status, "not_ready")
                self.assertFalse(snapshot.available)

    def test_missing_result_path_is_an_invalid_reference(self):
        row = dict(self.row, result_path=None)
        with self.assertRaises(ResultArtifactInvalidReference):
            assert_canonical_result_reference(
                "execA",
                row,
                static_dir=self.static_root,
                server_dir=self.server_root,
            )
        self.assertEqual(self._inspect(row).status, "invalid_reference")

    def test_sibling_traversal_and_external_paths_are_rejected(self):
        cases = (
            "webapp/static/execB/CombinedResults.csv",
            "webapp/static/execA/../execA/CombinedResults.csv",
            str(Path(self.temp_dir.name) / "outside.csv"),
            "C:/outside/CombinedResults.csv",
        )
        for result_path in cases:
            with self.subTest(result_path=result_path):
                row = dict(self.row, result_path=result_path)
                snapshot = self._inspect(row)
                self.assertEqual(snapshot.status, "invalid_reference")
                self.assertFalse(snapshot.available)

    def test_symlink_escape_is_rejected(self):
        outside = Path(self.temp_dir.name) / "outside.csv"
        outside.write_bytes(b"secret")
        try:
            self.result_path.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("El entorno no permite crear symlinks")

        snapshot = self._inspect()
        self.assertEqual(snapshot.status, "invalid_reference")
        self.assertFalse(snapshot.available)

    def test_missing_csv_is_sanitized_and_unavailable(self):
        snapshot = self._inspect()
        self.assertEqual(snapshot.status, "unavailable")
        self.assertFalse(snapshot.available)

        with self.assertRaises(ResultArtifactError) as context:
            require_result_artifact(snapshot)
        self.assertEqual(context.exception.code, "MEASUREMENTS_UNAVAILABLE")
        self.assertNotIn(str(self.server_root), context.exception.message)

    def test_size_limit_is_enforced(self):
        self.result_path.write_bytes(self.result_bytes)
        snapshot = self._inspect(max_result_bytes=4)
        self.assertEqual(snapshot.status, "too_large")

        with self.assertRaises(ResultArtifactError) as context:
            require_result_artifact(snapshot)
        self.assertEqual(context.exception.status_code, 413)

    def test_directory_instead_of_csv_is_rejected(self):
        self.result_path.mkdir()
        snapshot = self._inspect()
        self.assertEqual(snapshot.status, "invalid_reference")
        self.assertFalse(snapshot.available)


if __name__ == "__main__":
    unittest.main()
