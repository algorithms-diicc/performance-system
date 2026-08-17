import io
import os
import tempfile
import unittest
import zipfile

from werkzeug.datastructures import FileStorage

from Server.webapp.services.upload_service import (
    UploadValidationError,
    remove_stored_upload,
    store_and_inspect_zip,
)


def make_zip(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    buffer.seek(0)
    return buffer


def make_storage(entries, filename="solution.zip"):
    return FileStorage(
        stream=make_zip(entries),
        filename=filename,
        content_type="application/zip",
    )


class UploadServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def test_valid_cpp_zip_is_stored_with_sha256(self):
        upload = store_and_inspect_zip(
            make_storage(
                [("main.cpp", b"int main(){return 0;}")],
                filename="algoritmos.zip",
            ),
            self.tmp.name,
        )
        self.assertTrue(os.path.exists(upload.stored_path))
        self.assertEqual(upload.original_filename, "algoritmos.zip")
        self.assertNotEqual(
            os.path.basename(upload.stored_path),
            upload.original_filename,
        )
        self.assertEqual(len(upload.sha256), 64)
        self.assertEqual(len(upload.sources), 1)

    def test_windows_client_path_keeps_only_visible_zip_name(self):
        upload = store_and_inspect_zip(
            make_storage(
                [("main.cpp", b"int main(){}")],
                filename=r"C:\fakepath\algoritmos.zip",
            ),
            self.tmp.name,
        )
        self.assertEqual(upload.original_filename, "algoritmos.zip")

    def test_zip_filename_longer_than_512_characters_is_rejected(self):
        too_long = "a" * 509 + ".zip"

        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage(
                    [("main.cpp", b"int main(){}")],
                    filename=too_long,
                ),
                self.tmp.name,
            )

    def test_nested_cpp_path_is_allowed(self):
        upload = store_and_inspect_zip(
            make_storage([("src/main.cpp", b"int main(){}")]),
            self.tmp.name,
        )
        self.assertEqual(upload.sources[0].original_filename, "src/main.cpp")

    def test_non_zip_extension_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage(
                    [("main.cpp", b"int main(){}")],
                    filename="main.txt",
                ),
                self.tmp.name,
            )

    def test_zip_without_cpp_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("README.md", b"hello")]),
                self.tmp.name,
            )

    def test_path_traversal_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("../main.cpp", b"int main(){}")]),
                self.tmp.name,
            )

    def test_windows_path_traversal_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("..\\main.cpp", b"int main(){}")]),
                self.tmp.name,
            )

    def test_invalid_utf8_cpp_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("main.cpp", b"\xff\xfe\xfa")]),
                self.tmp.name,
            )

    def test_cpp_with_null_byte_is_rejected(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("main.cpp", b"int main(){}\x00ignored")]),
                self.tmp.name,
            )

    def test_individual_cpp_limit_is_enforced(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([("main.cpp", b"a" * 100)]),
                self.tmp.name,
                max_cpp_bytes=10,
            )

    def test_total_cpp_limit_is_enforced(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([
                    ("a.cpp", b"a" * 8),
                    ("b.cpp", b"b" * 8),
                ]),
                self.tmp.name,
                max_total_cpp_bytes=10,
            )

    def test_cpp_file_count_limit_is_enforced(self):
        with self.assertRaises(UploadValidationError):
            store_and_inspect_zip(
                make_storage([
                    ("a.cpp", b"a"),
                    ("b.cpp", b"b"),
                ]),
                self.tmp.name,
                max_cpp_files=1,
            )

    def test_remove_stored_upload_is_idempotent(self):
        upload = store_and_inspect_zip(
            make_storage([("main.cpp", b"int main(){}")]),
            self.tmp.name,
        )
        remove_stored_upload(upload.stored_path)
        remove_stored_upload(upload.stored_path)
        self.assertFalse(os.path.exists(upload.stored_path))


if __name__ == "__main__":
    unittest.main()
