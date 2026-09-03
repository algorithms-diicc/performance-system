from contextlib import ExitStack
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.results_routes import results_bp
from Server.webapp.services.ai_explanation_service import (
    AIExplanationTimeoutError,
    AIOutputRejectedError,
    AIProviderError,
)
from Server.webapp.utils.api_errors import APIError


USER = {"id": 3, "role_name": "Student"}


class IndividualAIResilienceRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(results_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _post(self, ai_error):
        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators."
                    "get_current_user",
                    return_value=USER,
                )
            )
            access_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.results_routes."
                    "_assert_current_user_can_view",
                    return_value={
                        "submission_id": 7,
                        "hardware_snapshot": {
                            "cpu_model": "Test CPU",
                        },
                    },
                )
            )
            canonical_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.results_routes."
                    "_assert_canonical_result_reference"
                )
            )
            results_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.results_routes."
                    "build_execution_results",
                    return_value={
                        "execution": {
                            "codename": "exec70LCS",
                        },
                        "metrics": {},
                        "analysis": {},
                        "pedagogy": {},
                    },
                )
            )
            ai_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.results_routes."
                    "generate_ai_explanation",
                    side_effect=ai_error,
                )
            )

            response = self.client.post(
                "/api/executions/exec70LCS/ai-explanation",
                json={
                    "language": "es",
                    "force": True,
                },
            )

        return response, {
            "access": access_mock,
            "canonical": canonical_mock,
            "results": results_mock,
            "ai": ai_mock,
        }

    def test_individual_ai_error_contract(self):
        cases = [
            (
                AIExplanationTimeoutError("timeout"),
                504,
                "AI_PROVIDER_TIMEOUT",
            ),
            (
                AIOutputRejectedError("rejected"),
                502,
                "AI_OUTPUT_REJECTED",
            ),
            (
                AIProviderError("provider"),
                502,
                "AI_PROVIDER_ERROR",
            ),
        ]

        for error, expected_status, expected_code in cases:
            with self.subTest(code=expected_code):
                response, calls = self._post(error)

                self.assertEqual(
                    response.status_code,
                    expected_status,
                )
                self.assertEqual(
                    response.get_json()["error"]["code"],
                    expected_code,
                )

                calls["access"].assert_called_once()
                calls["canonical"].assert_called_once()
                calls["results"].assert_called_once()
                calls["ai"].assert_called_once()


if __name__ == "__main__":
    unittest.main()
