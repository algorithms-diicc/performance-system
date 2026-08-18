import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.results_routes import results_bp
from Server.webapp.services.execution_access_service import (
    ExecutionAccessForbidden,
)
from Server.webapp.utils.api_errors import APIError


CURRENT_USER = {
    "id": 3,
    "role_name": "Student",
}
FOREIGN_TEACHER = {
    "id": 21,
    "role_name": "Teacher",
}


def results_payload():
    return {
        "schema_version": "1.3",
        "execution": {
            "codename": "exec10LCS",
            "measurement": {},
        },
        "processing": {},
        "metrics": {},
        "analysis": {},
        "pedagogy": {},
    }


class ResultsSubmissionNavigationTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(results_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _get_results(self, access_result, user=CURRENT_USER):
        access_patch = patch(
            "Server.webapp.routes.results_routes._assert_current_user_can_view",
            side_effect=(
                access_result
                if isinstance(access_result, Exception)
                else None
            ),
            return_value=(
                None
                if isinstance(access_result, Exception)
                else access_result
            ),
        )
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), access_patch, patch(
            "Server.webapp.routes.results_routes._assert_canonical_result_reference",
        ), patch(
            "Server.webapp.routes.results_routes.build_execution_results",
            return_value=results_payload(),
        ):
            return self.client.get(
                "/api/executions/exec10LCS/results"
            )

    def test_authorized_results_include_submission_id_without_private_fields(self):
        response = self._get_results({
            "submission_id": 42,
            "hardware_snapshot": {},
            "result_path": "webapp/static/private/CombinedResults.csv",
            "note": "metadata privada",
            "is_pinned": True,
        })

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["schema_version"], "1.3")
        self.assertEqual(payload["execution"]["submission_id"], 42)
        self.assertNotIn("result_path", payload["execution"])
        self.assertNotIn("note", payload["execution"])
        self.assertNotIn("isPinned", payload["execution"])
        self.assertNotIn("hardware_snapshot", payload["execution"])

    def test_foreign_teacher_remains_forbidden(self):
        response = self._get_results(
            ExecutionAccessForbidden("forbidden"),
            user=FOREIGN_TEACHER,
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"]["code"], "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
