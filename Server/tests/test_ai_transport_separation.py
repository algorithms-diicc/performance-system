import inspect
import unittest

from Server.webapp.services import ai_transports
from Server.webapp.services.ai_transports import (
    AITransportConfigurationError,
    MOCK_MODEL,
    resolve_ai_transport,
)
from Server.webapp.services.individual_ai_mock import (
    individual_mock_transport,
)


class AITransportSeparationTests(unittest.TestCase):
    def test_shared_transport_module_is_domain_neutral(self):
        source = inspect.getsource(ai_transports)

        forbidden = [
            "DurationTime",
            "student_takeaway",
            "_mock_observation_text",
            "context.get(\"metrics\")",
            "evidence_kind",
        ]

        for token in forbidden:
            self.assertNotIn(token, source)

    def test_mock_selection_requires_domain_callable(self):
        with self.assertRaises(AITransportConfigurationError):
            resolve_ai_transport(
                "mock",
                openai_model="unused",
            )

    def test_mock_selection_preserves_provider_metadata_and_callable(self):
        calls = {"count": 0}

        def fake_send(request_payload, api_key):
            calls["count"] += 1
            return {
                "status": "completed",
                "output": [],
                "echo": [request_payload, api_key],
            }

        selection = resolve_ai_transport(
            "mock",
            mock_send=fake_send,
            openai_model="unused",
        )

        self.assertEqual(selection.name, "mock")
        self.assertTrue(selection.simulated)
        self.assertFalse(selection.requires_api_key)
        self.assertEqual(selection.default_model, MOCK_MODEL)

        response = selection.send(
            {"model": "local"},
            None,
        )

        self.assertEqual(calls["count"], 1)
        self.assertEqual(response["status"], "completed")

    def test_individual_mock_remains_provider_shaped(self):
        context = {
            "execution": {
                "benchmark": "LCS",
            },
            "metrics": {
                "DurationTime": {
                    "messages": [
                        {
                            "kind": "snapshot",
                            "evidence": {
                                "input_size": 500,
                                "mean": 482,
                            },
                        }
                    ],
                }
            },
        }

        response = individual_mock_transport(
            request_payload={"model": "mock"},
            api_key=None,
            context=context,
            language="es",
        )

        self.assertEqual(response["status"], "completed")
        output = response["output"]
        self.assertEqual(output[0]["type"], "message")
        self.assertEqual(
            output[0]["content"][0]["type"],
            "output_text",
        )


if __name__ == "__main__":
    unittest.main()
