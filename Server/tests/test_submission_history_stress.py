import unittest
from collections import Counter
from datetime import datetime, timedelta, timezone

from Server.webapp.services.submission_history_service import (
    build_submission_history_projection,
)


TOTAL_SUBMISSIONS = 65


def aggregate_row(index):
    base = {
        "executions_count": 0,
        "completed_executions": 0,
        "failed_executions": 0,
        "queued_executions": 0,
        "running_executions": 0,
        "processing_executions": 0,
        "cancelled_executions": 0,
        "benchmarks": [],
        "source_filenames": [],
        "created_at": datetime(
            2026,
            8,
            1,
            12,
            0,
            tzinfo=timezone.utc,
        ),
        "activity_at": datetime(
            2026,
            8,
            18,
            23,
            0,
            tzinfo=timezone.utc,
        ) - timedelta(minutes=index),
    }

    mode = index % 5

    if mode == 0:
        # Submission creada pero todavía sin executions.
        return base

    source_filenames = [
        "src/main.cpp",
        "src/helper.cpp",
        "src/alternative.cpp",
        "src/main.cpp",
    ]

    if mode == 1:
        base.update(
            executions_count=3,
            completed_executions=1,
            queued_executions=1,
            running_executions=1,
            benchmarks=["CAMMR", "CAMMSO", "CAMMR"],
            source_filenames=source_filenames,
        )
    elif mode == 2:
        base.update(
            executions_count=3,
            completed_executions=3,
            benchmarks=["SIZE", "SIZE", "SIZE"],
            source_filenames=source_filenames,
        )
    elif mode == 3:
        base.update(
            executions_count=3,
            completed_executions=1,
            failed_executions=1,
            cancelled_executions=1,
            benchmarks=["LCS", "LCS", "LCS"],
            source_filenames=source_filenames,
        )
    else:
        base.update(
            executions_count=2,
            failed_executions=1,
            cancelled_executions=1,
            benchmarks=["CAMMS", "CAMMS"],
            source_filenames=[
                "failed.cpp",
                "cancelled.cpp",
                "failed.cpp",
            ],
        )

    return base


class SubmissionHistoryStressTests(unittest.TestCase):
    def test_projects_65_mixed_submissions_with_stable_aggregate_contract(self):
        projections = [
            build_submission_history_projection(
                aggregate_row(index)
            )
            for index in range(TOTAL_SUBMISSIONS)
        ]

        self.assertEqual(
            len(projections),
            TOTAL_SUBMISSIONS,
        )

        state_counts = Counter(
            projection["aggregateState"]
            for projection in projections
        )

        # 65 / 5 = 13 casos por cada familia de estado.
        self.assertEqual(
            state_counts,
            Counter(
                {
                    "EMPTY": 13,
                    "IN_PROGRESS": 13,
                    "COMPLETED": 13,
                    "PARTIAL": 13,
                    "FAILED": 13,
                }
            ),
        )

        for index, projection in enumerate(projections):
            expected_activity = aggregate_row(index)[
                "activity_at"
            ].isoformat()
            self.assertEqual(
                projection["activityAt"],
                expected_activity,
            )

        in_progress = projections[1]
        self.assertEqual(
            in_progress["benchmarkFamilies"],
            ["CAMM"],
        )
        self.assertEqual(
            in_progress["benchmarks"],
            ["CAMMR", "CAMMSO"],
        )
        self.assertEqual(
            in_progress["sourceFilenames"],
            [
                "src/main.cpp",
                "src/helper.cpp",
                "src/alternative.cpp",
            ],
        )
        self.assertEqual(
            in_progress["summary"]["executionsCount"],
            3,
        )

        partial = projections[3]
        self.assertEqual(
            partial["aggregateState"],
            "PARTIAL",
        )
        self.assertEqual(
            partial["summary"]["completedExecutions"],
            1,
        )
        self.assertEqual(
            partial["summary"]["failedExecutions"],
            1,
        )
        self.assertEqual(
            partial["summary"]["cancelledExecutions"],
            1,
        )

        failed = projections[4]
        self.assertEqual(
            failed["aggregateState"],
            "FAILED",
        )
        self.assertEqual(
            failed["sourceFilenames"],
            ["failed.cpp", "cancelled.cpp"],
        )


if __name__ == "__main__":
    unittest.main()
