import hashlib
from pathlib import Path
import tempfile
import unittest
import zipfile

from Server.webapp.services.execution_dispatch_service import (
    ExecutionDispatchError,
    load_execution_source,
    materialize_execution_source,
)


def _write_zip(path, members):
    with zipfile.ZipFile(str(path), "w") as archive:
        for name, content in members:
            archive.writestr(name, content)


def _sha256(path):
    return hashlib.sha256(
        Path(path).read_bytes()
    ).hexdigest()


class ExecutionDispatchServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base_dir = Path(self.temp.name)
        self.upload_dir = self.base_dir / "uploads"
        self.test_dir = self.base_dir / "test"
        self.upload_dir.mkdir()

        self.archive_path = self.upload_dir / "submission.zip"
        _write_zip(
            self.archive_path,
            [
                ("notes.txt", "ignored"),
                ("src/first.cpp", "int first() { return 1; }\n"),
                ("second.cpp", "int main() { return 0; }\n"),
            ],
        )

        self.submission = {
            "file_path": "uploads/submission.zip",
            "code_hash": _sha256(self.archive_path),
        }
        self.execution = {
            "codename": "abcLCS",
            "execution_config": {
                "original_filename": "second.cpp",
                "source_index": 1,
            },
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_loads_exact_source_from_persisted_zip(self):
        source = load_execution_source(
            self.execution,
            self.submission,
            self.base_dir,
        )

        self.assertEqual(
            source["original_filename"],
            "second.cpp",
        )
        self.assertEqual(
            source["content"],
            "int main() { return 0; }\n",
        )
        self.assertEqual(
            Path(source["archive_path"]),
            self.archive_path,
        )

    def test_materializes_source_using_codename(self):
        source = materialize_execution_source(
            self.execution,
            self.submission,
            self.base_dir,
            self.test_dir,
        )

        expected = self.test_dir / "abcLCS.cpp"
        self.assertEqual(
            Path(source["source_path"]),
            expected,
        )
        self.assertEqual(
            expected.read_text(encoding="utf-8"),
            "int main() { return 0; }\n",
        )

    def test_rejects_archive_hash_mismatch(self):
        submission = dict(self.submission)
        submission["code_hash"] = "0" * 64

        with self.assertRaises(ExecutionDispatchError):
            load_execution_source(
                self.execution,
                submission,
                self.base_dir,
            )

    def test_rejects_source_index_name_mismatch(self):
        execution = {
            **self.execution,
            "execution_config": {
                "original_filename": "src/first.cpp",
                "source_index": 1,
            },
        }

        with self.assertRaises(ExecutionDispatchError):
            load_execution_source(
                execution,
                self.submission,
                self.base_dir,
            )

    def test_rejects_submission_path_outside_uploads(self):
        outside = self.base_dir / "outside.zip"
        _write_zip(
            outside,
            [("second.cpp", "int main() { return 0; }\n")],
        )
        submission = {
            "file_path": "outside.zip",
            "code_hash": _sha256(outside),
        }

        with self.assertRaises(ExecutionDispatchError):
            load_execution_source(
                self.execution,
                submission,
                self.base_dir,
            )

    def test_rejects_unsafe_codename(self):
        execution = {
            **self.execution,
            "codename": "../escape",
        }

        with self.assertRaises(ExecutionDispatchError):
            materialize_execution_source(
                execution,
                self.submission,
                self.base_dir,
                self.test_dir,
            )


if __name__ == "__main__":
    unittest.main()
