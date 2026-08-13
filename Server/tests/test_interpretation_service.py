import math
import unittest

from Server.webapp.services.interpretation_service import (
    build_results_analysis,
)


def metric(points, status="available"):
    total = sum(point.get("samples_total", 0) for point in points)
    valid = sum(point.get("samples_valid", 0) for point in points)

    return {
        "status": status,
        "reason": None,
        "unit": "ms",
        "availability": {
            "rows_total": total,
            "numeric": total,
            "unsupported": 0,
            "not_counted": 0,
            "missing": 0,
            "groups_total": len(points),
            "groups_with_data": len(points),
        },
        "points": points,
    }


class InterpretationServiceTests(unittest.TestCase):
    def test_single_point_variability_and_outliers(self):
        payload = build_results_analysis(
            {
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
        )

        source = payload["metrics"]["DurationTime"]["sources"][0]

        self.assertAlmostEqual(
            source["at_max_input"]["coefficient_of_variation"],
            0.05,
        )
        self.assertAlmostEqual(
            source["at_max_input"]["outlier_rate"],
            0.1,
        )
        self.assertEqual(
            source["trend"]["status"],
            "insufficient_points",
        )

    def test_trend_relative_change_and_linear_fit(self):
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

        payload = build_results_analysis(
            {"DurationTime": metric(points)}
        )
        trend = payload["metrics"]["DurationTime"]["sources"][0]["trend"]

        self.assertEqual(trend["status"], "available")
        self.assertAlmostEqual(trend["relative_change"], 2.0)
        self.assertAlmostEqual(trend["linear_fit"]["slope"], 0.1)
        self.assertAlmostEqual(trend["linear_fit"]["r_squared"], 1.0)
        self.assertEqual(trend["pairwise"]["increasing"], 2)

    def test_log_log_scaling_exponent(self):
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

        payload = build_results_analysis(
            {"DurationTime": metric(points)}
        )
        scaling = payload["metrics"]["DurationTime"]["sources"][0][
            "observed_scaling"
        ]

        self.assertEqual(scaling["status"], "available")
        self.assertAlmostEqual(scaling["exponent"], 2.0, places=10)
        self.assertAlmostEqual(scaling["r_squared"], 1.0, places=10)

    def test_multiple_sources_are_not_mixed(self):
        points = [
            {
                "source": "a.cpp",
                "input_size": 100,
                "mean": 10,
                "median": 10,
                "stddev": 1,
                "samples_total": 10,
                "samples_valid": 10,
                "outliers_removed": 0,
            },
            {
                "source": "b.cpp",
                "input_size": 100,
                "mean": 20,
                "median": 20,
                "stddev": 2,
                "samples_total": 10,
                "samples_valid": 10,
                "outliers_removed": 0,
            },
        ]

        payload = build_results_analysis(
            {"DurationTime": metric(points)}
        )

        self.assertEqual(
            payload["metrics"]["DurationTime"]["source_count"],
            2,
        )

    def test_unavailable_metric_is_preserved(self):
        payload = build_results_analysis(
            {
                "EnergyPkg": {
                    "status": "not_counted",
                    "reason": "counter_not_counted",
                    "unit": "J",
                    "availability": {
                        "rows_total": 30,
                        "numeric": 0,
                        "not_counted": 30,
                        "unsupported": 0,
                        "missing": 0,
                        "groups_total": 1,
                        "groups_with_data": 0,
                    },
                    "points": [],
                }
            }
        )

        item = payload["metrics"]["EnergyPkg"]

        self.assertEqual(item["status"], "unavailable")
        self.assertEqual(item["metric_status"], "not_counted")
        self.assertEqual(item["coverage"]["not_counted"], 30)
if __name__ == "__main__":
    unittest.main()