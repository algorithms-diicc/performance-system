import hashlib
from io import BytesIO
import json
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
import zipfile

from Server.webapp.services.source_provenance_service import (
    SourceProvenanceError,
    archive_download_name,
    build_trace_payload,
    inspect_archive,
    load_source_artifact,
    resolve_source_metadata_for_row,
    serialize_source_artifact,
    source_download_name,
    source_mime_type,
)


def zip_bytes(entries):
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    return output.getvalue()


def encrypted_zip_bytes(name, content):
    """Marca los headers como cifrados sin alterar el payload del fixture."""
    data = bytearray(zip_bytes([(name, content)]))
    local_offset = data.index(b"PK\x03\x04")
    local_flags = int.from_bytes(data[local_offset + 6 : local_offset + 8], "little")
    data[local_offset + 6 : local_offset + 8] = (local_flags | 1).to_bytes(
        2, "little"
    )
    central_offset = data.index(b"PK\x01\x02")
    central_flags = int.from_bytes(
        data[central_offset + 8 : central_offset + 10], "little"
    )
    data[central_offset + 8 : central_offset + 10] = (
        central_flags | 1
    ).to_bytes(2, "little")
    return bytes(data)


class SourceProvenanceServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server_root = Path(self.temp_dir.name) / "Server"
        self.uploads_root = self.server_root / "uploads"
        self.uploads_root.mkdir(parents=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _store(self, data, name="stored.zip"):
        archive_path = self.uploads_root / name
        archive_path.write_bytes(data)
        return archive_path

    def _row(self, data=None, **overrides):
        if data is None:
            data = zip_bytes([("source.cpp", b"int main() {}\n")])
        self._store(data)
        row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70LCS",
            "execution_state": "COMPLETED",
            "source_filename": "source.cpp",
            "source_index": "0",
            "submission_id": 7,
            "submission_title": "Experimento",
            "archive_file_path": "uploads/stored.zip",
            "archive_original_filename": "fuentes.zip",
            "archive_sha256": hashlib.sha256(data).hexdigest(),
        }
        row.update(overrides)
        return row

    def _inspect(self, row, **kwargs):
        return inspect_archive(
            row,
            server_root=self.server_root,
            uploads_root=self.uploads_root,
            **kwargs,
        )

    def assert_provenance_error(self, code, callable_object):
        with self.assertRaises(SourceProvenanceError) as context:
            callable_object()
        self.assertEqual(context.exception.code, code)
        self.assertNotIn(str(self.server_root), context.exception.message)

    def test_verified_archive_and_exact_raw_source_bytes(self):
        raw_source = b"\xef\xbb\xbfint main() {\r\n  return 0;\r\n}\r\n"
        data = zip_bytes([("nested/source.cpp", raw_source)])
        row = self._row(
            data,
            source_filename="nested\\source.cpp",
        )

        snapshot = self._inspect(row)
        artifact = load_source_artifact(snapshot, row["source_filename"])
        payload = serialize_source_artifact(artifact)

        self.assertTrue(snapshot.available)
        self.assertEqual(snapshot.integrity, "verified")
        self.assertEqual(artifact.content_bytes, raw_source)
        self.assertEqual(artifact.size_bytes, len(raw_source))
        self.assertEqual(artifact.sha256, hashlib.sha256(raw_source).hexdigest())
        self.assertTrue(payload["source"]["content"].startswith("\ufeff"))
        self.assertIn("\r\n", payload["source"]["content"])
        self.assertEqual(source_download_name(artifact), "source.cpp")

    def test_v2_c_source_has_safe_hash_download_name_and_mime(self):
        raw_source = b"int main(void) { return 0; }\n"
        data = zip_bytes([("nested/source.c", raw_source)])
        row = self._row(
            data,
            source_filename="nested/source.c",
            source_contract_version="2",
            source_language="C",
            compiler="gcc",
            compiler_flags="-O3",
            execution_config={
                "source_contract_version": 2,
                "source_language": "C",
                "compiler": "gcc",
                "compiler_flags": "-O3",
                "original_filename": "nested/source.c",
            },
        )

        metadata = resolve_source_metadata_for_row(row)
        artifact = load_source_artifact(
            self._inspect(row),
            row["source_filename"],
        )

        self.assertEqual(metadata.source_language, "C")
        self.assertEqual(metadata.compiler, "gcc")
        self.assertEqual(metadata.metadata_provenance, "explicit")
        self.assertEqual(artifact.content_bytes, raw_source)
        self.assertEqual(
            artifact.sha256,
            hashlib.sha256(raw_source).hexdigest(),
        )
        self.assertEqual(source_download_name(artifact), "source.c")
        self.assertEqual(source_mime_type(artifact), "text/x-csrc")

    def test_archive_states_degrade_without_exposing_internal_paths(self):
        valid_data = zip_bytes([("source.cpp", b"ok")])
        cases = (
            (
                "unavailable",
                self._row(
                    valid_data,
                    archive_file_path=None,
                ),
            ),
            (
                "unavailable",
                self._row(
                    valid_data,
                    archive_file_path="uploads/missing.zip",
                ),
            ),
            (
                "unverified",
                self._row(valid_data, archive_sha256=None),
            ),
            (
                "mismatch",
                self._row(valid_data, archive_sha256="0" * 64),
            ),
            (
                "invalid_reference",
                self._row(
                    valid_data,
                    archive_file_path="uploads/../outside.zip",
                ),
            ),
            (
                "invalid_reference",
                self._row(
                    valid_data,
                    archive_file_path=str(Path(self.temp_dir.name) / "outside.zip"),
                ),
            ),
        )

        for expected_integrity, row in cases:
            with self.subTest(integrity=expected_integrity, row=row):
                snapshot = self._inspect(row)
                self.assertEqual(snapshot.integrity, expected_integrity)
                self.assertFalse(snapshot.available)
                payload = build_trace_payload(
                    row,
                    [row],
                    can_download_archive=True,
                    server_root=self.server_root,
                    uploads_root=self.uploads_root,
                )
                self.assertEqual(
                    payload["submission"]["archive"]["integrity"],
                    expected_integrity,
                )
                self.assertFalse(payload["execution"]["source"]["available"])
                self.assertNotIn(str(self.server_root), json.dumps(payload))

    def test_symlink_escape_and_non_regular_archive_are_rejected(self):
        data = zip_bytes([("source.cpp", b"ok")])
        outside = Path(self.temp_dir.name) / "outside.zip"
        outside.write_bytes(data)
        symlink = self.uploads_root / "escape.zip"
        try:
            symlink.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("El entorno no permite crear symlinks")

        symlink_row = self._row(
            data,
            archive_file_path="uploads/escape.zip",
        )
        directory_row = self._row(
            data,
            archive_file_path="uploads",
        )

        self.assertEqual(
            self._inspect(symlink_row).integrity,
            "invalid_reference",
        )
        self.assertFalse(self._inspect(directory_row).available)

    def test_invalid_or_oversized_archive_is_not_available(self):
        invalid_data = b"not-a-zip"
        row = self._row(invalid_data)
        self.assertEqual(self._inspect(row).integrity, "invalid_archive")

        valid_data = zip_bytes([("source.cpp", b"ok")])
        oversized_row = self._row(valid_data)
        snapshot = self._inspect(
            oversized_row,
            max_archive_bytes=len(valid_data) - 1,
        )
        self.assertEqual(snapshot.integrity, "invalid_archive")

    def test_unsafe_source_references_are_rejected(self):
        row = self._row()
        snapshot = self._inspect(row)
        unsafe_names = (
            "../source.cpp",
            "nested/../../source.cpp",
            "/source.cpp",
            "C:/source.cpp",
            "source.cpp\x00.txt",
            "source.cc",
            None,
        )
        for unsafe_name in unsafe_names:
            with self.subTest(source=unsafe_name):
                self.assert_provenance_error(
                    "SOURCE_INVALID_REFERENCE",
                    lambda name=unsafe_name: load_source_artifact(
                        snapshot,
                        name,
                    ),
                )

    def test_missing_duplicate_and_oversized_members_are_rejected(self):
        snapshot = self._inspect(self._row())
        self.assert_provenance_error(
            "SOURCE_NOT_FOUND",
            lambda: load_source_artifact(snapshot, "missing.cpp"),
        )
        self.assert_provenance_error(
            "SOURCE_TOO_LARGE",
            lambda: load_source_artifact(
                snapshot,
                "source.cpp",
                max_cpp_bytes=3,
            ),
        )

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            duplicate_data = zip_bytes(
                [("duplicate.cpp", b"one"), ("duplicate.cpp", b"two")]
            )
        duplicate_snapshot = self._inspect(
            self._row(
                duplicate_data,
                source_filename="duplicate.cpp",
            )
        )
        self.assert_provenance_error(
            "SOURCE_INVALID",
            lambda: load_source_artifact(
                duplicate_snapshot,
                "duplicate.cpp",
            ),
        )

    def test_symlink_and_encrypted_zip_members_are_rejected(self):
        output = BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            info = zipfile.ZipInfo("link.cpp")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, "target.cpp")
        symlink_snapshot = self._inspect(
            self._row(output.getvalue(), source_filename="link.cpp")
        )
        self.assert_provenance_error(
            "SOURCE_INVALID",
            lambda: load_source_artifact(symlink_snapshot, "link.cpp"),
        )

        encrypted_data = encrypted_zip_bytes("encrypted.cpp", b"secret")
        encrypted_snapshot = self._inspect(
            self._row(
                encrypted_data,
                source_filename="encrypted.cpp",
            )
        )
        self.assert_provenance_error(
            "SOURCE_INVALID",
            lambda: load_source_artifact(
                encrypted_snapshot,
                "encrypted.cpp",
            ),
        )

    def test_invalid_utf8_is_rejected_only_by_json_serialization(self):
        data = zip_bytes([("source.cpp", b"\xff\xfe")])
        snapshot = self._inspect(self._row(data))
        artifact = load_source_artifact(snapshot, "source.cpp")
        self.assertEqual(artifact.content_bytes, b"\xff\xfe")
        self.assert_provenance_error(
            "SOURCE_INVALID_ENCODING",
            lambda: serialize_source_artifact(artifact),
        )

    def test_trace_orders_siblings_and_marks_exactly_one_current_source(self):
        data = zip_bytes(
            [
                ("first.cpp", b"first"),
                ("second.cpp", b"second"),
                ("third.cpp", b"third"),
            ]
        )
        row = self._row(
            data,
            execution_id=20,
            public_id="public-20",
            codename="currentLCS",
            source_filename="second.cpp",
            source_index="1",
            archive_original_filename=None,
            file_path="must-not-leak",
            note="must-not-leak",
            is_pinned=True,
            result_path="must-not-leak",
            log_path="must-not-leak",
            execution_config={"must": "not leak"},
            hardware_snapshot={"must": "not leak"},
            owner_email="owner@example.test",
            owner_name="Private Owner",
        )
        siblings = [
            {
                "execution_id": 30,
                "public_id": "public-30",
                "codename": "thirdLCS",
                "execution_state": "FAILED",
                "source_filename": "third.cpp",
                "source_index": "2",
            },
            {
                "execution_id": 20,
                "public_id": "public-20",
                "codename": "currentLCS",
                "execution_state": "COMPLETED",
                "source_filename": "second.cpp",
                "source_index": "1",
            },
            {
                "execution_id": 10,
                "public_id": "public-10",
                "codename": "firstLCS",
                "execution_state": "COMPLETED",
                "source_filename": "first.cpp",
                "source_index": "0",
            },
        ]

        payload = build_trace_payload(
            row,
            siblings,
            can_download_archive=False,
            server_root=self.server_root,
            uploads_root=self.uploads_root,
        )

        self.assertEqual(payload["schemaVersion"], "1.0")
        self.assertIsNone(
            payload["submission"]["archive"]["originalFilename"]
        )
        self.assertEqual(
            [item["sourceIndex"] for item in payload["sources"]],
            [0, 1, 2],
        )
        self.assertEqual(
            [item["filename"] for item in payload["sources"]],
            ["first.cpp", "second.cpp", "third.cpp"],
        )
        self.assertEqual(
            sum(item["isCurrent"] for item in payload["sources"]),
            1,
        )
        self.assertTrue(payload["sources"][1]["isCurrent"])
        self.assertTrue(payload["execution"]["source"]["available"])
        self.assertEqual(
            payload["execution"]["source"]["language"],
            "C++",
        )
        self.assertEqual(
            payload["execution"]["source"]["compiler"],
            "g++",
        )
        self.assertEqual(
            payload["execution"]["source"]["compilerFlags"],
            "-O3",
        )
        self.assertEqual(
            payload["execution"]["source"]["metadataProvenance"],
            "inferred_legacy_cpp",
        )
        self.assertFalse(payload["permissions"]["canDownloadArchive"])

        serialized = json.dumps(payload)
        for forbidden in (
            "file_path",
            "filePath",
            "result_path",
            "resultPath",
            "log_path",
            "execution_config",
            "executionConfig",
            "hardware_snapshot",
            "hardwareSnapshot",
            "note",
            "isPinned",
            "owner@example.test",
            "Private Owner",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_trace_exposes_explicit_v2_metadata_for_c_and_cpp(self):
        data = zip_bytes(
            [("first.cpp", b"cpp"), ("second.c", b"c")]
        )
        row = self._row(
            data,
            execution_id=20,
            source_filename="second.c",
            source_index="1",
            source_contract_version="2",
            source_language="C",
            compiler="gcc",
            compiler_flags="-O3",
        )
        siblings = [
            {
                "execution_id": 10,
                "public_id": "public-10",
                "codename": "firstLCS",
                "execution_state": "COMPLETED",
                "source_filename": "first.cpp",
                "source_index": "0",
                "source_contract_version": "2",
                "source_language": "C++",
                "compiler": "g++",
                "compiler_flags": "-O3",
            },
            {
                **row,
                "public_id": "public-20",
                "codename": "secondLCS",
            },
        ]

        payload = build_trace_payload(
            row,
            siblings,
            can_download_archive=True,
            server_root=self.server_root,
            uploads_root=self.uploads_root,
        )

        self.assertEqual(
            [item["language"] for item in payload["sources"]],
            ["C++", "C"],
        )
        self.assertEqual(
            [item["compiler"] for item in payload["sources"]],
            ["g++", "gcc"],
        )
        self.assertTrue(
            all(
                item["metadataProvenance"] == "explicit"
                for item in payload["sources"]
            )
        )
        self.assertEqual(payload["execution"]["source"]["language"], "C")

    def test_archive_download_name_uses_original_or_historical_fallback(self):
        self.assertEqual(
            archive_download_name(
                {
                    "submission_id": 7,
                    "archive_original_filename": "folder\\algoritmos.zip",
                }
            ),
            "algoritmos.zip",
        )
        self.assertEqual(
            archive_download_name(
                {
                    "submission_id": 134,
                    "archive_original_filename": None,
                    "archive_file_path": "uploads/internal-uuid.zip",
                }
            ),
            "submission-134.zip",
        )


if __name__ == "__main__":
    unittest.main()
