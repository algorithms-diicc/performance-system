import tempfile
import unittest
from unittest.mock import patch

from Server.tests.test_ai_explanation_service import (
    fake_response,
    sample_results,
    valid_content,
)
from Server.tests.test_comparison_ai_service import (
    comparison_fixture,
    valid_output,
)
from Server.webapp.services.ai_explanation_service import (
    AIExplanationTimeoutError,
    generate_ai_explanation,
)
from Server.webapp.services.ai_runtime import (
    build_provider_shaped_response,
)
from Server.webapp.services.ai_transports import (
    AITransportTimeoutError,
    openai_http_transport,
)
from Server.webapp.services.comparison_ai_service import (
    ComparisonAIOutputRejectedError,
    ComparisonAITimeoutError,
    generate_comparison_ai_explanation,
)


class AIResilienceTests(unittest.TestCase):
    def test_transport_classifies_direct_timeout(self):
        with patch(
            "Server.webapp.services.ai_transports.urlopen",
            side_effect=TimeoutError("timed out"),
        ):
            with self.assertRaises(AITransportTimeoutError):
                openai_http_transport(
                    {"model": "test"},
                    "test-key",
                    timeout_seconds=1,
                )

    def test_comparison_repairs_one_rejected_output(self):
        requests = []
        invalid = valid_output()
        invalid["patterns"][0]["metric"] = "OutsideMetric"

        def transport(payload, api_key):
            del api_key
            requests.append(payload)
            content = invalid if len(requests) == 1 else valid_output()
            return build_provider_shaped_response(content)

        with tempfile.TemporaryDirectory() as temp_dir:
            result = generate_comparison_ai_explanation(
                static_dir=temp_dir,
                comparison_payload=comparison_fixture(),
                force=True,
                transport=transport,
                transport_name="test-provider",
                transport_simulated=False,
                language="es",
            )

        self.assertEqual(len(requests), 2)
        self.assertTrue(result["guardrails"]["repair_attempted"])
        self.assertEqual(result["guardrails"]["attempts"], 2)
        self.assertIn(
            "SOLICITUD DE CORRECCIÓN",
            requests[1]["input"][-1]["content"],
        )

    def test_comparison_stops_after_one_failed_repair(self):
        requests = []
        invalid = valid_output()
        invalid["patterns"][0]["metric"] = "OutsideMetric"

        def transport(payload, api_key):
            del api_key
            requests.append(payload)
            return build_provider_shaped_response(invalid)

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(
                ComparisonAIOutputRejectedError
            ):
                generate_comparison_ai_explanation(
                    static_dir=temp_dir,
                    comparison_payload=comparison_fixture(),
                    force=True,
                    transport=transport,
                    transport_name="test-provider",
                    language="es",
                )

        self.assertEqual(len(requests), 2)

    def test_comparison_exposes_typed_timeout(self):
        def transport(payload, api_key):
            del payload
            del api_key
            raise AITransportTimeoutError("timed out")

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(ComparisonAITimeoutError):
                generate_comparison_ai_explanation(
                    static_dir=temp_dir,
                    comparison_payload=comparison_fixture(),
                    force=True,
                    transport=transport,
                    transport_name="test-provider",
                    language="es",
                )

    def test_individual_repairs_one_rejected_output(self):
        requests = []
        invalid = valid_content("es")
        invalid["observations"][0]["metric"] = "OutsideMetric"

        def transport(payload, api_key):
            del api_key
            requests.append(payload)
            content = (
                invalid
                if len(requests) == 1
                else valid_content("es")
            )
            return fake_response(content)

        with tempfile.TemporaryDirectory() as temp_dir:
            result = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                force=True,
                transport=transport,
                transport_name="test-provider",
                transport_simulated=False,
                language="es",
            )

        self.assertEqual(len(requests), 2)
        self.assertTrue(result["guardrails"]["repair_attempted"])
        self.assertEqual(result["guardrails"]["attempts"], 2)
        self.assertIn(
            "SOLICITUD DE CORRECCIÓN",
            requests[1]["input"][-1]["content"],
        )

    def test_individual_exposes_typed_timeout(self):
        def transport(payload, api_key):
            del payload
            del api_key
            raise AITransportTimeoutError("timed out")

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(AIExplanationTimeoutError):
                generate_ai_explanation(
                    static_dir=temp_dir,
                    codename="123LCS",
                    results_payload=sample_results(),
                    force=True,
                    transport=transport,
                    transport_name="test-provider",
                    language="es",
                )


if __name__ == "__main__":
    unittest.main()
