import copy
import json
import os
import tempfile
import unittest

from Server.webapp.services.ai_runtime import (
    build_provider_shaped_response,
)
from Server.webapp.services.comparison_ai_service import (
    ComparisonAINotConfiguredError,
    ComparisonAIOutputRejectedError,
    ComparisonAIUnavailableError,
    build_comparison_ai_context,
    build_comparison_openai_request,
    generate_comparison_ai_explanation,
    validate_comparison_ai_output,
)


def comparison_fixture(status="LIMITED"):
    warnings = []
    excluded = []

    if status == "LIMITED":
        warnings = [
            {
                "code": "TARGET_METRIC_UNAVAILABLE",
                "dimension": "metrics",
                "metric": "EnergyPkg",
            }
        ]
        excluded = [
            {
                "metric": "EnergyPkg",
                "reasonCode": "TARGET_METRIC_UNAVAILABLE",
            }
        ]

    return {
        "schemaVersion": "1.0",
        "compatibility": {
            "status": status,
            "blockers": (
                [
                    {
                        "code": "HARDWARE_MISMATCH",
                        "dimension": "hardware",
                    }
                ]
                if status == "INCOMPATIBLE"
                else []
            ),
            "warnings": warnings,
            "commonInputSizes": [100, 200],
            "commonMetrics": [
                "DurationTime",
                "IPC",
            ],
            "excludedMetrics": excluded,
        },
        "executions": [
            {
                "publicId": "public-a",
                "codename": "aLCS",
                "sourceFilename": "a.c",
                "sourceLanguage": "C",
                "compiler": "gcc",
                "hardwareObserved": {
                    "toolchain": {
                        "compiler": "gcc",
                        "version": "gcc 9.4.0",
                    }
                },
            },
            {
                "publicId": "public-b",
                "codename": "bLCS",
                "sourceFilename": "b.cpp",
                "sourceLanguage": "C++",
                "compiler": "g++",
                "hardwareObserved": {
                    "toolchain": {
                        "compiler": "g++",
                        "version": "g++ 9.4.0",
                    }
                },
            },
        ],
        "metrics": (
            {}
            if status == "INCOMPATIBLE"
            else {
                "DurationTime": {
                    "unit": "ms",
                    "commonInputSizes": [100, 200],
                    "series": [
                        {
                            "publicId": "public-a",
                            "codename": "aLCS",
                            "sourceFilename": "a.cpp",
                            "points": [
                                {
                                    "inputSize": 100,
                                    "median": 10,
                                    "mean": 10.5,
                                    "q1": 9,
                                    "q3": 11,
                                    "stddev": 1,
                                },
                                {
                                    "inputSize": 200,
                                    "median": 20,
                                    "mean": 20.5,
                                    "q1": 19,
                                    "q3": 21,
                                    "stddev": 1,
                                },
                            ],
                        },
                        {
                            "publicId": "public-b",
                            "codename": "bLCS",
                            "sourceFilename": "b.cpp",
                            "points": [
                                {
                                    "inputSize": 100,
                                    "median": 12,
                                    "mean": 12.5,
                                    "q1": 11,
                                    "q3": 13,
                                    "stddev": 1,
                                },
                                {
                                    "inputSize": 200,
                                    "median": 30,
                                    "mean": 30.5,
                                    "q1": 29,
                                    "q3": 31,
                                    "stddev": 1,
                                },
                            ],
                        },
                    ],
                },
                "IPC": {
                    "unit": "ratio",
                    "commonInputSizes": [100, 200],
                    "series": [
                        {
                            "publicId": "public-a",
                            "codename": "aLCS",
                            "sourceFilename": "a.cpp",
                            "points": [
                                {
                                    "inputSize": 100,
                                    "median": 1.5,
                                    "mean": 1.55,
                                    "q1": 1.4,
                                    "q3": 1.6,
                                    "stddev": 0.1,
                                },
                                {
                                    "inputSize": 200,
                                    "median": 1.6,
                                    "mean": 1.65,
                                    "q1": 1.5,
                                    "q3": 1.7,
                                    "stddev": 0.1,
                                },
                            ],
                        },
                        {
                            "publicId": "public-b",
                            "codename": "bLCS",
                            "sourceFilename": "b.cpp",
                            "points": [
                                {
                                    "inputSize": 100,
                                    "median": 1.8,
                                    "mean": 1.85,
                                    "q1": 1.7,
                                    "q3": 1.9,
                                    "stddev": 0.1,
                                },
                                {
                                    "inputSize": 200,
                                    "median": 2.0,
                                    "mean": 2.05,
                                    "q1": 1.9,
                                    "q3": 2.1,
                                    "stddev": 0.1,
                                },
                            ],
                        },
                    ],
                },
            }
        ),
    }


