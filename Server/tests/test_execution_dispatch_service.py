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
        self.assertIsNone(source["source_contract_version"])
        self.assertEqual(source["source_language"], "C++")
        self.assertEqual(source["compiler"], "g++")
        self.assertEqual(source["metadata_provenance"], "inferred_legacy_cpp")

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

    def test_legacy_index_remains_cpp_only_when_c_precedes_cpp(self):
        archive_path = self.upload_dir / "legacy-mixed.zip"
        _write_zip(
            archive_path,
            [
                ("helper.c", "int helper(void) { return 1; }\n"),
                ("target.cpp", "int main() { return 0; }\n"),
            ],
        )
        submission = {
            "file_path": "uploads/legacy-mixed.zip",
            "code_hash": _sha256(archive_path),
        }
        execution = {
            "codename": "legacySIZE",
            "execution_config": {
                "original_filename": "target.cpp",
                "source_index": 0,
            },
        }

        source = load_execution_source(
            execution,
            submission,
            self.base_dir,
        )

        self.assertEqual(source["original_filename"], "target.cpp")
        self.assertIn("int main", source["content"])

    def test_v2_uses_combined_c_cpp_order_and_technical_extension(self):
        archive_path = self.upload_dir / "v2-mixed.zip"
        members = [
            ("a.cpp", "cpp-a\n"),
            ("b.c", "c-b\n"),
            ("c.cpp", "cpp-c\n"),
            ("d.C", "c-d\n"),
        ]
        _write_zip(archive_path, members)
        submission = {
            "file_path": "uploads/v2-mixed.zip",
            "code_hash": _sha256(archive_path),
        }

        for source_index, (filename, content) in enumerate(members):
            language = "C" if filename.casefold().endswith(".c") else "C++"
            compiler = "gcc" if language == "C" else "g++"
            extension = ".c" if language == "C" else ".cpp"
            execution = {
                "codename": "v2{}SIZE".format(source_index),
                "execution_config": {
                    "source_contract_version": 2,
                    "source_language": language,
                    "compiler": compiler,
                    "compiler_flags": "-O3",
                    "original_filename": filename,
                    "source_index": source_index,
                },
            }

            with self.subTest(filename=filename):
                source = materialize_execution_source(
                    execution,
                    submission,
                    self.base_dir,
                    self.test_dir,
                )
                self.assertEqual(source["content"], content)
                self.assertEqual(source["source_contract_version"], 2)
                self.assertEqual(source["source_language"], language)
                self.assertEqual(source["compiler"], compiler)
                self.assertEqual(source["metadata_provenance"], "explicit")
                self.assertEqual(
                    Path(source["source_path"]).suffix,
                    extension,
                )

    def test_v2_rejects_index_filename_and_compiler_mismatch(self):
        archive_path = self.upload_dir / "v2-invalid.zip"
        _write_zip(
            archive_path,
            [("a.cpp", "a\n"), ("b.c", "b\n")],
        )
        submission = {
            "file_path": "uploads/v2-invalid.zip",
            "code_hash": _sha256(archive_path),
        }
        invalid_configs = (
            {
                "source_contract_version": 2,
                "source_language": "C++",
                "compiler": "g++",
                "compiler_flags": "-O3",
                "original_filename": "a.cpp",
                "source_index": 1,
            },
            {
                "source_contract_version": 2,
                "source_language": "C",
                "compiler": "g++",
                "compiler_flags": "-O3",
                "original_filename": "b.c",
                "source_index": 1,
            },
        )

        for config in invalid_configs:
            with self.subTest(config=config):
                with self.assertRaises(ExecutionDispatchError):
                    load_execution_source(
                        {
                            "codename": "invalidSIZE",
                            "execution_config": config,
                        },
                        submission,
                        self.base_dir,
                    )


if __name__ == "__main__":
    unittest.main()
