import unittest
from unittest.mock import Mock, patch

from flask import Flask

from Server.webapp.routes.submissions_routes import submissions_bp
from Server.webapp.services.source_provenance_service import (
    SourceProvenanceError,
)
from Server.webapp.services.submission_repeat_service import (
    SubmissionRepeatConfigurationInvalid,
)


OWNER = {"id": 3, "role_name": "Student"}
TEACHER = {"id": 20, "role_name": "Teacher"}


class FakeConnection:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


class SubmissionRepeatRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(submissions_bp)
        self.client = app.test_client()

    def _get(self, *, user=OWNER, access_owner=3, service_value=None, error=None):
        conn = FakeConnection()
        descriptor = service_value or {
            "sourceSubmissionId": 7,
            "archiveFilename": "sorting.zip",
            "benchmark": "SIZE",
            "inputSize": 5000,
            "samples": 30,
            "executionProfile": "BALANCED",
            "courseId": None,
            "archiveUrl": "/api/submissions/7/archive",
        }
        service = Mock(
            side_effect=error,
            return_value=descriptor,
        )

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.submissions_routes.get_connection",
            return_value=conn,
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "_assert_current_user_can_view_submission",
            return_value={"owner_user_id": access_owner},
        ), patch(
            "Server.webapp.routes.submissions_routes."
            "get_submission_repeat_for_user",
            service,
        ):
            response = self.client.get("/api/submissions/7/repeat")

        return response, service, conn

    def test_owner_receives_read_only_repeat_contract(self):
        response, service, conn = self._get()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["repeat"]["archiveUrl"],
            "/api/submissions/7/archive",
        )
        service.assert_called_once_with(
            submission_id=7,
            current_user_id=OWNER["id"],
        )
        self.assertTrue(conn.closed)

    def test_non_owner_teacher_never_reaches_private_repeat_service(self):
        response, service, conn = self._get(
            user=TEACHER,
            access_owner=OWNER["id"],
        )

        self.assertEqual(response.status_code, 403)
        service.assert_not_called()
        self.assertTrue(conn.closed)

    def test_inconsistent_configuration_maps_to_explicit_409(self):
        response, _, _ = self._get(
            error=SubmissionRepeatConfigurationInvalid("inconsistent")
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "REPEAT_CONFIGURATION_INCONSISTENT",
        )

    def test_unavailable_archive_preserves_provenance_error_contract(self):
        response, _, _ = self._get(
            error=SourceProvenanceError(
                "ARCHIVE_UNAVAILABLE",
                "El archivo histórico no está disponible.",
                404,
            )
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "ARCHIVE_UNAVAILABLE",
        )

    def test_repeat_endpoint_does_not_accept_post_or_auto_run(self):
        response = self.client.post("/api/submissions/7/repeat")
        self.assertEqual(response.status_code, 405)


if __name__ == "__main__":
    unittest.main()
