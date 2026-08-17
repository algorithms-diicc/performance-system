import unittest
from unittest.mock import patch

from Server.webapp.services.execution_creation_service import (
    InvalidExecutionRequest,
    build_measurement_snapshot,
    create_submission_bundle,
    infer_execution_profile,
    normalize_benchmark,
    validate_execution_limits,
    validate_source_specs,
)


class FakeSubmissionRepository:
    def __init__(self):
        self.calls = []

    def create_submission(self, **kwargs):
        self.calls.append(kwargs)
        return {
            "id": 777,
            "user_id": kwargs["user_id"],
            "course_id": kwargs.get("course_id"),
            "title": kwargs["title"],
            "language": kwargs["language"],
            "file_path": kwargs["file_path"],
            "original_filename": kwargs.get("original_filename"),
            "code_hash": kwargs["code_hash"],
            "note": kwargs.get("note"),
            "is_pinned": kwargs.get("is_pinned", False),
            "status": kwargs["status"],
            "created_at": None,
        }


class FakeExecutionRepository:
    def __init__(self):
        self.calls = []

    def create_execution(self, **kwargs):
        self.calls.append(kwargs)
        index = len(self.calls)
        return {
            "id": 1000 + index,
            "public_id": "00000000-0000-0000-0000-{:012d}".format(index),
            "submission_id": kwargs["submission_id"],
            "codename": kwargs["codename"],
            "execution_state": "QUEUED",
            "benchmark": kwargs["benchmark"],
            "input_size": kwargs["input_size"],
            "samples": kwargs["samples"],
            "execution_profile": kwargs["execution_profile"],
            "execution_config": kwargs["execution_config"],
            "result_available": False,
            "state_version": 0,
            "status": "pending",
        }


