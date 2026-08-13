import json
import os
import tempfile
import unittest

from Server.webapp.services.ai_explanation_service import (
    AINotConfiguredError,
    AIOutputRejectedError,
    build_ai_context,
    build_openai_request,
    generate_ai_explanation,
    parse_openai_structured_output,
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
            "version": "1.0",
            "summary": {
                "highlights": [],
            },
            "metrics": {
                "DurationTime": {
                    "status": "analyzed",
                    "messages": [
                        {
                            "kind": "snapshot",
                            "text": (
                                "Tiempo de ejecución: en el mayor tamaño "
                                "de entrada medido (500) la media fue "
                                "482 ms."
                            ),
                            "evidence": {
                                "input_size": 500,
                                "mean": 482,
                            },
                        },
                        {
                            "kind": "limitation",
                            "text": (
                                "Esta ejecución contiene un único tamaño "
                                "de entrada para esta métrica."
                            ),
                            "evidence": {
                                "points_analyzed": 1,
                            },
                        },
                    ],
                }
            },
        },
    }


def valid_content():
    return {
        "summary": (
            "La ejecución ofrece una lectura puntual del tiempo "
            "de ejecución en el tamaño de entrada 500."
        ),
        "observations": [
            {
                "metric": "DurationTime",
                "evidence_kind": "snapshot",
                "text": (
                    "El tiempo medio observado fue 482 ms para "
                    "el tamaño de entrada 500."
                ),
            }
        ],
        "limitations": [
            (
                "Sólo existe 1 tamaño de entrada, por lo que no "
                "puede inferirse una tendencia."
            )
        ],
        "student_takeaway": (
            "Interpreta este resultado como una medición puntual y "
            "compárala con otros tamaños antes de buscar tendencias."
        ),
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
    def test_context_does_not_include_student_code_or_raw_csv(self):
        results = sample_results()
        results["student_code"] = "int main(){}"
        results["raw_csv"] = "secret"

        context = build_ai_context(results)
        serialized = json.dumps(context)

        self.assertNotIn("int main", serialized)
        self.assertNotIn("secret", serialized)
        self.assertTrue(context["constraints"]["no_student_code"])
        self.assertTrue(context["constraints"]["no_raw_csv"])

    def test_request_uses_structured_outputs(self):
        request = build_openai_request(
            build_ai_context(sample_results()),
            "gpt-5.6-luna",
        )

        fmt = request["text"]["format"]

        self.assertEqual(fmt["type"], "json_schema")
        self.assertTrue(fmt["strict"])
        self.assertFalse(request["store"])
        self.assertEqual(request["model"], "gpt-5.6-luna")

    def test_generation_uses_cache_on_second_call(self):
        calls = {"count": 0}

        def transport(payload, api_key):
            calls["count"] += 1
            return fake_response(valid_content())

        with tempfile.TemporaryDirectory() as temp_dir:
            os.makedirs(
                os.path.join(temp_dir, "123LCS"),
                exist_ok=True,
            )

            first = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                api_key="test",
            )
            second = generate_ai_explanation(
                static_dir=temp_dir,
                codename="123LCS",
                results_payload=sample_results(),
                transport=transport,
                api_key="test",
            )

        self.assertEqual(calls["count"], 1)
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])

    def test_unreferenced_number_is_rejected(self):
        context = build_ai_context(sample_results())
        content = valid_content()
        content["summary"] = (
            "El resultado principal fue 999 ms."
        )

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(content, context)

    def test_asymptotic_claim_is_rejected(self):
        context = build_ai_context(sample_results())
        content = valid_content()
        content["student_takeaway"] = (
            "El algoritmo es O(n²)."
        )

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(content, context)

    def test_missing_api_key_is_explicit(self):
        old = os.environ.pop("OPENAI_API_KEY", None)

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                with self.assertRaises(AINotConfiguredError):
                    generate_ai_explanation(
                        static_dir=temp_dir,
                        codename="123LCS",
                        results_payload=sample_results(),
                    )
        finally:
            if old is not None:
                os.environ["OPENAI_API_KEY"] = old

if __name__ == "__main__":
    unittest.main()