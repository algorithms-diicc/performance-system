import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.execution_status_routes import execution_status_bp
from Server.webapp.services.execution_cancellation_service import (
    ExecutionCancellationConflict,
    ExecutionCancellationForbidden,
    ExecutionCancellationNotFound,
)
from Server.webapp.utils.api_errors import APIError


PUBLIC_ID = "00000000-0000-0000-0000-000000000101"
OWNER = {"id": 10, "role_name": "Student"}


class ExecutionCancellationRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True)
        app.register_blueprint(execution_status_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def request(self, user, outcome):
        cancellation_mock = (
            {"side_effect": outcome}
            if isinstance(outcome, Exception)
            else {"return_value": outcome}
        )
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.execution_status_routes.cancel_queued_execution",
            **cancellation_mock,
        ) as cancel:
            response = self.client.post(
                "/api/executions/{}/cancel".format(PUBLIC_ID)
            )
        return response, cancel

    def test_success_returns_authoritative_cancelled_execution(self):
        response, cancel = self.request(
            OWNER,
            {
                "publicId": PUBLIC_ID,
                "state": "CANCELLED",
                "terminal": True,
                "canCancel": False,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["execution"]["state"], "CANCELLED")
        self.assertEqual(cancel.call_args.kwargs["current_user_id"], OWNER["id"])

    def test_expected_service_errors_use_public_status_codes(self):
        cases = (
            (ExecutionCancellationNotFound(), 404, "NOT_FOUND"),
            (ExecutionCancellationForbidden(), 403, "FORBIDDEN"),
            (ExecutionCancellationConflict(), 409, "CONFLICT"),
        )
        for error, status, code in cases:
            with self.subTest(status=status):
                response, _ = self.request(OWNER, error)
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.get_json()["error"]["code"], code)

    def test_unauthenticated_request_is_rejected(self):
        response, cancel = self.request(None, {})

        self.assertEqual(response.status_code, 401)
        cancel.assert_not_called()


if __name__ == "__main__":
    unittest.main()
