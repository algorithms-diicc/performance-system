import json
import os
import tempfile
import unittest

from Server.webapp.services.ai_explanation_service import (
    AIInvalidLanguageError,
    AINotConfiguredError,
    AIOutputRejectedError,
    build_ai_context,
    build_openai_request,
    generate_ai_explanation,
    normalize_ai_language,
    validate_ai_output,
)


def sample_results():
    return {
        "schema_version": "1.3",
        "execution": {
            "benchmark": "LCS",
            "input_size": 500,
            "samples": 30,
            "sources": ["lcs_template.cpp"],
        },
        "analysis": {
            "version": "1.0",
            "metrics": {
                "DurationTime": {
                    "status": "analyzed",
                    "metric_status": "available",
                }
            },
        },
        "pedagogy": {
            "version": "1.1",
            "generation": {
                "type": "deterministic_rules",
                "uses_ai": False,
                "presentation_contract":
                    "language-neutral-evidence-v1",
            },
            "summary": {
                "primary_metrics_available": ["DurationTime"],
                "primary_metrics_unavailable": [],
                "highlights": [
                    {
                        "kind": "snapshot",
                        "message_code": "snapshot",
                        "metric": "DurationTime",
                        "text": "Texto legacy que no debe entrar al contexto IA.",
                        "evidence": {
                            "input_size": 500,
                            "mean": 482,
                        },
                    }
                ],
            },
            "metrics": {
                "DurationTime": {
                    "status": "analyzed",
                    "messages": [
                        {
                            "kind": "snapshot",
                            "message_code": "snapshot",
                            "priority": "primary",
                            "source": "lcs_template.cpp",
                            "text": (
                                "Tiempo de ejecución: tamaño 500, valor 482."
                            ),
                            "evidence": {
                                "input_size": 500,
                                "mean": 482,
                            },
                        },
                        {
                            "kind": "limitation",
                            "message_code": "single_input_limitation",
                            "priority": "secondary",
                            "source": "lcs_template.cpp",
                            "text": "Existe un único tamaño de entrada.",
                            "evidence": {
                                "points_analyzed": 1,
                                "trend_status": "insufficient_points",
                            },
                        },
                    ],
                }
            },
        },
    }


def valid_content(language="es"):
    if language == "en":
        return {
            "summary":
                "The execution has deterministic evidence for input size 500.",
            "observations": [
                {
                    "metric": "DurationTime",
                    "evidence_kind": "snapshot",
                    "text":
                        "The observed evidence contains the value 482 for input size 500.",
                }
            ],
            "limitations": ["Only 1 input size is available."],
            "student_takeaway":
                "Interpret the result within the measured evidence.",
        }

    return {
        "summary":
            "La ejecución contiene evidencia determinística para el tamaño 500.",
        "observations": [
            {
                "metric": "DurationTime",
                "evidence_kind": "snapshot",
                "text":
                    "La evidencia observada contiene el valor 482 para el tamaño 500.",
            }
        ],
        "limitations": ["Sólo existe 1 tamaño de entrada."],
        "student_takeaway":
            "Interpreta el resultado dentro de la evidencia medida.",
    }


def fake_response(content):
    return {
        "status": "completed",
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(
                            content,
                            ensure_ascii=False,
                        ),
                    }
                ],
            }
        ],
    }