class ExecutionCreationServiceTests(unittest.TestCase):
    SHA = "a" * 64

    def test_known_benchmark_is_normalized(self):
        self.assertEqual(normalize_benchmark("lcs"), "LCS")

    def test_unknown_benchmark_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            normalize_benchmark("unknown")

    def test_profiles_are_inferred_from_samples(self):
        self.assertEqual(infer_execution_profile(10), "QUICK")
        self.assertEqual(infer_execution_profile(30), "BALANCED")
        self.assertEqual(infer_execution_profile(50), "EXHAUSTIVE")
        self.assertEqual(infer_execution_profile(17), "CUSTOM")


    def test_measurement_snapshot_is_explicit_and_reproducible(self):
        snapshot = build_measurement_snapshot(30)

        self.assertEqual(snapshot["schema_version"], "1.0")
        self.assertEqual(snapshot["points"], 10)
        self.assertEqual(snapshot["samples_per_point"], 30)
        self.assertEqual(snapshot["warmup_rounds"], 1)
        self.assertEqual(snapshot["perf_scope"], "process")
        self.assertTrue(snapshot["single_event_fallback"])

    def test_empty_source_list_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_source_specs([])

    def test_non_cpp_source_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_source_specs([{"original_filename": "x.py"}])

    def test_duplicate_source_name_is_rejected_case_insensitive(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_source_specs([
                {"original_filename": "Main.cpp"},
                {"original_filename": "main.cpp"},
            ])

    def test_source_path_traversal_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_source_specs([{"original_filename": "../main.cpp"}])

    def test_non_positive_input_size_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            create_submission_bundle(
                user_id=1,
                title="test",
                archive_path="/tmp/test.zip",
                archive_sha256=self.SHA,
                benchmark="LCS",
                input_size=0,
                samples=30,
                source_specs=[{"original_filename": "a.cpp"}],
                submission_repo=FakeSubmissionRepository(),
                execution_repo=FakeExecutionRepository(),
                conn=object(),
            )

    def test_input_size_above_benchmark_limit_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_limits("LCS", 50001, 30)

    def test_samples_above_limit_are_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_limits("LCS", 500, 101)

    def test_frontend_limit_boundaries_are_accepted(self):
        validate_execution_limits("LCS", 50000, 100)
        validate_execution_limits("CAMM", 150000, 100)
        validate_execution_limits("SIZE", 100000, 100)

    def test_invalid_sha256_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            create_submission_bundle(
                user_id=1,
                title="test",
                archive_path="/tmp/test.zip",
                archive_sha256="abc",
                benchmark="LCS",
                input_size=500,
                samples=30,
                source_specs=[{"original_filename": "a.cpp"}],
                submission_repo=FakeSubmissionRepository(),
                execution_repo=FakeExecutionRepository(),
                conn=object(),
            )

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_one_submission_creates_one_execution_per_cpp(self, _resolve_course):
        srepo = FakeSubmissionRepository()
        erepo = FakeExecutionRepository()

        bundle = create_submission_bundle(
            user_id=5,
            title="LCS upload",
            archive_path="/srv/uploads/a.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size="500",
            samples="30",
            source_specs=[
                {"original_filename": "a.cpp"},
                {"original_filename": "folder/b.cpp"},
            ],
            submission_repo=srepo,
            execution_repo=erepo,
            conn=object(),
        )

        self.assertEqual(len(srepo.calls), 1)
        self.assertEqual(len(erepo.calls), 2)
        self.assertEqual(len(bundle["executions"]), 2)
        self.assertEqual(bundle["submission"]["status"], "QUEUED")
        self.assertIsNone(srepo.calls[0]["original_filename"])
        self.assertIsNone(srepo.calls[0]["note"])

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_submission_metadata_is_normalized_and_persisted(self, _resolve_course):
        srepo = FakeSubmissionRepository()

        bundle = create_submission_bundle(
            user_id=5,
            title="LCS upload",
            archive_path="/srv/uploads/internal-uuid.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=500,
            samples=30,
            source_specs=[{"original_filename": "main.cpp"}],
            original_filename=r"C:\fakepath\algoritmos.zip",
            note="  Comparación para el laboratorio  ",
            submission_repo=srepo,
            execution_repo=FakeExecutionRepository(),
            conn=object(),
        )

        self.assertEqual(
            srepo.calls[0]["original_filename"],
            "algoritmos.zip",
        )
        self.assertEqual(
            srepo.calls[0]["file_path"],
            "/srv/uploads/internal-uuid.zip",
        )
        self.assertEqual(
            srepo.calls[0]["note"],
            "Comparación para el laboratorio",
        )
        self.assertEqual(
            bundle["submission"]["original_filename"],
            "algoritmos.zip",
        )

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_optional_note_accepts_none_empty_and_valid_text(self, _resolve_course):
        cases = (
            (None, None),
            ("   \t", None),
            ("  referencia útil  ", "referencia útil"),
        )

        for raw_note, expected in cases:
            with self.subTest(note=raw_note):
                srepo = FakeSubmissionRepository()
                create_submission_bundle(
                    user_id=5,
                    title="LCS upload",
                    archive_path="/srv/uploads/a.zip",
                    archive_sha256=self.SHA,
                    benchmark="LCS",
                    input_size=500,
                    samples=30,
                    source_specs=[{"original_filename": "main.cpp"}],
                    note=raw_note,
                    submission_repo=srepo,
                    execution_repo=FakeExecutionRepository(),
                    conn=object(),
                )
                self.assertEqual(srepo.calls[0]["note"], expected)

    def test_note_longer_than_500_characters_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            create_submission_bundle(
                user_id=5,
                title="LCS upload",
                archive_path="/srv/uploads/a.zip",
                archive_sha256=self.SHA,
                benchmark="LCS",
                input_size=500,
                samples=30,
                source_specs=[{"original_filename": "main.cpp"}],
                note="n" * 501,
                submission_repo=FakeSubmissionRepository(),
                execution_repo=FakeExecutionRepository(),
                conn=object(),
            )

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_execution_snapshot_contains_original_filename_and_hash(self, _resolve_course):
        srepo = FakeSubmissionRepository()
        erepo = FakeExecutionRepository()

        create_submission_bundle(
            user_id=5,
            title="LCS upload",
            archive_path="/srv/uploads/a.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=500,
            samples=30,
            source_specs=[{"original_filename": "src/main.cpp"}],
            submission_repo=srepo,
            execution_repo=erepo,
            conn=object(),
        )

        config = erepo.calls[0]["execution_config"]
        self.assertEqual(config["original_filename"], "src/main.cpp")
        self.assertEqual(config["archive_sha256"], self.SHA)
        self.assertEqual(config["compiler_flags"], "-O3")

        measurement = config["measurement"]
        self.assertEqual(measurement["schema_version"], "1.0")
        self.assertEqual(measurement["points"], 10)
        self.assertEqual(measurement["samples_per_point"], 30)
        self.assertEqual(measurement["warmup_rounds"], 1)
        self.assertEqual(measurement["perf_scope"], "process")
        self.assertTrue(measurement["single_event_fallback"])

        self.assertEqual(erepo.calls[0]["execution_profile"], "BALANCED")
