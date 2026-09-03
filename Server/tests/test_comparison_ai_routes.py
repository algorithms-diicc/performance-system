from contextlib import ExitStack
import unittest
from unittest.mock import patch

from flask import Flask

from Server.tests.test_comparison_routes import (
    OWNER,
    access_row,
    fixture_maps,
)
from Server.webapp.routes.comparison_routes import comparisons_bp
from Server.webapp.services.ai_runtime import AIInvalidLanguageError
from Server.webapp.services.comparison_ai_service import (
    ComparisonAINotConfiguredError,
    ComparisonAIOutputRejectedError,
    ComparisonAIProviderError,
    ComparisonAITimeoutError,
    ComparisonAIUnavailableError,
)
from Server.webapp.services.comparison_service import build_comparison
from Server.webapp.utils.api_errors import APIError


class ComparisonAIRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(comparisons_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _post(
        self,
        body,
        *,
        user=OWNER,
        access_rows=None,
        export_rows=None,
        results=None,
        ai_side_effect=None,
        ai_return=None,
    ):
        default_access, default_export, default_results = fixture_maps()
        selected_access = access_rows or default_access
        selected_export = export_rows or default_export
        selected_results = results or default_results

        def get_access(codename):
            return selected_access.get(codename)

        def get_export(codename):
            return selected_export.get(codename)

        def get_results(*, codename, **_kwargs):
            return selected_results[codename]

        if ai_return is None:
            ai_return = {
                "schema_version": "1.0",
                "provider": "mock",
                "simulated": True,
                "language": body.get("language", "es")
                if isinstance(body, dict)
                else "es",
                "content": {
                    "summary": "comparative",
                    "patterns": [],
                    "tradeoffs": [],
                    "focus": [],
                    "limitations": [],
                },
            }

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators.get_current_user",
                    return_value=user,
                )
            )
            access_mock = stack.enter_context(
                patch(
                    "Server.webapp.repositories.execution_access_repository."
                    "get_execution_access_row_by_codename",
                    side_effect=get_access,
                )
            )
            export_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.export_repository."
                    "get_execution_export_row_by_codename",
                    side_effect=get_export,
                )
            )
            canonical_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "assert_canonical_result_reference"
                )
            )
            results_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "build_execution_results",
                    side_effect=get_results,
                )
            )
            comparison_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.build_comparison",
                    wraps=build_comparison,
                )
            )
            ai_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "generate_comparison_ai_explanation",
                    side_effect=ai_side_effect,
                    return_value=ai_return,
                )
            )

            response = self.client.post(
                "/api/comparisons/ai-explanation",
                json=body,
            )

            return response, {
                "access": access_mock,
                "export": export_mock,
                "canonical": canonical_mock,
                "results": results_mock,
                "comparison": comparison_mock,
                "ai": ai_mock,
            }

    def test_success_rebuilds_canonical_comparison_server_side(self):
        response, calls = self._post(
            {
                "executions": [" exec2SIZE ", "exec1SIZE"],
                "language": "en",
                "force": True,
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["provider"], "mock")

        contexts = calls["comparison"].call_args.args[0]
        self.assertEqual(
            [item["codename"] for item in contexts],
            ["exec2SIZE", "exec1SIZE"],
        )

        kwargs = calls["ai"].call_args.kwargs
        self.assertEqual(kwargs["language"], "en")
        self.assertTrue(kwargs["force"])
        self.assertEqual(
            [
                item["codename"]
                for item in kwargs["comparison_payload"]["executions"]
            ],
            ["exec2SIZE", "exec1SIZE"],
        )
        self.assertIn("pedagogy", kwargs["comparison_payload"])

    def test_browser_cannot_supply_scientific_payload(self):
        for extra_key, value in (
            ("metrics", {"DurationTime": 0}),
            ("comparison", {"compatibility": {"status": "COMPATIBLE"}}),
            ("pedagogy", {"fake": True}),
        ):
            with self.subTest(extra_key=extra_key):
                response, calls = self._post(
                    {
                        "executions": ["exec1SIZE", "exec2SIZE"],
                        extra_key: value,
                    }
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"]["code"],
                    "INVALID_COMPARISON_AI_REQUEST",
                )
                calls["access"].assert_not_called()
                calls["ai"].assert_not_called()

    def test_force_and_language_types_are_strict(self):
        cases = [
            ({"force": "true"}, "force"),
            ({"language": ["es"]}, "language"),
        ]

        for extra, name in cases:
            with self.subTest(name=name):
                response, calls = self._post(
                    {
                        "executions": ["exec1SIZE", "exec2SIZE"],
                        **extra,
                    }
                )
                self.assertEqual(response.status_code, 400)
                calls["access"].assert_not_called()
                calls["ai"].assert_not_called()

    def test_invalid_language_maps_to_400(self):
        response, calls = self._post(
            {
                "executions": ["exec1SIZE", "exec2SIZE"],
                "language": "fr",
            },
            ai_side_effect=AIInvalidLanguageError("unsupported"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "INVALID_AI_LANGUAGE",
        )
        calls["ai"].assert_called_once()

    def test_mixed_permission_is_all_or_nothing(self):
        access_rows, _, _ = fixture_maps()
        access_rows["exec2SIZE"] = access_row(
            "exec2SIZE",
            owner_id=30,
            teacher_id=22,
        )

        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            access_rows=access_rows,
        )

        self.assertEqual(response.status_code, 403)
        calls["export"].assert_not_called()
        calls["results"].assert_not_called()
        calls["comparison"].assert_not_called()
        calls["ai"].assert_not_called()

    def test_unavailable_comparison_maps_to_422(self):
        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            ai_side_effect=ComparisonAIUnavailableError("no basis"),
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "COMPARISON_AI_UNAVAILABLE",
        )
        calls["ai"].assert_called_once()

    def test_not_configured_maps_to_503(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            ai_side_effect=ComparisonAINotConfiguredError("no key"),
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "AI_NOT_CONFIGURED",
        )

    def test_provider_timeout_maps_to_504(self):
        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            ai_side_effect=ComparisonAITimeoutError("timeout"),
        )

        self.assertEqual(response.status_code, 504)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "AI_PROVIDER_TIMEOUT",
        )
        calls["ai"].assert_called_once()

    def test_provider_and_guardrail_failures_map_to_502(self):
        cases = [
            (
                ComparisonAIOutputRejectedError("rejected"),
                "AI_OUTPUT_REJECTED",
            ),
            (
                ComparisonAIProviderError("provider"),
                "AI_PROVIDER_ERROR",
            ),
        ]

        for error, code in cases:
            with self.subTest(code=code):
                response, _ = self._post(
                    {"executions": ["exec1SIZE", "exec2SIZE"]},
                    ai_side_effect=error,
                )
                self.assertEqual(response.status_code, 502)
                self.assertEqual(
                    response.get_json()["error"]["code"],
                    code,
                )

    def test_get_is_not_allowed(self):
        response = self.client.get(
            "/api/comparisons/ai-explanation"
        )
        self.assertEqual(response.status_code, 405)


if __name__ == "__main__":
    unittest.main()
