import unittest

from Server.webapp.services.execution_reuse_service import (
    ExecutionReuseForbidden,
    ExecutionReuseNotFound,
    build_execution_reuse_descriptor,
    get_execution_reuse_for_user,
)


class FakeRepository:
    def __init__(self, row):
        self.row = row
        self.requested_public_id = None

    def get_execution_reuse_row(self, public_id):
        self.requested_public_id = public_id
        return self.row


class ExecutionReuseServiceTests(unittest.TestCase):
    def make_row(self, **overrides):
        row = {
            "public_id": "11111111-1111-1111-1111-111111111111",
            "benchmark": "CAMMR",
            "input_size": 5000,
            "samples": 30,
            "execution_profile": "BALANCED",
            "owner_user_id": 7,
            "reusable_course_id": 12,
        }
        row.update(overrides)
        return row

    def test_builds_minimal_reuse_descriptor(self):
        descriptor = build_execution_reuse_descriptor(
            self.make_row(),
            current_user_id=7,
        )

        self.assertEqual(
            descriptor,
            {
                "sourcePublicId":
                    "11111111-1111-1111-1111-111111111111",
                "benchmark": "CAMMR",
                "inputSize": 5000,
                "samples": 30,
                "executionProfile": "BALANCED",
                "courseId": 12,
            },
        )

    def test_personal_or_inactive_course_is_not_copied(self):
        descriptor = build_execution_reuse_descriptor(
            self.make_row(reusable_course_id=None),
            current_user_id=7,
        )
        self.assertIsNone(descriptor["courseId"])

    def test_forbidden_for_another_owner(self):
        with self.assertRaises(ExecutionReuseForbidden):
            build_execution_reuse_descriptor(
                self.make_row(owner_user_id=99),
                current_user_id=7,
            )

    def test_missing_execution_is_not_found(self):
        with self.assertRaises(ExecutionReuseNotFound):
            build_execution_reuse_descriptor(
                None,
                current_user_id=7,
            )

    def test_repository_adapter_uses_public_id(self):
        repository = FakeRepository(self.make_row())

        descriptor = get_execution_reuse_for_user(
            "source-public-id",
            current_user_id=7,
            repository=repository,
        )

        self.assertEqual(
            repository.requested_public_id,
            "source-public-id",
        )
        self.assertEqual(descriptor["benchmark"], "CAMMR")

    def test_descriptor_does_not_expose_historical_artifacts(self):
        row = self.make_row(
            error_message="internal diagnostic",
            execution_config={"original_filename": "old.cpp"},
            result_path="/private/result.csv",
            submission_title="Old title",
        )

        descriptor = build_execution_reuse_descriptor(
            row,
            current_user_id=7,
        )

        self.assertNotIn("errorMessage", descriptor)
        self.assertNotIn("executionConfig", descriptor)
        self.assertNotIn("resultPath", descriptor)
        self.assertNotIn("submissionTitle", descriptor)


if __name__ == "__main__":
    unittest.main()
