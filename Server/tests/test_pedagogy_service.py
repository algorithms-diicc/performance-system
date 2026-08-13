import unittest

from Server.webapp.services.interpretation_service import (
    build_results_analysis,
)
from Server.webapp.services.pedagogy_service import (
    build_pedagogical_interpretation,
)


def metric(points, status="available", reason=None):
    total = sum(point.get("samples_total", 0) for point in points)

    return {
        "status": status,
        "reason": reason,
        "unit": "ms",
        "availability": {
            "rows_total": total,
            "numeric": total if status in {"available", "partial"} else 0,
            "unsupported": 0,
            "not_counted": 0,
            "missing": 0,
            "groups_total": len(points),
            "groups_with_data": len(points),
        },
        "points": points,
    }


class PedagogyServiceTests(unittest.TestCase):
    def test_single_point_generates_snapshot_and_limitation(self):
        metrics = {
            "DurationTime": metric(
                [
                    {
                        "source": "a.cpp",
                        "input_size": 500,
                        "mean": 100.0,
                        "median": 99.0,
                        "stddev": 5.0,
                        "samples_total": 30,
                        "samples_valid": 27,
                        "outliers_removed": 3,
                    }
                ]
            )
        }

        analysis = build_results_analysis(metrics)
        pedagogy = build_pedagogical_interpretation(
            analysis,
            metrics,
        )

        messages = pedagogy["metrics"]["DurationTime"]["messages"]
        kinds = [message["kind"] for message in messages]

        self.assertIn("snapshot", kinds)
        self.assertIn("limitation", kinds)
        self.assertIn("outliers", kinds)
        self.assertFalse(pedagogy["generation"]["uses_ai"])

    def test_trend_message_reports_exact_relative_change(self):
        points = []
        for x, y in [(100, 10), (200, 20), (300, 30)]:
            points.append(
                {
                    "source": "a.cpp",
                    "input_size": x,
                    "mean": y,
                    "median": y,
                    "stddev": 1.0,
                    "samples_total": 30,
                    "samples_valid": 30,
                    "outliers_removed": 0,
                }
            )

        metrics = {"DurationTime": metric(points)}
        analysis = build_results_analysis(metrics)
        pedagogy = build_pedagogical_interpretation(
            analysis,
            metrics,
        )

        trend = next(
            message
            for message in pedagogy["metrics"]["DurationTime"]["messages"]
            if message["kind"] == "trend"
        )

        self.assertIn("aumento de 200 %", trend["text"])
        self.assertEqual(
            trend["evidence"]["pairwise"]["increasing"],
            2,
        )

    def test_scaling_message_contains_explicit_limitation(self):
        points = []
        for x in [10, 20, 40, 80]:
            y = 3.0 * (x ** 2)
            points.append(
                {
                    "source": "quadratic.cpp",
                    "input_size": x,
                    "mean": y,
                    "median": y,
                    "stddev": y * 0.01,
                    "samples_total": 30,
                    "samples_valid": 30,
                    "outliers_removed": 0,
                }
            )

        metrics = {"DurationTime": metric(points)}
        analysis = build_results_analysis(metrics)
        pedagogy = build_pedagogical_interpretation(
            analysis,
            metrics,
        )

        scaling = next(
            message
            for message in pedagogy["metrics"]["DurationTime"]["messages"]
            if message["kind"] == "observed_scaling"
        )

        self.assertIn("exponente empírico de 2", scaling["text"])
        self.assertIn(
            "no constituye una clasificación de complejidad asintótica",
            scaling["text"],
        )

    def test_unavailable_metric_does_not_claim_zero(self):
        metrics = {
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
            }
        }

        analysis = build_results_analysis(metrics)
        pedagogy = build_pedagogical_interpretation(
            analysis,
            metrics,
        )

        item = pedagogy["metrics"]["EnergyPkg"]
        self.assertEqual(item["status"], "unavailable")
        self.assertIn(
            "no se interpreta como un valor cero",
            item["messages"][0]["text"],
        )

    def test_summary_prioritizes_primary_metrics(self):
        metrics = {}
        for metric_name in ["DurationTime", "IPC", "Instructions"]:
            metrics[metric_name] = metric(
                [
                    {
                        "source": "a.cpp",
                        "input_size": 500,
                        "mean": 10.0,
                        "median": 10.0,
                        "stddev": 1.0,
                        "samples_total": 30,
                        "samples_valid": 30,
                        "outliers_removed": 0,
                    }
                ]
            )

        analysis = build_results_analysis(metrics)
        pedagogy = build_pedagogical_interpretation(
            analysis,
            metrics,
        )

        highlights = pedagogy["summary"]["highlights"]
        self.assertEqual(len(highlights), 3)
        self.assertEqual(highlights[0]["metric"], "DurationTime")
