import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from Server.webapp.services.execution_creation_service import (
    InvalidExecutionRequest,
    build_measurement_snapshot,
    create_submission_bundle,
    infer_execution_profile,
    normalize_benchmark,
    validate_execution_policy_limits,
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



def _test_measurement_policy(
    profile_key,
    benchmark,
    execution_profile,
    conn=None,
):
    families = {
        "CAMMR": "CAMM",
        "CAMMS": "CAMM",
        "CAMMSO": "CAMM",
    }
    family = families.get(benchmark, benchmark)

    matrix = {
        ("LCS", "QUICK"): (100, 500, 750, 1000, 100, 960),
        ("LCS", "BALANCED"): (100, 500, 500, 750, 100, 1680),
        ("LCS", "EXHAUSTIVE"): (100, 500, 500, 500, 100, 1320),
        ("LCS", "CUSTOM"): (100, 500, 500, 500, 100, 2640),

        ("CAMM", "QUICK"): (
            1000, 5000, 100000, 130000, 1000, 360
        ),
        ("CAMM", "BALANCED"): (
            1000, 5000, 75000, 100000, 1000, 780
        ),
        ("CAMM", "EXHAUSTIVE"): (
            1000, 5000, 50000, 75000, 1000, 960
        ),
        ("CAMM", "CUSTOM"): (
            1000, 5000, 50000, 50000, 1000, 1380
        ),

        ("SIZE", "QUICK"): (
            100, 2500, 100000, 100000, 100, 120
        ),
        ("SIZE", "BALANCED"): (
            100, 2500, 100000, 100000, 100, 240
        ),
        ("SIZE", "EXHAUSTIVE"): (
            100, 2500, 100000, 100000, 100, 420
        ),
        ("SIZE", "CUSTOM"): (
            100, 2500, 100000, 100000, 100, 780
        ),
    }

    (
        minimum,
        default,
        recommended,
        hard_max,
        step,
        timeout,
    ) = matrix[(family, execution_profile)]

    return {
        "hardware_profile_id": 3,
        "profile_key": profile_key,
        "benchmark": family,
        "execution_profile": execution_profile,
        "minimum_input": minimum,
        "default_input": default,
        "recommended_max_input": recommended,
        "hard_max_input": hard_max,
        "input_step": step,
        "operational_timeout_seconds": timeout,
        "is_active": True,
    }


class ExecutionCreationServiceTests(unittest.TestCase):
    SHA = "a" * 64

    def setUp(self):
        self.policy_patcher = patch(
            "Server.webapp.services.execution_creation_service."
            "resolve_hardware_profile_policy",
            side_effect=_test_measurement_policy,
        )
        self.policy_resolver = self.policy_patcher.start()
        self.addCleanup(self.policy_patcher.stop)

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

    def test_unsupported_source_is_rejected(self):
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
        self.assertEqual(bundle["submission"]["language"], "C++")
        self.assertIsNone(srepo.calls[0]["original_filename"])
        self.assertIsNone(srepo.calls[0]["note"])

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_c_submission_derives_language_and_gcc_metadata(
        self,
        _resolve_course,
    ):
        srepo = FakeSubmissionRepository()
        erepo = FakeExecutionRepository()

        bundle = create_submission_bundle(
            user_id=5,
            title="C upload",
            archive_path="/srv/uploads/a.zip",
            archive_sha256=self.SHA,
            benchmark="SIZE",
            input_size=500,
            samples=10,
            source_specs=[{"original_filename": "src/main.c"}],
            submission_repo=srepo,
            execution_repo=erepo,
            conn=object(),
        )

        self.assertEqual(bundle["submission"]["language"], "C")
        config = erepo.calls[0]["execution_config"]
        self.assertEqual(config["source_language"], "C")
        self.assertEqual(config["compiler"], "gcc")
        self.assertEqual(config["compiler_flags"], "-O3")

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
        self.assertEqual(config["source_contract_version"], 2)
        self.assertEqual(config["source_language"], "C++")
        self.assertEqual(config["compiler"], "g++")
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

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_execution_snapshot_persists_admission_policy(
        self,
        _resolve_course,
    ):
        erepo = FakeExecutionRepository()

        create_submission_bundle(
            user_id=5,
            title="LCS policy snapshot",
            archive_path="/srv/uploads/a.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=1000,
            samples=10,
            source_specs=[
                {"original_filename": "main.cpp"}
            ],
            submission_repo=FakeSubmissionRepository(),
            execution_repo=erepo,
            conn=object(),
        )

        call = erepo.calls[0]
        measurement = call["execution_config"]["measurement"]

        self.assertEqual(
            measurement["schema_version"],
            "1.0",
        )
        self.assertEqual(
            measurement["operational_timeout_seconds"],
            960,
        )

        self.assertEqual(
            measurement["admission_policy"],
            {
                "hardware_profile_key":
                    "shenu-intel-i5-9400",
                "benchmark": "LCS",
                "execution_profile": "QUICK",
                "minimum_input": 100,
                "default_input": 500,
                "recommended_max_input": 750,
                "hard_max_input": 1000,
                "input_step": 100,
            },
        )

        # Gate 6-8 resolverán la asignación física.
        self.assertIsNone(
            call["hardware_profile_id"]
        )


    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_source_spec_metadata_cannot_override_cpp_contract(
        self,
        _resolve_course,
    ):
        erepo = FakeExecutionRepository()

        create_submission_bundle(
            user_id=5,
            title="LCS upload",
            archive_path="/srv/uploads/a.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=500,
            samples=30,
            source_specs=[
                {
                    "original_filename": "src/main.cpp",
                    "source_contract_version": 999,
                    "source_language": "C",
                    "compiler": "attacker-controlled",
                    "compiler_flags": "-O0; touch /tmp/unsafe",
                }
            ],
            submission_repo=FakeSubmissionRepository(),
            execution_repo=erepo,
            conn=object(),
        )

        config = erepo.calls[0]["execution_config"]
        self.assertEqual(config["source_contract_version"], 2)
        self.assertEqual(config["source_language"], "C++")
        self.assertEqual(config["compiler"], "g++")
        self.assertEqual(config["compiler_flags"], "-O3")

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_mixed_v2_index_uses_exact_interleaved_archive_order(
        self,
        _resolve_course,
    ):
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "mixed.zip"
            with zipfile.ZipFile(str(archive_path), "w") as archive:
                archive.writestr("a.cpp", "cpp-a")
                archive.writestr("b.c", "c-b")
                archive.writestr("c.cpp", "cpp-c")
                archive.writestr("d.c", "c-d")
            archive_sha256 = hashlib.sha256(
                archive_path.read_bytes()
            ).hexdigest()
            erepo = FakeExecutionRepository()

            bundle = create_submission_bundle(
                user_id=5,
                title="Mixed archive",
                archive_path=str(archive_path),
                archive_sha256=archive_sha256,
                benchmark="LCS",
                input_size=500,
                samples=30,
                source_specs=[
                    {"original_filename": "a.cpp"},
                    {"original_filename": "b.c"},
                    {"original_filename": "c.cpp"},
                    {"original_filename": "d.c"},
                ],
                submission_repo=FakeSubmissionRepository(),
                execution_repo=erepo,
                conn=object(),
            )

        self.assertEqual(bundle["submission"]["language"], "C/C++")
        self.assertEqual(len(erepo.calls), 4)
        self.assertEqual(
            [
                call["execution_config"]["source_index"]
                for call in erepo.calls
            ],
            [0, 1, 2, 3],
        )
        self.assertEqual(
            [
                (
                    call["execution_config"]["source_language"],
                    call["execution_config"]["compiler"],
                )
                for call in erepo.calls
            ],
            [("C++", "g++"), ("C", "gcc"), ("C++", "g++"), ("C", "gcc")],
        )

    @patch(
        "Server.webapp.services.execution_creation_service.resolve_submission_course",
        return_value=None,
    )
    def test_caller_cannot_override_submission_language_or_flags(
        self,
        _resolve_course,
    ):
        common = {
            "user_id": 5,
            "title": "LCS upload",
            "archive_path": "/srv/uploads/a.zip",
            "archive_sha256": self.SHA,
            "benchmark": "LCS",
            "input_size": 500,
            "samples": 30,
            "source_specs": [{"original_filename": "src/main.cpp"}],
            "submission_repo": FakeSubmissionRepository(),
            "execution_repo": FakeExecutionRepository(),
            "conn": object(),
        }
        for override in (
            {"language": "C"},
            {"compiler_flags": "-O0"},
        ):
            with self.subTest(override=override):
                with self.assertRaises(InvalidExecutionRequest):
                    create_submission_bundle(**common, **override)


    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_bundle_uses_policy_hard_max_instead_of_legacy_limit(
        self,
        _resolve_course,
    ):
        with self.assertRaises(InvalidExecutionRequest):
            create_submission_bundle(
                user_id=5,
                title="LCS policy limit",
                archive_path="/tmp/test.zip",
                archive_sha256=self.SHA,
                benchmark="LCS",
                input_size=1001,
                samples=10,
                source_specs=[
                    {"original_filename": "main.cpp"}
                ],
                conn=object(),
                submission_repo=FakeSubmissionRepository(),
                execution_repo=FakeExecutionRepository(),
            )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_bundle_accepts_above_recommended_until_policy_hard_max(
        self,
        _resolve_course,
    ):
        srepo = FakeSubmissionRepository()
        erepo = FakeExecutionRepository()

        bundle = create_submission_bundle(
            user_id=5,
            title="LCS advanced range",
            archive_path="/tmp/test.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=1000,
            samples=10,
            source_specs=[
                {"original_filename": "main.cpp"}
            ],
            conn=object(),
            submission_repo=srepo,
            execution_repo=erepo,
        )

        self.assertEqual(
            len(bundle["executions"]),
            1,
        )
        self.assertEqual(
            erepo.calls[0]["input_size"],
            1000,
        )


class ExecutionPolicyLimitTests(unittest.TestCase):
    @staticmethod
    def _policy(**overrides):
        policy = {
            "benchmark": "LCS",
            "execution_profile": "QUICK",
            "minimum_input": 100,
            "default_input": 500,
            "recommended_max_input": 750,
            "hard_max_input": 1000,
            "input_step": 100,
            "operational_timeout_seconds": 960,
            "is_active": True,
        }
        policy.update(overrides)
        return policy

    def test_policy_accepts_recommended_boundary(self):
        result = validate_execution_policy_limits(
            "LCS",
            750,
            10,
            self._policy(),
        )

        self.assertFalse(result["above_recommended"])
        self.assertEqual(
            result["operational_timeout_seconds"],
            960,
        )

    def test_above_recommended_is_allowed_until_hard_max(self):
        result = validate_execution_policy_limits(
            "LCS",
            1000,
            10,
            self._policy(),
        )

        self.assertTrue(result["above_recommended"])
        self.assertEqual(
            result["hard_max_input"],
            1000,
        )

    def test_above_hard_max_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_policy_limits(
                "LCS",
                1001,
                10,
                self._policy(),
            )

    def test_policy_profile_must_match_samples(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_policy_limits(
                "LCS",
                500,
                30,
                self._policy(),
            )

    def test_camm_variant_accepts_camm_family_policy(self):
        result = validate_execution_policy_limits(
            "CAMMSO",
            100000,
            30,
            self._policy(
                benchmark="CAMM",
                execution_profile="BALANCED",
                minimum_input=1000,
                default_input=5000,
                recommended_max_input=75000,
                hard_max_input=100000,
                input_step=1000,
                operational_timeout_seconds=780,
            ),
        )

        self.assertEqual(
            result["benchmark"],
            "CAMM",
        )
        self.assertEqual(
            result["execution_profile"],
            "BALANCED",
        )
        self.assertTrue(
            result["above_recommended"]
        )

    def test_custom_profile_is_derived_from_nonpreset_samples(self):
        result = validate_execution_policy_limits(
            "SIZE",
            100000,
            17,
            self._policy(
                benchmark="SIZE",
                execution_profile="CUSTOM",
                minimum_input=100,
                default_input=2500,
                recommended_max_input=100000,
                hard_max_input=100000,
                input_step=100,
                operational_timeout_seconds=780,
            ),
        )

        self.assertEqual(
            result["execution_profile"],
            "CUSTOM",
        )

    def test_global_sample_ceiling_remains_enforced(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_policy_limits(
                "SIZE",
                2500,
                101,
                self._policy(
                    benchmark="SIZE",
                    execution_profile="CUSTOM",
                    minimum_input=100,
                    default_input=2500,
                    recommended_max_input=100000,
                    hard_max_input=100000,
                    input_step=100,
                    operational_timeout_seconds=780,
                ),
            )

    def test_inactive_policy_is_rejected(self):
        with self.assertRaises(InvalidExecutionRequest):
            validate_execution_policy_limits(
                "LCS",
                500,
                10,
                self._policy(
                    is_active=False,
                ),
            )
