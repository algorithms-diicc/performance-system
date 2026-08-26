import unittest
from unittest.mock import patch

from Server.webapp.services.experimental_protocol_service import (
    InvalidProtocolConfiguration,
    ProtocolUnavailable,
    normalize_protocol_configuration,
    resolve_submission_protocol,
)
from Server.webapp.services.execution_creation_service import (
    create_submission_bundle,
)


class FakeCursor:
    def __init__(self, row=None):
        self.row = row
        self.last_sql = ""
        self.last_params = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self.last_sql = sql
        self.last_params = params

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row=None):
        self.cursor_instance = FakeCursor(row=row)
        self.committed = False
        self.rolled_back = False

    def cursor(self, cursor_factory=None):
        return self.cursor_instance

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


class FakeSubmissionRepository:
    def __init__(self):
        self.calls = []

    def create_submission(self, **kwargs):
        self.calls.append(kwargs)
        return {
            "id": 77,
            "user_id": kwargs["user_id"],
            "course_id": kwargs.get("course_id"),
            "protocol_id": kwargs.get("protocol_id"),
            "title": kwargs["title"],
            "language": kwargs["language"],
            "file_path": kwargs["file_path"],
            "original_filename": kwargs.get("original_filename"),
            "code_hash": kwargs["code_hash"],
            "note": kwargs.get("note"),
            "is_pinned": False,
            "status": kwargs["status"],
        }


class FakeExecutionRepository:
    def create_execution(self, **kwargs):
        return {
            "id": 88,
            "public_id": "00000000-0000-0000-0000-000000000088",
            "submission_id": kwargs["submission_id"],
            "codename": kwargs["codename"],
            "execution_state": "QUEUED",
            "benchmark": kwargs["benchmark"],
            "input_size": kwargs["input_size"],
            "samples": kwargs["samples"],
            "execution_profile": kwargs["execution_profile"],
            "execution_config": kwargs["execution_config"],
        }


class ExperimentalProtocolContractTests(unittest.TestCase):
    SHA = "a" * 64

    def test_fixed_profile_is_normalized(self):
        config = normalize_protocol_configuration(
            {
                "title": "Laboratorio LCS",
                "objective": "Comparar dos implementaciones.",
                "benchmark": "lcs",
                "inputSize": 1000,
                "executionProfile": "rapido",
                "samples": 10,
            }
        )
        self.assertEqual(config["benchmark"], "LCS")
        self.assertEqual(config["execution_profile"], "QUICK")
        self.assertEqual(config["samples"], 10)
        self.assertIsNone(config["data_type"])

    def test_fixed_profile_rejects_inconsistent_samples(self):
        with self.assertRaises(InvalidProtocolConfiguration):
            normalize_protocol_configuration(
                {
                    "title": "Laboratorio LCS",
                    "objective": "Objetivo",
                    "benchmark": "LCS",
                    "inputSize": 1000,
                    "executionProfile": "rapido",
                    "samples": 30,
                }
            )

    def test_camm_requires_distribution(self):
        with self.assertRaises(InvalidProtocolConfiguration):
            normalize_protocol_configuration(
                {
                    "title": "CAMM",
                    "objective": "Objetivo",
                    "benchmark": "CAMM",
                    "inputSize": 5000,
                    "executionProfile": "equilibrado",
                    "samples": 30,
                }
            )

    def test_non_camm_rejects_distribution(self):
        with self.assertRaises(InvalidProtocolConfiguration):
            normalize_protocol_configuration(
                {
                    "title": "SIZE",
                    "objective": "Objetivo",
                    "benchmark": "SIZE",
                    "inputSize": 2500,
                    "executionProfile": "rapido",
                    "samples": 10,
                    "dataType": "cammr",
                }
            )

    def test_protocol_resolution_requires_published_active_student_membership(self):
        conn = FakeConnection(row={"id": 9, "course_id": 4})
        resolved = resolve_submission_protocol(
            user_id=31,
            requested_protocol_id=9,
            requested_course_id=4,
            conn=conn,
        )
        self.assertEqual(
            resolved,
            {"protocol_id": 9, "course_id": 4},
        )
        sql = conn.cursor_instance.last_sql
        self.assertIn("p.is_active = TRUE", sql)
        self.assertIn("p.is_published = TRUE", sql)
        self.assertIn("c.is_active = TRUE", sql)
        self.assertIn("cm.is_active = TRUE", sql)
        self.assertIn("LOWER(r.name) = 'student'", sql)

    def test_protocol_resolution_rejects_course_mismatch(self):
        conn = FakeConnection(row={"id": 9, "course_id": 4})
        with self.assertRaises(ProtocolUnavailable):
            resolve_submission_protocol(
                user_id=31,
                requested_protocol_id=9,
                requested_course_id=5,
                conn=conn,
            )

    def test_protocol_resolution_rejects_unavailable_protocol(self):
        with self.assertRaises(ProtocolUnavailable):
            resolve_submission_protocol(
                user_id=31,
                requested_protocol_id=9,
                conn=FakeConnection(row=None),
            )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_protocol",
        return_value={"protocol_id": 9, "course_id": 4},
    )
    def test_submission_persists_protocol_and_derived_course(
        self,
        _resolve_protocol,
    ):
        submission_repo = FakeSubmissionRepository()

        bundle = create_submission_bundle(
            user_id=31,
            title="Desde protocolo",
            archive_path="/srv/uploads/example.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=1000,
            samples=10,
            source_specs=[{"original_filename": "main.cpp"}],
            course_id=4,
            protocol_id=9,
            conn=FakeConnection(),
            submission_repo=submission_repo,
            execution_repo=FakeExecutionRepository(),
        )

        call = submission_repo.calls[0]
        self.assertEqual(call["course_id"], 4)
        self.assertEqual(call["protocol_id"], 9)
        self.assertEqual(bundle["submission"]["protocol_id"], 9)


if __name__ == "__main__":
    unittest.main()
