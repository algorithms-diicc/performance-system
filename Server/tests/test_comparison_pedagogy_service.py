import copy
import json
import unittest

from Server.tests.test_comparison_service import build_fixture, set_v2_source
from Server.webapp.services.comparison_service import build_comparison


class ComparisonPedagogyServiceTests(unittest.TestCase):
    def _build(self, count=2, sizes=None):
        contexts, results = build_fixture(
            count=count,
            sizes=sizes,
        )
        return (
            contexts,
            results,
            build_comparison(contexts, results),
        )

    def test_contract_is_language_neutral_and_deterministic(self):
        _, _, payload = self._build()
        pedagogy = payload["pedagogy"]

        self.assertEqual(pedagogy["version"], "1.0")
        self.assertEqual(
            pedagogy["generation"]["type"],
            "deterministic_rules",
        )
        self.assertFalse(
            pedagogy["generation"]["uses_ai"]
        )
        self.assertFalse(
            pedagogy["generation"]["statistics_recomputed"]
        )
        self.assertTrue(
            pedagogy["generation"]["derived_from_reported_aggregates"]
        )
        self.assertEqual(
            pedagogy["generation"]["presentation_contract"],
            "language-neutral-comparison-evidence-v1",
        )
        serialized = json.dumps(pedagogy)
        self.assertNotIn(
            "Valores menores representan",
            serialized,
        )
        self.assertNotIn(
            "Cómo interpretar",
            serialized,
        )

    def test_snapshot_preserves_reported_aggregates(self):
        _, results, payload = self._build()
        original = (
            results[0]["metrics"]["DurationTime"]["points"][-1]
        )
        item = (
            payload["pedagogy"]["metrics"]["DurationTime"]
            ["observation"]["series"][0]
        )

        self.assertEqual(item["median"], original["median"])
        self.assertEqual(item["mean"], original["mean"])

        variability = (
            payload["pedagogy"]["metrics"]["DurationTime"]
            ["variability"]["series"][0]
        )
        self.assertEqual(variability["q1"], original["q1"])
        self.assertEqual(variability["q3"], original["q3"])
        self.assertEqual(
            variability["stddev"],
            original["stddev"],
        )

    def test_trend_describes_only_direction_between_reported_endpoints(self):
        _, _, payload = self._build()
        trend = (
            payload["pedagogy"]["metrics"]["DurationTime"]
            ["trend"]["series"][0]
        )

        self.assertEqual(trend["first"]["input_size"], 100)
        self.assertEqual(trend["last"]["input_size"], 300)
        self.assertEqual(
            trend["median_direction"],
            "increased",
        )
        self.assertEqual(
            trend["mean_direction"],
            "increased",
        )

    def test_partial_overlap_is_carried_as_context_not_recomputed(self):
        _, _, payload = self._build(
            sizes=((100, 200, 300), (200, 300, 400)),
        )
        pedagogy = payload["pedagogy"]

        self.assertEqual(
            pedagogy["scope"]["common_input_sizes"],
            [200, 300],
        )
        codes = {
            item["code"]
            for item in pedagogy["limitations"]["issues"]
        }
        self.assertIn("PARTIAL_INPUT_OVERLAP", codes)

    def test_source_toolchain_difference_is_preserved_as_a_limitation(self):
        contexts, results = build_fixture()
        set_v2_source(contexts[0], "impl1.c", "C", "gcc")

        payload = build_comparison(contexts, results)

        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        codes = {
            item["code"]
            for item in payload["pedagogy"]["limitations"]["issues"]
        }
        self.assertIn("SOURCE_TOOLCHAIN_DIFFERS", codes)
        self.assertIn("DurationTime", payload["pedagogy"]["metrics"])

    def test_excluded_target_metric_is_exposed_by_reason_code(self):
        contexts, results = build_fixture()
        del results[1]["metrics"]["EnergyPkg"]
        payload = build_comparison(contexts, results)

        excluded = {
            item["metric"]: item["reason_code"]
            for item in payload["pedagogy"]
            ["limitations"]["excluded_metrics"]
        }
        self.assertEqual(
            excluded["EnergyPkg"],
            "TARGET_METRIC_UNAVAILABLE",
        )
        self.assertNotIn(
            "EnergyPkg",
            payload["pedagogy"]["metrics"],
        )

    def test_incompatible_comparison_never_emits_metric_pedagogy(self):
        contexts, results = build_fixture()
        contexts[1]["benchmark"] = "OTHER"
        payload = build_comparison(contexts, results)

        self.assertEqual(
            payload["compatibility"]["status"],
            "INCOMPATIBLE",
        )
        self.assertEqual(
            payload["pedagogy"]["metrics"],
            {},
        )
        codes = {
            item["code"]
            for item in payload["pedagogy"]
            ["limitations"]["issues"]
        }
        self.assertIn("BENCHMARK_MISMATCH", codes)

    def test_pedagogy_never_reintroduces_private_fields(self):
        _, _, payload = self._build()
        serialized = json.dumps(payload["pedagogy"])

        for forbidden in (
            "owner_email",
            "result_path",
            "hardware_snapshot",
            "execution_config",
            "/private/",
            "private-note",
            "do-not-compare",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_same_inputs_keep_identical_pedagogy(self):
        contexts, results = build_fixture()
        first = build_comparison(
            copy.deepcopy(contexts),
            copy.deepcopy(results),
        )
        second = build_comparison(
            copy.deepcopy(contexts),
            copy.deepcopy(results),
        )

        self.assertEqual(
            first["pedagogy"],
            second["pedagogy"],
        )


if __name__ == "__main__":
    unittest.main()