def valid_output():
    return {
        "summary": (
            "La comparación contiene evidencia determinística común."
        ),
        "patterns": [
            {
                "metric": "DurationTime",
                "evidence_kind": "observation",
                "implementation_refs": [
                    "public-a",
                    "public-b",
                ],
                "text": (
                    "Para tiempo de ejecución, en el tamaño 200, "
                    "las medianas fueron 20 y 30."
                ),
            }
        ],
        "tradeoffs": [],
        "focus": [
            {
                "metric": "DurationTime",
                "text": (
                    "Conviene revisar tiempo de ejecución junto con "
                    "la dispersión reportada."
                ),
            }
        ],
        "limitations": [
            "La comparación tiene alcance limitado."
        ],
    }


class ComparisonAIServiceTests(unittest.TestCase):
    def test_context_is_private_language_neutral_and_derived_from_pedagogy(self):
        payload = comparison_fixture()
        payload["student_code"] = "int main(){}"
        payload["raw_csv"] = "secret"
        payload["browser_metric_override"] = 999

        context = build_comparison_ai_context(
            payload,
            language="en",
        )
        serialized = json.dumps(
            context,
            ensure_ascii=False,
        )

        self.assertNotIn("int main", serialized)
        self.assertNotIn("secret", serialized)
        self.assertNotIn("browser_metric_override", serialized)
        self.assertEqual(
            context["contract"]["presentation_contract"],
            "language-neutral-comparison-evidence-v1",
        )
        self.assertEqual(
            context["scope"]["status"],
            "LIMITED",
        )
        self.assertEqual(
            context["constraints"]["language"],
            "en",
        )
        self.assertEqual(
            set(context["metrics"].keys()),
            {"DurationTime", "IPC"},
        )
        self.assertEqual(
            context["implementations"][0]["source_language"],
            "C",
        )
        self.assertEqual(
            context["implementations"][0]["compiler"],
            "gcc",
        )
        self.assertEqual(
            context["implementations"][0]["compiler_version"],
            "gcc 9.4.0",
        )
        self.assertEqual(
            context["implementations"][1]["source_language"],
            "C++",
        )
        self.assertEqual(
            context["implementations"][1]["compiler"],
            "g++",
        )

    def test_request_has_own_comparative_schema_and_prompt(self):
        context = build_comparison_ai_context(
            comparison_fixture(),
            language="en",
        )
        request = build_comparison_openai_request(
            context,
            "model-x",
            language="en",
        )

        fmt = request["text"]["format"]
        self.assertEqual(
            fmt["name"],
            "performance_system_comparison_explanation",
        )
        self.assertTrue(fmt["strict"])
        self.assertEqual(
            set(fmt["schema"]["required"]),
            {
                "summary",
                "patterns",
                "tradeoffs",
                "focus",
                "limitations",
            },
        )
        self.assertIn(
            "Do not recompute metrics",
            request["input"][0]["content"],
        )
        self.assertEqual(request["max_output_tokens"], 2400)

        english_system = request["input"][0]["content"]
        self.assertIn("Mandatory output rules", english_system)
        self.assertIn("Every numeric literal", english_system)
        self.assertIn(
            "exact keys from STRUCTURED COMPARISON CONTEXT.metrics",
            english_system,
        )
        self.assertIn(
            "at most three concise sentences",
            english_system,
        )
        self.assertNotIn(
            "asymptotic complexity",
            english_system.lower(),
        )
        self.assertNotIn(
            "overall winner",
            english_system.lower(),
        )

        spanish_request = build_comparison_openai_request(
            build_comparison_ai_context(
                comparison_fixture(),
                language="es",
            ),
            "model-x",
            language="es",
        )
        spanish_system = spanish_request["input"][0]["content"]
        self.assertIn(
            "Reglas obligatorias de salida",
            spanish_system,
        )
        self.assertIn("Todo literal numérico", spanish_system)
        self.assertIn(
            "claves exactas de STRUCTURED COMPARISON CONTEXT.metrics",
            spanish_system,
        )
        self.assertIn(
            "como máximo tres oraciones breves",
            spanish_system,
        )
        self.assertNotIn(
            "complejidad asintótica",
            spanish_system.lower(),
        )
        self.assertNotIn(
            "ganador global",
            spanish_system.lower(),
        )

    def test_default_mock_uses_real_parser_guardrails_and_metadata(self):
        old_key = os.environ.pop("OPENAI_API_KEY", None)
        old_mode = os.environ.pop(
            "PERFORMANCE_AI_TRANSPORT",
            None,
        )

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                result = generate_comparison_ai_explanation(
                    static_dir=temp_dir,
                    comparison_payload=comparison_fixture(),
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
        self.assertEqual(result["comparison_status"], "LIMITED")
        self.assertTrue(result["guardrails"]["passed"])
        self.assertFalse(
            result["source"]["student_code_sent"]
        )
        self.assertFalse(
            result["source"]["raw_csv_sent"]
        )
        self.assertFalse(
            result["source"]["browser_metrics_trusted"]
        )
        self.assertTrue(
            result["source"]["canonical_server_comparison"]
        )
        self.assertGreater(
            len(result["content"]["patterns"]),
            0,
        )
        self.assertGreater(
            len(result["content"]["limitations"]),
            0,
        )

    def test_incompatible_never_invokes_transport(self):
        calls = {"count": 0}

        def transport(payload, api_key):
            calls["count"] += 1
            return build_provider_shaped_response(
                valid_output()
            )

        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(
                ComparisonAIUnavailableError
            ):
                generate_comparison_ai_explanation(
                    static_dir=temp_dir,
                    comparison_payload=comparison_fixture(
                        "INCOMPATIBLE"
                    ),
                    transport=transport,
                    transport_name="test-provider",
                )

        self.assertEqual(calls["count"], 0)

    def test_limited_output_must_keep_limitations(self):
        context = build_comparison_ai_context(
            comparison_fixture(),
            language="es",
        )
        output = valid_output()
        output["limitations"] = []

        with self.assertRaises(
            ComparisonAIOutputRejectedError
        ):
            validate_comparison_ai_output(
                output,
                context,
            )

    def test_rejects_unknown_metric_and_implementation(self):
        context = build_comparison_ai_context(
            comparison_fixture(),
            language="es",
        )

        output = valid_output()
        output["patterns"][0]["metric"] = "ImaginaryMetric"
        with self.assertRaises(
            ComparisonAIOutputRejectedError
        ):
            validate_comparison_ai_output(
                output,
                context,
            )

        output = valid_output()
        output["patterns"][0]["implementation_refs"] = [
            "public-a",
            "intruder",
        ]
        with self.assertRaises(
            ComparisonAIOutputRejectedError
        ):
            validate_comparison_ai_output(
                output,
                context,
            )

    def test_rejects_unreferenced_number_big_o_winner_and_causality(self):
        context = build_comparison_ai_context(
            comparison_fixture(),
            language="es",
        )

        cases = [
            "El valor principal fue 999.",
            "El algoritmo es O(n²).",
            "a.cpp es el ganador.",
            "La caché causa la diferencia observada.",
        ]

        for text in cases:
            output = valid_output()
            output["summary"] = text

            with self.assertRaises(
                ComparisonAIOutputRejectedError,
                msg=text,
            ):
                validate_comparison_ai_output(
                    output,
                    context,
                )

    def test_cache_is_separated_by_language_and_provider(self):
        calls = {"count": 0}

        def spanish_transport(payload, api_key):
            del payload
            del api_key
            calls["count"] += 1
            return build_provider_shaped_response(
                valid_output()
            )

        with tempfile.TemporaryDirectory() as temp_dir:
            first = generate_comparison_ai_explanation(
                static_dir=temp_dir,
                comparison_payload=comparison_fixture(),
                transport=spanish_transport,
                transport_name="provider-a",
                transport_simulated=False,
                language="es",
            )
            second = generate_comparison_ai_explanation(
                static_dir=temp_dir,
                comparison_payload=comparison_fixture(),
                transport=spanish_transport,
                transport_name="provider-a",
                transport_simulated=False,
                language="es",
            )

            english_output = valid_output()
            english_output["summary"] = (
                "The comparison contains shared deterministic evidence."
            )
            english_output["limitations"] = [
                "The comparison has limited scope."
            ]
            english_output["patterns"][0]["text"] = (
                "For execution time, at input size 200, "
                "the medians were 20 and 30."
            )
            english_output["focus"][0]["text"] = (
                "Inspect execution time together with reported dispersion."
            )

            third = generate_comparison_ai_explanation(
                static_dir=temp_dir,
                comparison_payload=comparison_fixture(),
                transport=lambda payload, api_key:
                    build_provider_shaped_response(
                        english_output
                    ),
                transport_name="provider-a",
                transport_simulated=False,
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

    def test_openai_mode_without_key_is_explicit(self):
        old_key = os.environ.pop("OPENAI_API_KEY", None)

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                with self.assertRaises(
                    ComparisonAINotConfiguredError
                ):
                    generate_comparison_ai_explanation(
                        static_dir=temp_dir,
                        comparison_payload=comparison_fixture(
                            "COMPATIBLE"
                        ),
                        transport_mode="openai",
                    )
        finally:
            if old_key is not None:
                os.environ["OPENAI_API_KEY"] = old_key


if __name__ == "__main__":
    unittest.main()
