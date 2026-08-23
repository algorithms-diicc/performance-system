from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from Server.webapp.services.reproducibility_service import (
    ReproducibilityError,
    build_bundle_bytes,
    build_reproducibility_snapshot,
)


def make_zip(entries):
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    return output.getvalue()


class ReproducibilityServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server_root = Path(self.temp_dir.name) / "Server"
        self.uploads_root = self.server_root / "uploads"
        self.static_root = self.server_root / "webapp" / "static"
        self.uploads_root.mkdir(parents=True)
        self.result_dir = self.static_root / "exec70SIZE"
        self.result_dir.mkdir(parents=True)

        self.source_bytes = b"\xef\xbb\xbfint main() {\r\n  return 0;\r\n}\r\n"
        self.csv_bytes = b"InputSize,Time\r\n100,1.25\r\n"
        self.archive_bytes = make_zip(
            [("nested/source.cpp", self.source_bytes)]
        )
        (self.uploads_root / "internal-uuid.zip").write_bytes(
            self.archive_bytes
        )
        (self.result_dir / "CombinedResults.csv").write_bytes(
            self.csv_bytes
        )

        self.row = {
            "execution_id": 70,
            "public_id": "00000000-0000-0000-0000-000000000070",
            "codename": "exec70SIZE",
            "execution_state": "COMPLETED",
            "benchmark": "SIZE",
            "input_size": 1000,
            "samples": 10,
            "execution_profile": "QUICK",
            "execution_config": {
                "compiler_flags": "-O3",
                "original_filename": "nested/source.cpp",
                "source_index": 0,
                "archive_sha256": "private duplicate",
                "course_id": 55,
                "private": "must-not-leak",
                "measurement": {
                    "schema_version": "1.0",
                    "points": 10,
                    "samples_per_point": 10,
                    "warmup_rounds": 1,
                    "perf_scope": "process",
                    "single_event_fallback": True,
                    "private": "must-not-leak",
                },
            },
            "source_filename": "nested/source.cpp",
            "source_index": "0",
            "hardware_snapshot": {
                "node": {
                    "cpu_vendor": "GenuineIntel",
                    "cpu_model": "Intel Core i5-9400",
                    "architecture": "x86_64",
                    "logical_cpus": 6,
                    "hostname": "private-host",
                },
                "measurement": {
                    "backend": "perf",
                    "perf_version": "perf version 6.8",
                    "requested_perf_scope": "process",
                    "perf_event_paranoid": "-1",
                    "private": "must-not-leak",
                },
                "env": {"HOME": "/private/home"},
            },
            "created_at": datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc),
            "started_at": datetime(2026, 8, 18, 10, 1, tzinfo=timezone.utc),
            "finished_at": datetime(2026, 8, 18, 10, 2, tzinfo=timezone.utc),
            "result_available": True,
            "result_path": (
                "webapp/static/exec70SIZE/CombinedResults.csv"
            ),
            "submission_id": 134,
            "submission_title": "Ordenamiento reproducible",
            "archive_file_path": "uploads/internal-uuid.zip",
            "archive_original_filename": None,
            "archive_sha256": hashlib.sha256(self.archive_bytes).hexdigest(),
            "file_path": "/private/internal-uuid.zip",
            "log_path": "/private/log.txt",
            "note": "private note",
            "is_pinned": True,
            "owner_email": "owner@example.test",
            "owner_name": "Private Owner",
        }

    def tearDown(self):
        self.temp_dir.cleanup()

    def _snapshot(self, row=None):
        return build_reproducibility_snapshot(
            row or self.row,
            server_root=self.server_root,
            uploads_root=self.uploads_root,
            static_dir=self.static_root,
        )

    def test_manifest_uses_persisted_identity_and_strict_whitelists(self):
        snapshot = self._snapshot()
        manifest = snapshot.manifest

        self.assertEqual(manifest["schemaVersion"], "1.0")
        self.assertEqual(manifest["submission"]["id"], 134)
        self.assertIsNone(
            manifest["submission"]["archive"]["originalFilename"]
        )
        self.assertEqual(
            manifest["submission"]["archive"]["sha256"],
            hashlib.sha256(self.archive_bytes).hexdigest(),
        )
        self.assertEqual(
            manifest["submission"]["archive"]["integrity"],
            "verified",
        )

        execution = manifest["execution"]
        self.assertEqual(execution["publicId"], self.row["public_id"])
        self.assertEqual(execution["codename"], "exec70SIZE")
        self.assertEqual(execution["state"], "COMPLETED")
        self.assertEqual(execution["benchmark"], "SIZE")
        self.assertEqual(execution["profile"], "QUICK")
        self.assertEqual(execution["createdAt"], "2026-08-18T10:00:00+00:00")
        self.assertEqual(execution["startedAt"], "2026-08-18T10:01:00+00:00")
        self.assertEqual(execution["finishedAt"], "2026-08-18T10:02:00+00:00")

        source = manifest["source"]
        self.assertEqual(source["filename"], "nested/source.cpp")
        self.assertEqual(source["sourceIndex"], 0)
        self.assertTrue(source["available"])
        self.assertEqual(
            source["sha256"],
            hashlib.sha256(self.source_bytes).hexdigest(),
        )
        self.assertEqual(source["sizeBytes"], len(self.source_bytes))
        self.assertEqual(
            source["hashProvenance"],
            "verified_archive_member",
        )

        configuration = manifest["configuration"]
        self.assertEqual(configuration["inputSize"], 1000)
        self.assertEqual(configuration["samples"], 10)
        self.assertEqual(configuration["compilerFlags"], "-O3")
        self.assertEqual(
            configuration["measurement"],
            {
                "schemaVersion": "1.0",
                "points": 10,
                "samplesPerPoint": 10,
                "warmupRounds": 1,
                "perfScope": "process",
                "singleEventFallback": True,
            },
        )
        self.assertNotIn("language", source)
        self.assertNotIn("metadataProvenance", source)
        self.assertNotIn("compiler", configuration)

        environment = manifest["environmentObserved"]
        self.assertEqual(
            environment["cpu"],
            {
                "vendor": "GenuineIntel",
                "model": "Intel Core i5-9400",
                "architecture": "x86_64",
                "logicalCpus": 6,
            },
        )
        self.assertEqual(
            environment["measurementBackend"],
            {
                "name": "perf",
                "version": "perf version 6.8",
                "requestedScope": "process",
                "perfEventParanoid": "-1",
            },
        )
        self.assertNotIn("toolchain", environment)

        measurements = manifest["artifacts"]["measurements"]
        self.assertTrue(measurements["available"])
        self.assertEqual(
            measurements["sha256"],
            hashlib.sha256(self.csv_bytes).hexdigest(),
        )
        self.assertEqual(measurements["sizeBytes"], len(self.csv_bytes))
        self.assertEqual(
            measurements["hashProvenance"],
            "computed_on_export",
        )

        serialized = json.dumps(manifest)
        for forbidden in (
            "file_path",
            "filePath",
            "archive_file_path",
            "result_path",
            "resultPath",
            "log_path",
            "logPath",
            "execution_config",
            "executionConfig",
            "hardwareSnapshot",
            "private-host",
            "/private/home",
            "private note",
            "isPinned",
            "owner@example.test",
            "Private Owner",
            "internal-uuid",
            "must-not-leak",
            "generatedAt",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_manifest_bytes_are_stable_utf8_json_with_final_newline(self):
        first = self._snapshot().manifest_bytes
        second = self._snapshot().manifest_bytes
        self.assertEqual(first, second)
        self.assertEqual(
            hashlib.sha256(first).hexdigest(),
            "5c4abdd5514002a225f9c069c2be20ece75efbfafdffabe579adc5dac584e49b",
        )
        self.assertTrue(first.endswith(b"\n"))
        self.assertEqual(json.loads(first.decode("utf-8")), self._snapshot().manifest)
        self.assertNotIn(b"generatedAt", first)

    def test_v2_cpp_manifest_adds_metadata_without_schema_bump(self):
        execution_config = {
            **self.row["execution_config"],
            "source_contract_version": 2,
            "source_language": "C++",
            "compiler": "g++",
            "compiler_flags": "-O3",
        }
        hardware_snapshot = {
            **self.row["hardware_snapshot"],
            "toolchain": {
                "compiler": {
                    "family": "GNU",
                    "name": "g++",
                    "version": "g++ (Ubuntu 9.4.0) 9.4.0",
                    "path": "/usr/bin/g++",
                    "private": "must-not-leak",
                }
            },
        }
        row = dict(
            self.row,
            execution_config=execution_config,
            hardware_snapshot=hardware_snapshot,
        )
        snapshot = self._snapshot(row)

        self.assertEqual(snapshot.manifest["schemaVersion"], "1.0")
        self.assertEqual(snapshot.manifest["source"]["language"], "C++")
        self.assertEqual(
            snapshot.manifest["source"]["metadataProvenance"],
            "explicit",
        )
        self.assertEqual(
            snapshot.manifest["configuration"]["compiler"],
            "g++",
        )
        self.assertEqual(
            snapshot.manifest["configuration"]["compilerFlags"],
            "-O3",
        )
        self.assertEqual(
            snapshot.manifest["environmentObserved"]["toolchain"],
            {
                "compiler": {
                    "family": "GNU",
                    "name": "g++",
                    "version": "g++ (Ubuntu 9.4.0) 9.4.0",
                }
            },
        )
        self.assertNotIn(
            "/usr/bin/g++",
            json.dumps(snapshot.manifest),
        )
        self.assertEqual(
            snapshot.manifest_bytes,
            self._snapshot(row).manifest_bytes,
        )

    def test_invalid_observed_toolchain_is_not_exported(self):
        hardware_snapshot = {
            **self.row["hardware_snapshot"],
            "toolchain": {
                "compiler": {
                    "family": "private-family",
                    "name": "clang",
                    "version": "/private/compiler/version",
                }
            },
        }

        snapshot = self._snapshot(
            dict(self.row, hardware_snapshot=hardware_snapshot)
        )

        self.assertNotIn(
            "toolchain",
            snapshot.manifest["environmentObserved"],
        )

    def test_v2_c_manifest_and_bundle_preserve_c_extension(self):
        source_bytes = b"int main(void) { return 0; }\n"
        archive_bytes = make_zip([("nested/source.c", source_bytes)])
        (self.uploads_root / "internal-uuid.zip").write_bytes(
            archive_bytes
        )
        execution_config = {
            **self.row["execution_config"],
            "source_contract_version": 2,
            "source_language": "C",
            "compiler": "gcc",
            "compiler_flags": "-O3",
            "original_filename": "nested/source.c",
        }
        row = dict(
            self.row,
            execution_config=execution_config,
            source_filename="nested/source.c",
            archive_sha256=hashlib.sha256(archive_bytes).hexdigest(),
        )

        snapshot = self._snapshot(row)
        bundle = build_bundle_bytes(snapshot)

        self.assertEqual(snapshot.manifest["schemaVersion"], "1.0")
        self.assertEqual(snapshot.manifest["source"]["language"], "C")
        self.assertEqual(
            snapshot.manifest["source"]["metadataProvenance"],
            "explicit",
        )
        self.assertEqual(
            snapshot.manifest["configuration"]["compiler"],
            "gcc",
        )
        with zipfile.ZipFile(BytesIO(bundle), "r") as archive:
            self.assertIn("source/source.c", archive.namelist())
            self.assertEqual(archive.read("source/source.c"), source_bytes)

    def test_missing_source_degrades_manifest_without_hiding_execution(self):
        row = dict(self.row, source_filename="missing.cpp")
        snapshot = self._snapshot(row)
        source = snapshot.manifest["source"]
        self.assertEqual(snapshot.manifest["execution"]["state"], "COMPLETED")
        self.assertFalse(source["available"])
        self.assertIsNone(source["sha256"])
        self.assertIsNone(source["sizeBytes"])

    def test_failed_execution_has_manifest_but_no_measurements_or_bundle(self):
        row = dict(
            self.row,
            execution_state="FAILED",
            result_available=False,
            result_path=None,
        )
        snapshot = self._snapshot(row)
        self.assertEqual(snapshot.manifest["execution"]["state"], "FAILED")
        self.assertTrue(snapshot.manifest["source"]["available"])
        self.assertFalse(
            snapshot.manifest["artifacts"]["measurements"]["available"]
        )
        with self.assertRaises(ReproducibilityError) as context:
            build_bundle_bytes(snapshot)
        self.assertEqual(
            context.exception.code,
            "BUNDLE_MEASUREMENTS_UNAVAILABLE",
        )

    def test_active_and_cancelled_states_always_keep_manifest_available(self):
        for state in ("QUEUED", "RUNNING", "PROCESSING", "CANCELLED"):
            with self.subTest(state=state):
                row = dict(
                    self.row,
                    execution_state=state,
                    result_available=False,
                    result_path=None,
                    started_at=(
                        None
                        if state == "QUEUED"
                        else self.row["started_at"]
                    ),
                    finished_at=None,
                )
                manifest = self._snapshot(row).manifest
                self.assertEqual(manifest["execution"]["state"], state)
                self.assertFalse(
                    manifest["artifacts"]["measurements"]["available"]
                )

    def test_missing_hardware_is_represented_only_with_null_whitelist(self):
        snapshot = self._snapshot(dict(self.row, hardware_snapshot={}))
        environment = snapshot.manifest["environmentObserved"]
        self.assertEqual(
            environment["cpu"],
            {
                "vendor": None,
                "model": None,
                "architecture": None,
                "logicalCpus": None,
            },
        )
        self.assertTrue(
            all(
                value is None
                for value in environment["measurementBackend"].values()
            )
        )

    def test_bundle_is_exact_safe_and_byte_deterministic(self):
        first_snapshot = self._snapshot()
        first = build_bundle_bytes(first_snapshot)
        second = build_bundle_bytes(self._snapshot())
        self.assertEqual(first, second)

        with zipfile.ZipFile(BytesIO(first), "r") as archive:
            infos = archive.infolist()
            self.assertEqual(
                [info.filename for info in infos],
                [
                    "manifest.json",
                    "CombinedResults.csv",
                    "source/source.cpp",
                ],
            )
            self.assertEqual(
                archive.read("manifest.json"),
                first_snapshot.manifest_bytes,
            )
            self.assertEqual(
                archive.read("CombinedResults.csv"),
                self.csv_bytes,
            )
            self.assertEqual(
                archive.read("source/source.cpp"),
                self.source_bytes,
            )
            for info in infos:
                self.assertEqual(info.date_time, (1980, 1, 1, 0, 0, 0))
                self.assertEqual((info.external_attr >> 16) & 0o777, 0o644)
                self.assertEqual(info.compress_type, zipfile.ZIP_STORED)

        self.assertNotIn(b"internal-uuid", first)
        self.assertNotIn(self.archive_bytes, first)

    def test_bundle_is_denied_when_source_or_csv_is_unavailable(self):
        cases = (
            (
                dict(self.row, source_filename="missing.cpp"),
                "BUNDLE_SOURCE_UNAVAILABLE",
            ),
            (
                dict(self.row, result_available=False),
                "BUNDLE_MEASUREMENTS_UNAVAILABLE",
            ),
        )
        for row, expected_code in cases:
            with self.subTest(expected_code=expected_code):
                with self.assertRaises(ReproducibilityError) as context:
                    build_bundle_bytes(self._snapshot(row))
                self.assertEqual(context.exception.code, expected_code)


if __name__ == "__main__":
    unittest.main()
