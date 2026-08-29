import unittest

from Server.webapp.services.source_provenance_service import (
    ArchiveSnapshot,
    SourceProvenanceError,
)
from Server.webapp.services.submission_repeat_service import (
    SubmissionRepeatConfigurationInvalid,
    SubmissionRepeatForbidden,
    SubmissionRepeatNotFound,
    build_submission_repeat_descriptor,
    get_submission_repeat_for_user,
)


def archive_row(**overrides):
    row = {
        "submission_id": 7,
        "owner_user_id": 3,
        "archive_original_filename": "sorting.zip",
    }
    row.update(overrides)
    return row


def configuration_row(**overrides):
    row = {
        "owner_user_id": 3,
        "benchmark": "CAMMR",
        "input_size": 5000,
        "samples": 30,
        "execution_profile": "BALANCED",
        "reusable_course_id": 12,
    }
    row.update(overrides)
    return row


def verified(_row):
    return ArchiveSnapshot(
        integrity="verified",
        available=True,
        expected_sha256="a" * 64,
        data=b"verified-zip",
    )


class FakeRepository:
    def __init__(self, archive, configurations):
        self.archive = archive
        self.configurations = configurations
        self.calls = []

    def get_submission_archive_by_id(self, submission_id):
        self.calls.append(("archive", submission_id))
        return self.archive

    def list_submission_repeat_configurations(self, submission_id):
        self.calls.append(("configurations", submission_id))
        return self.configurations


class SubmissionRepeatServiceTests(unittest.TestCase):
    def test_builds_minimal_descriptor_from_verified_common_configuration(self):
        descriptor = build_submission_repeat_descriptor(
            archive_row(),
            [
                configuration_row(
                    measurement_node_id=2,
                    hardware_profile_id=4,
                    measurement_node_mode="PINNED",
                    assigned_measurement_node_id=2,
                ),
                configuration_row(
                    measurement_node_id=2,
                    hardware_profile_id=4,
                    measurement_node_mode="PINNED",
                    assigned_measurement_node_id=2,
                ),
            ],
            current_user_id=3,
            archive_inspector=verified,
        )

        self.assertEqual(
            descriptor,
            {
                "sourceSubmissionId": 7,
                "archiveFilename": "sorting.zip",
                "benchmark": "CAMMR",
                "inputSize": 5000,
                "samples": 30,
                "executionProfile": "BALANCED",
                "courseId": 12,
                "archiveUrl": "/api/submissions/7/archive",
            },
        )

    def test_inactive_course_is_not_reused(self):
        descriptor = build_submission_repeat_descriptor(
            archive_row(),
            [configuration_row(reusable_course_id=None)],
            current_user_id=3,
            archive_inspector=verified,
        )
        self.assertIsNone(descriptor["courseId"])

    def test_missing_submission_is_not_found(self):
        with self.assertRaises(SubmissionRepeatNotFound):
            build_submission_repeat_descriptor(
                None,
                [],
                current_user_id=3,
                archive_inspector=verified,
            )

    def test_non_owner_is_forbidden(self):
        with self.assertRaises(SubmissionRepeatForbidden):
            build_submission_repeat_descriptor(
                archive_row(),
                [configuration_row()],
                current_user_id=99,
                archive_inspector=verified,
            )

    def test_missing_executions_cannot_repeat_as_a_set(self):
        with self.assertRaises(SubmissionRepeatConfigurationInvalid):
            build_submission_repeat_descriptor(
                archive_row(),
                [],
                current_user_id=3,
                archive_inspector=verified,
            )

    def test_inconsistent_siblings_return_conflict_domain_error(self):
        with self.assertRaises(SubmissionRepeatConfigurationInvalid):
            build_submission_repeat_descriptor(
                archive_row(),
                [
                    configuration_row(),
                    configuration_row(samples=50),
                ],
                current_user_id=3,
                archive_inspector=verified,
            )

    def test_unverified_and_mismatch_archives_remain_unavailable(self):
        for integrity in ("unverified", "mismatch"):
            with self.subTest(integrity=integrity):
                def inspect(_row, state=integrity):
                    return ArchiveSnapshot(
                        integrity=state,
                        available=False,
                        expected_sha256="a" * 64,
                    )

                with self.assertRaises(SourceProvenanceError) as raised:
                    build_submission_repeat_descriptor(
                        archive_row(),
                        [configuration_row()],
                        current_user_id=3,
                        archive_inspector=inspect,
                    )
                self.assertEqual(raised.exception.status_code, 409)

    def test_repository_adapter_is_read_only_and_submission_scoped(self):
        repository = FakeRepository(
            archive_row(),
            [configuration_row()],
        )

        descriptor = get_submission_repeat_for_user(
            7,
            current_user_id=3,
            repository=repository,
            archive_inspector=verified,
        )

        self.assertEqual(descriptor["sourceSubmissionId"], 7)
        self.assertEqual(
            repository.calls,
            [("archive", 7), ("configurations", 7)],
        )


if __name__ == "__main__":
    unittest.main()