class AIExplanationServiceTests(unittest.TestCase):
    def test_context_is_language_neutral_and_private(self):
        results = sample_results()
        results["student_code"] = "int main(){}"
        results["raw_csv"] = "secret"

        context = build_ai_context(results, language="en")
        serialized = json.dumps(context, ensure_ascii=False)

        self.assertNotIn("int main", serialized)
        self.assertNotIn("secret", serialized)
        self.assertNotIn("Texto legacy", serialized)
        self.assertNotIn("Tiempo de ejecución:", serialized)
        self.assertEqual(context["constraints"]["language"], "en")
        self.assertEqual(
            context["contract"]["presentation_contract"],
            "language-neutral-evidence-v1",
        )
        self.assertEqual(
            context["metrics"]["DurationTime"]["messages"][0][
                "message_code"
            ],
            "snapshot",
        )

    def test_language_normalization_accepts_es_en_aliases(self):
        self.assertEqual(normalize_ai_language("es-CL"), "es")
        self.assertEqual(normalize_ai_language("en-US"), "en")

        with self.assertRaises(AIInvalidLanguageError):
            normalize_ai_language("fr")

    def test_request_uses_structured_outputs_and_requested_language(self):
        context = build_ai_context(sample_results(), language="en")
        request = build_openai_request(
            context,
            "gpt-5.6-luna",
            language="en",
        )

        fmt = request["text"]["format"]
        self.assertEqual(fmt["type"], "json_schema")
        self.assertTrue(fmt["strict"])
        self.assertFalse(request["store"])
        self.assertIn(
            "clear technical English",
            request["input"][0]["content"],
        )
        self.assertEqual(request["max_output_tokens"], 1600)

        english_system = request["input"][0]["content"]
        self.assertIn(
            "Every observations[].metric value",
            english_system,
        )
        self.assertIn("Every numeric literal", english_system)

        spanish_request = build_openai_request(
            build_ai_context(sample_results(), language="es"),
            "gpt-5.6-luna",
            language="es",
        )
        spanish_system = spanish_request["input"][0]["content"]
        self.assertIn(
            "cada valor observations[].metric",
            spanish_system,
        )
        self.assertIn("Todo literal numérico", spanish_system)

    def test_default_mock_needs_no_key_and_uses_real_pipeline(self):
        old_key = os.environ.pop("OPENAI_API_KEY", None)
        old_mode = os.environ.pop("PERFORMANCE_AI_TRANSPORT", None)

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                result = generate_ai_explanation(
                    static_dir=temp_dir,
                    codename="123LCS",
                    results_payload=sample_results(),
                    language="es",
                    force=True,
                )
        finally:
            if old_key is not None:
                os.environ["OPENAI_API_KEY"] = old_key
            if old_mode is not None:
                os.environ["PERFORMANCE_AI_TRANSPORT"] = old_mode

        self.assertEqual(result["provider"], "mock")
        self.assertTrue(result["simulated"])
        self.assertFalse(result["generated_by_ai"])
        self.assertEqual(result["language"], "es")
        self.assertEqual(
            result["model"],
            "local-deterministic-mock-v2",
        )
        self.assertTrue(result["guardrails"]["passed"])
        self.assertEqual(
            result["content"]["observations"][0]["metric"],
            "DurationTime",
        )
        observation_text = (
            result["content"]["observations"][0]["text"]
        )
        self.assertIn("500", observation_text)
        self.assertIn("482", observation_text)
        self.assertNotIn(
            "contiene un valor observado para",
            observation_text,
        )

    def test_cache_is_reused_only_for_same_provider_and_language(self):
        calls = {"count": 0}

        def transport(payload, api_key):
            del payload
            del api_key
            calls["count"] += 1
            return fake_response(valid_content("es"))

        with tempfile.TemporaryDirectory() as temp_dir:
            first = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                transport_name="test-provider",
                language="es",
            )
            second = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                transport_name="test-provider",
                language="es",
            )
            third = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=lambda payload, api_key:
                    fake_response(valid_content("en")),
                transport_name="test-provider",
                language="en",
            )

        self.assertEqual(calls["count"], 1)
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertFalse(third["cached"])
        self.assertNotEqual(
            first["context_hash"],
            third["context_hash"],
        )

    def test_cache_hash_separates_provider(self):
        calls = {"count": 0}

        def transport(payload, api_key):
            del payload
            del api_key
            calls["count"] += 1
            return fake_response(valid_content())

        with tempfile.TemporaryDirectory() as temp_dir:
            first = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                transport_name="provider-a",
                language="es",
            )
            second = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                transport_name="provider-b",
                language="es",
            )

        self.assertEqual(calls["count"], 2)
        self.assertNotEqual(
            first["context_hash"],
            second["context_hash"],
        )

    def test_openai_mode_without_api_key_is_explicit(self):
        old_key = os.environ.pop("OPENAI_API_KEY", None)

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                with self.assertRaises(AINotConfiguredError):
                    generate_ai_explanation(
                        static_dir=temp_dir,
                        codename="123LCS",
                        results_payload=sample_results(),
                        transport_mode="openai",
                        language="es",
                    )
        finally:
            if old_key is not None:
                os.environ["OPENAI_API_KEY"] = old_key

    def test_unreferenced_number_is_rejected(self):
        context = build_ai_context(sample_results(), language="es")
        content = valid_content()
        content["summary"] = "El resultado principal fue 999 ms."

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(content, context)

    def test_asymptotic_claim_is_rejected(self):
        context = build_ai_context(sample_results(), language="es")
        content = valid_content()
        content["student_takeaway"] = "El algoritmo es O(n²)."

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(content, context)


if __name__ == "__main__":
    unittest.main()
