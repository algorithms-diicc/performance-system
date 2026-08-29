import unittest
from datetime import datetime, timezone

from Server.webapp.services.submission_history_service import (
    aggregate_state_label,
    build_submission_history_projection,
    derive_submission_aggregate_state,
    normalize_benchmark_family,
)


def aggregate_row(**overrides):
    row = {
        "executions_count": 0,
        "completed_executions": 0,
        "failed_executions": 0,
        "queued_executions": 0,
        "running_executions": 0,
        "processing_executions": 0,
        "cancelled_executions": 0,
        "benchmarks": [],
        "source_filenames": [],
        "measurement_node_names": [],
        "hardware_profile_names": [],
        "language": None,
        "created_at": datetime(
            2026,
            8,
            18,
            10,
            0,
            tzinfo=timezone.utc,
        ),
        "activity_at": None,
    }
    row.update(overrides)
    return row


class SubmissionHistoryServiceTests(unittest.TestCase):
    def test_empty_submission(self):
        self.assertEqual(
            derive_submission_aggregate_state(aggregate_row()),
            "EMPTY",
        )

    def test_active_execution_has_precedence(self):
        row = aggregate_row(
            executions_count=3,
            completed_executions=1,
            failed_executions=1,
            running_executions=1,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "IN_PROGRESS",
        )

    def test_all_completed(self):
        row = aggregate_row(
            executions_count=2,
            completed_executions=2,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "COMPLETED",
        )

    def test_mixed_success_and_failure_is_partial(self):
        row = aggregate_row(
            executions_count=2,
            completed_executions=1,
            failed_executions=1,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "PARTIAL",
        )

    def test_mixed_success_and_cancelled_is_partial(self):
        row = aggregate_row(
            executions_count=2,
            completed_executions=1,
            cancelled_executions=1,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "PARTIAL",
        )

    def test_unsuccessful_terminal_submission_is_failed(self):
        row = aggregate_row(
            executions_count=2,
            failed_executions=1,
            cancelled_executions=1,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "FAILED",
        )

    def test_all_cancelled_submission_is_cancelled(self):
        row = aggregate_row(
            executions_count=2,
            cancelled_executions=2,
        )
        self.assertEqual(
            derive_submission_aggregate_state(row),
            "CANCELLED",
        )

    def test_labels_are_stable(self):
        self.assertEqual(aggregate_state_label("PARTIAL"), "Parcial")
        self.assertEqual(aggregate_state_label("COMPLETED"), "Completado")
        self.assertEqual(aggregate_state_label("CANCELLED"), "Cancelado")

    def test_camm_variants_share_one_ui_family(self):
        for value in ("CAMM", "CAMMR", "CAMMS", "CAMMSO"):
            with self.subTest(value=value):
                self.assertEqual(
                    normalize_benchmark_family(value),
                    "CAMM",
                )

    def test_projection_deduplicates_benchmarks_and_sources(self):
        activity_at = datetime(
            2026,
            8,
            18,
            12,
            30,
            tzinfo=timezone.utc,
        )
        projection = build_submission_history_projection(
            aggregate_row(
                executions_count=3,
                completed_executions=3,
                benchmarks=["CAMMR", "CAMMR", "SIZE"],
                source_filenames=["a.cpp", "b.cpp", "a.cpp"],
                activity_at=activity_at,
            )
        )

        self.assertEqual(
            projection["benchmarks"],
            ["CAMMR", "SIZE"],
        )
        self.assertEqual(
            projection["benchmarkFamilies"],
            ["CAMM", "SIZE"],
        )
        self.assertEqual(
            projection["sourceFilenames"],
            ["a.cpp", "b.cpp"],
        )
        self.assertEqual(
            projection["activityAt"],
            activity_at.isoformat(),
        )

    def test_projection_exposes_registered_provenance_without_internal_ids(self):
        projection = build_submission_history_projection(
            aggregate_row(
                measurement_node_names=[
                    "Shenu",
                    "Shenu",
                ],
                hardware_profile_names=[
                    "Shenu Intel i5-9400",
                    "Shenu Intel i5-9400",
                ],
            )
        )

        self.assertEqual(
            projection["measurementNodes"],
            ["Shenu"],
        )
        self.assertEqual(
            projection["hardwareProfiles"],
            ["Shenu Intel i5-9400"],
        )
        self.assertNotIn(
            "measurementNodeIds",
            projection,
        )

    def test_projection_falls_back_to_submission_creation_time(self):
        row = aggregate_row()
        projection = build_submission_history_projection(row)
        self.assertEqual(
            projection["activityAt"],
            row["created_at"].isoformat(),
        )

    def test_projection_exposes_only_canonical_submission_languages(self):
        cases = (
            ("C", "C"),
            ("C++", "C++"),
            ("C/C++", "C/C++"),
            ("Python", None),
        )

        for persisted, expected in cases:
            with self.subTest(language=persisted):
                projection = build_submission_history_projection(
                    aggregate_row(language=persisted)
                )
                self.assertEqual(projection["language"], expected)

    def test_projection_preserves_c_and_cpp_source_extensions(self):
        projection = build_submission_history_projection(
            aggregate_row(
                language="C/C++",
                source_filenames=["main.c", "main.cpp"],
            )
        )

        self.assertEqual(projection["language"], "C/C++")
        self.assertEqual(
            projection["sourceFilenames"],
            ["main.c", "main.cpp"],
        )


if __name__ == "__main__":
    unittest.main()
