import copy
import json
import unittest

from Server.webapp.services.ai_explanation_service import (
    AIOutputRejectedError,
    build_ai_context,
    validate_ai_output,
)
from Server.webapp.services.interpretation_service import (
    build_results_analysis,
)
from Server.webapp.services.pedagogy_service import (
    build_pedagogical_interpretation,
)


def _metric(points, status="available", reason=None):
    total = sum(point.get("samples_total", 0) for point in points)

    availability = {
        "rows_total": total,
        "numeric": total if status in {"available", "partial"} else 0,
        "unsupported": total if status == "unsupported" else 0,
        "not_counted": total if status == "not_counted" else 0,
        "missing": 0,
        "groups_total": len(points),
        "groups_with_data": len(points) if points else 0,
    }

    return {
        "status": status,
        "reason": reason,
        "unit": "ms",
        "availability": availability,
        "points": points,
    }


def _single_point_results():
    metrics = {
        "DurationTime": _metric(
            [
                {
                    "source": "lcs.cpp",
                    "input_size": 500,
                    "mean": 482.0,
                    "median": 481.0,
                    "stddev": 17.736,
                    "samples_total": 30,
                    "samples_valid": 29,
                    "outliers_removed": 1,
                }
            ]
        ),
        "EnergyPkg": {
            "status": "not_counted",
            "reason": "counter_not_counted",
            "unit": "J",
            "availability": {
                "rows_total": 30,
                "numeric": 0,
                "unsupported": 0,
                "not_counted": 30,
                "missing": 0,
                "groups_total": 1,
                "groups_with_data": 0,
            },
            "points": [],
        },
    }

    analysis = build_results_analysis(metrics)
    pedagogy = build_pedagogical_interpretation(
        analysis,
        metrics,
    )

    return {
        "schema_version": "1.3",
        "execution": {
            "benchmark": "LCS",
            "input_size": 500,
            "samples": 30,
            "sources": ["lcs.cpp"],
        },
        "metrics": metrics,
        "analysis": analysis,
        "pedagogy": pedagogy,
    }


def _valid_ai_output():
    return {
        "summary": (
            "La ejecución entrega una medición puntual del tiempo "
            "para el tamaño de entrada 500."
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
            "Conviene medir más tamaños de entrada antes de "
            "interpretar el crecimiento."
        ),
    }


class ExplanationValidationTests(unittest.TestCase):
    def test_snapshot_is_traceable_to_analysis(self):
        payload = _single_point_results()

        analysis_source = (
            payload["analysis"]["metrics"]["DurationTime"]
            ["sources"][0]
        )
        snapshot_message = next(
            message
            for message in (
                payload["pedagogy"]["metrics"]["DurationTime"]
                ["messages"]
            )
            if message["kind"] == "snapshot"
        )

        self.assertEqual(
            snapshot_message["evidence"]["mean"],
            analysis_source["at_max_input"]["mean"],
        )
        self.assertEqual(
            snapshot_message["evidence"]["input_size"],
            analysis_source["at_max_input"]["input_size"],
        )

    def test_single_point_requires_explicit_limitation(self):
        payload = _single_point_results()

        messages = (
            payload["pedagogy"]["metrics"]["DurationTime"]
            ["messages"]
        )

        limitation = next(
            message
            for message in messages
            if message["kind"] == "limitation"
        )

        self.assertIn(
            "no es posible describir una tendencia",
            limitation["text"].lower(),
        )

    def test_unavailable_metric_is_never_described_as_zero(self):
        payload = _single_point_results()

        energy = payload["pedagogy"]["metrics"]["EnergyPkg"]

        self.assertEqual(energy["status"], "unavailable")
        self.assertIn(
            "no se interpreta como un valor cero",
            energy["messages"][0]["text"].lower(),
        )

    def test_ai_context_excludes_student_code_and_raw_csv(self):
        payload = _single_point_results()
        payload["student_code"] = "int main(){return 0;}"
        payload["raw_csv"] = "sensitive-raw-data"

        serialized = json.dumps(
            build_ai_context(payload),
            ensure_ascii=False,
        )

        self.assertNotIn("int main", serialized)
        self.assertNotIn("sensitive-raw-data", serialized)

    def test_ai_rejects_metric_without_evidence(self):
        context = build_ai_context(_single_point_results())
        output = _valid_ai_output()

        output["observations"][0]["metric"] = "ImaginaryMetric"

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(output, context)

    def test_ai_rejects_evidence_kind_not_available_for_metric(self):
        context = build_ai_context(_single_point_results())
        output = _valid_ai_output()

        output["observations"][0]["evidence_kind"] = "trend"

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(output, context)

    def test_ai_rejects_unreferenced_number(self):
        context = build_ai_context(_single_point_results())
        output = _valid_ai_output()

        output["summary"] = (
            "El tiempo principal fue 999 ms."
        )

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(output, context)

    def test_ai_rejects_asymptotic_claim(self):
        context = build_ai_context(_single_point_results())
        output = _valid_ai_output()

        output["student_takeaway"] = (
            "El algoritmo es O(n²)."
        )

        with self.assertRaises(AIOutputRejectedError):
            validate_ai_output(output, context)

    def test_valid_ai_output_passes_local_guardrails(self):
        context = build_ai_context(_single_point_results())

        validate_ai_output(
            _valid_ai_output(),
            context,
        )

    def test_ai_context_preserves_single_point_limitation(self):
        context = build_ai_context(_single_point_results())

        messages = (
            context["metrics"]["DurationTime"]["messages"]
        )

        self.assertTrue(
            any(
                message["kind"] == "limitation"
                for message in messages
            )
        )


if __name__ == "__main__":
    unittest.main()