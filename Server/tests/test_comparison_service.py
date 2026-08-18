import copy
import json
import unittest

from Server.webapp.services.comparison_service import (
    ComparisonResultsInvalid,
    build_comparison,
)


TARGET_UNITS = {
    "DurationTime": "ms",
    "IPC": "ratio",
    "CacheMissRate": "ratio",
    "BranchMissRate": "ratio",
    "EnergyPkg": "J",
    "Instructions": "count",
}


def make_context(codename, index):
    filename = "impl{}.cpp".format(index)
    return {
        "execution_id": 900 + index,
        "public_id": "public-{}".format(index),
        "codename": codename,
        "execution_state": "COMPLETED",
        "benchmark": "SIZE",
        "input_size": 300,
        "samples": 10,
        "execution_profile": "BALANCED",
        "execution_config": {
            "original_filename": "nested/{}".format(filename),
            "compiler_flags": "-O3",
            "measurement": {
                "schema_version": "1.0",
                "points": 3,
                "samples_per_point": 10,
                "warmup_rounds": 1,
                "perf_scope": "process",
                "single_event_fallback": True,
            },
            "private": "/private/config",
        },
        "hardware_snapshot": {
            "node": {
                "cpu_vendor": "GenuineIntel",
                "cpu_model": "Intel Core Test",
                "architecture": "x86_64",
                "logical_cpus": 8,
                "hostname": "private-host",
            },
            "measurement": {
                "backend": "perf",
                "perf_version": "perf version 6.8",
                "requested_perf_scope": "process",
                "private": "/private/backend",
            },
            "env": {"HOME": "/private/home"},
        },
        "result_available": True,
        "result_path": "/private/results/CombinedResults.csv",
        "submission_id": 100 + index,
        "submission_title": "Entrega {}".format(index),
        "archive_file_path": "/private/archive.zip",
        "owner_user_id": 700 + index,
        "owner_email": "private{}@example.test".format(index),
        "note": "private-note-{}".format(index),
    }


def make_point(input_size, factor, source):
    median = input_size * factor
    return {
        "source": source,
        "input_size": input_size,
        "median": median,
        "mean": median + 0.1,
        "stddev": 0.25,
        "q1": median - 0.2,
        "q3": median + 0.2,
        "iqr": 0.4,
        "samples_total": 10,
        "samples_valid": 10,
        "iqr_outliers_detected": 1,
        "raw_path": "/private/raw.csv",
    }


def make_results(index, sizes=(100, 200, 300)):
    source = "impl{}.cpp".format(index)
    metrics = {}
    for metric_index, (metric_name, unit) in enumerate(
        TARGET_UNITS.items(),
        start=1,
    ):
        factor = (index + metric_index) / 100.0
        metrics[metric_name] = {
            "status": "available",
            "reason": None,
            "unit": unit,
            "availability": {"private": "/private/availability"},
            "points": [
                make_point(input_size, factor, source)
                for input_size in sizes
            ],
        }
    return {
        "schema_version": "1.3",
        "execution": {
            "id": "internal",
            "results_file": {"path": "/private/result.csv"},
        },
        "processing": {},
        "metrics": metrics,
        "analysis": {"private": "do-not-compare"},
        "pedagogy": {"private": "do-not-compare"},
    }


def build_fixture(count=2, sizes=None):
    contexts = []
    results = []
    for index in range(1, count + 1):
        contexts.append(make_context("exec{}SIZE".format(index), index))
        selected_sizes = (
            sizes[index - 1]
            if sizes is not None
            else (100, 200, 300)
        )
        results.append(make_results(index, selected_sizes))
    return contexts, results


def issue_codes(payload, collection):
    return [
        item["code"]
        for item in payload["compatibility"][collection]
    ]


class ComparisonServiceTests(unittest.TestCase):
    def _build(self, count=2, sizes=None):
        contexts, results = build_fixture(count=count, sizes=sizes)
        return contexts, results, build_comparison(contexts, results)

    def test_two_exactly_compatible_executions_are_compatible(self):
        _, _, payload = self._build(2)
        self.assertEqual(payload["compatibility"]["status"], "COMPATIBLE")
        self.assertEqual(payload["compatibility"]["blockers"], [])
        self.assertEqual(payload["compatibility"]["warnings"], [])

    def test_three_compatible_executions_are_supported(self):
        _, _, payload = self._build(3)
        self.assertEqual(payload["compatibility"]["status"], "COMPATIBLE")
        self.assertEqual(len(payload["executions"]), 3)

    def test_four_compatible_executions_are_supported(self):
        _, _, payload = self._build(4)
        self.assertEqual(payload["compatibility"]["status"], "COMPATIBLE")
        self.assertEqual(len(payload["executions"]), 4)

    def test_request_order_is_preserved_in_executions_and_series(self):
        contexts, results = build_fixture(3)
        contexts = [contexts[2], contexts[0], contexts[1]]
        results = [results[2], results[0], results[1]]
        payload = build_comparison(contexts, results)
        expected = ["exec3SIZE", "exec1SIZE", "exec2SIZE"]
        self.assertEqual(
            [item["codename"] for item in payload["executions"]],
            expected,
        )
        self.assertEqual(
            [
                item["codename"]
                for item in payload["metrics"]["DurationTime"]["series"]
            ],
            expected,
        )

    def test_benchmark_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["benchmark"] = "LCS"
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "INCOMPATIBLE")
        self.assertIn("BENCHMARK_MISMATCH", issue_codes(payload, "blockers"))

    def test_missing_benchmark_is_unverified(self):
        contexts, results = build_fixture()
        contexts[1]["benchmark"] = None
        payload = build_comparison(contexts, results)
        self.assertIn("BENCHMARK_UNVERIFIED", issue_codes(payload, "blockers"))

    def test_hardware_model_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["node"]["cpu_model"] = "Other CPU"
        payload = build_comparison(contexts, results)
        self.assertIn("HARDWARE_MISMATCH", issue_codes(payload, "blockers"))

    def test_hardware_vendor_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["node"]["cpu_vendor"] = "AuthenticAMD"
        payload = build_comparison(contexts, results)
        self.assertIn("HARDWARE_MISMATCH", issue_codes(payload, "blockers"))

    def test_hardware_architecture_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["node"]["architecture"] = "aarch64"
        payload = build_comparison(contexts, results)
        self.assertIn("HARDWARE_MISMATCH", issue_codes(payload, "blockers"))

    def test_hardware_logical_cpu_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["node"]["logical_cpus"] = 16
        payload = build_comparison(contexts, results)
        self.assertIn("HARDWARE_MISMATCH", issue_codes(payload, "blockers"))

    def test_incomplete_hardware_is_unverified(self):
        contexts, results = build_fixture()
        del contexts[1]["hardware_snapshot"]["node"]["cpu_model"]
        payload = build_comparison(contexts, results)
        self.assertIn("HARDWARE_UNVERIFIED", issue_codes(payload, "blockers"))

    def test_hardware_text_comparison_is_case_and_whitespace_tolerant(self):
        contexts, results = build_fixture()
        node = contexts[1]["hardware_snapshot"]["node"]
        node["cpu_vendor"] = " genuineintel "
        node["cpu_model"] = "Intel   Core Test"
        node["architecture"] = "X86_64"
        payload = build_comparison(contexts, results)
        self.assertNotIn("HARDWARE_MISMATCH", issue_codes(payload, "blockers"))

    def test_measurement_backend_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["measurement"]["backend"] = "other"
        payload = build_comparison(contexts, results)
        self.assertIn(
            "MEASUREMENT_BACKEND_MISMATCH",
            issue_codes(payload, "blockers"),
        )

    def test_missing_measurement_backend_is_unverified(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["measurement"]["backend"] = None
        payload = build_comparison(contexts, results)
        self.assertIn(
            "MEASUREMENT_BACKEND_UNVERIFIED",
            issue_codes(payload, "blockers"),
        )

    def test_perf_version_difference_is_limited_not_blocking(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["measurement"]["perf_version"] = "perf 7"
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        self.assertIn(
            "MEASUREMENT_BACKEND_VERSION_DIFFERS",
            issue_codes(payload, "warnings"),
        )

    def test_missing_perf_version_is_limited(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["measurement"]["perf_version"] = None
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        self.assertIn(
            "MEASUREMENT_BACKEND_VERSION_UNVERIFIED",
            issue_codes(payload, "warnings"),
        )

    def test_profile_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_profile"] = "QUICK"
        payload = build_comparison(contexts, results)
        self.assertIn("PROFILE_MISMATCH", issue_codes(payload, "blockers"))

    def test_missing_profile_is_unverified(self):
        contexts, results = build_fixture()
        contexts[1]["execution_profile"] = None
        payload = build_comparison(contexts, results)
        self.assertIn("PROFILE_UNVERIFIED", issue_codes(payload, "blockers"))

    def test_protocol_points_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["measurement"]["points"] = 4
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_protocol_samples_per_point_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["measurement"]["samples_per_point"] = 12
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_protocol_warmup_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["measurement"]["warmup_rounds"] = 2
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_protocol_perf_scope_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["measurement"]["perf_scope"] = "system"
        contexts[1]["hardware_snapshot"]["measurement"]["requested_perf_scope"] = "system"
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_protocol_single_event_fallback_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["measurement"]["single_event_fallback"] = False
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_incomplete_protocol_is_unverified(self):
        contexts, results = build_fixture()
        del contexts[1]["execution_config"]["measurement"]["schema_version"]
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_UNVERIFIED", issue_codes(payload, "blockers"))

    def test_top_level_samples_mismatch_is_protocol_mismatch(self):
        contexts, results = build_fixture()
        contexts[1]["samples"] = 20
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_requested_perf_scope_is_part_of_protocol_gate(self):
        contexts, results = build_fixture()
        contexts[1]["hardware_snapshot"]["measurement"]["requested_perf_scope"] = "system"
        payload = build_comparison(contexts, results)
        self.assertIn("PROTOCOL_MISMATCH", issue_codes(payload, "blockers"))

    def test_compiler_flags_mismatch_is_incompatible(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["compiler_flags"] = "-O2"
        payload = build_comparison(contexts, results)
        self.assertIn("COMPILER_FLAGS_MISMATCH", issue_codes(payload, "blockers"))

    def test_missing_compiler_flags_is_unverified(self):
        contexts, results = build_fixture()
        contexts[1]["execution_config"]["compiler_flags"] = "   "
        payload = build_comparison(contexts, results)
        self.assertIn("COMPILER_FLAGS_UNVERIFIED", issue_codes(payload, "blockers"))

    def test_identical_input_sets_have_no_partial_overlap_warning(self):
        _, _, payload = self._build(2)
        self.assertNotIn("PARTIAL_INPUT_OVERLAP", issue_codes(payload, "warnings"))
        self.assertEqual(
            payload["compatibility"]["commonInputSizes"],
            [100, 200, 300],
        )

    def test_partial_input_overlap_is_limited_with_exact_intersection(self):
        _, _, payload = self._build(
            2,
            sizes=((100, 200, 300), (200, 300, 400)),
        )
        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        self.assertEqual(payload["compatibility"]["commonInputSizes"], [200, 300])
        self.assertIn("PARTIAL_INPUT_OVERLAP", issue_codes(payload, "warnings"))

    def test_single_common_input_size_is_limited(self):
        _, _, payload = self._build(
            2,
            sizes=((100, 200), (200, 300)),
        )
        self.assertEqual(payload["compatibility"]["commonInputSizes"], [200])
        self.assertIn("SINGLE_COMMON_INPUT_SIZE", issue_codes(payload, "warnings"))

    def test_zero_input_overlap_is_incompatible(self):
        _, _, payload = self._build(
            2,
            sizes=((100, 200), (300, 400)),
        )
        self.assertEqual(payload["compatibility"]["status"], "INCOMPATIBLE")
        self.assertIn("NO_COMMON_INPUT_SIZE", issue_codes(payload, "blockers"))
        self.assertNotIn("DURATION_UNAVAILABLE", issue_codes(payload, "blockers"))

    def test_missing_duration_is_incompatible(self):
        contexts, results = build_fixture()
        del results[1]["metrics"]["DurationTime"]
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "INCOMPATIBLE")
        self.assertIn("DURATION_UNAVAILABLE", issue_codes(payload, "blockers"))
        self.assertEqual(
            issue_codes(payload, "blockers").count("DURATION_UNAVAILABLE"),
            1,
        )

    def test_missing_ipc_is_limited_and_duration_remains(self):
        contexts, results = build_fixture()
        del results[1]["metrics"]["IPC"]
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        self.assertIn("DurationTime", payload["metrics"])
        self.assertNotIn("IPC", payload["metrics"])
        self.assertIn("TARGET_METRIC_UNAVAILABLE", issue_codes(payload, "warnings"))

    def test_missing_energy_pkg_is_limited_and_other_metrics_remain(self):
        contexts, results = build_fixture()
        del results[1]["metrics"]["EnergyPkg"]
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "LIMITED")
        self.assertNotIn("EnergyPkg", payload["metrics"])
        self.assertIn("IPC", payload["metrics"])
        self.assertIn("BranchMissRate", payload["metrics"])

    def test_target_unit_mismatch_excludes_metric_with_warning(self):
        contexts, results = build_fixture()
        results[1]["metrics"]["IPC"]["unit"] = "percent"
        payload = build_comparison(contexts, results)
        self.assertNotIn("IPC", payload["metrics"])
        self.assertIn("METRIC_UNIT_MISMATCH", issue_codes(payload, "warnings"))
        reasons = {
            item["metric"]: item["reasonCode"]
            for item in payload["compatibility"]["excludedMetrics"]
        }
        self.assertEqual(reasons["IPC"], "METRIC_UNIT_MISMATCH")

    def test_missing_additional_metric_does_not_degrade_status(self):
        contexts, results = build_fixture()
        del results[1]["metrics"]["Instructions"]
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "COMPATIBLE")
        self.assertNotIn("Instructions", payload["metrics"])

    def test_metric_specific_partial_coverage_uses_only_common_points(self):
        contexts, results = build_fixture()
        results[1]["metrics"]["IPC"]["points"] = results[1]["metrics"]["IPC"]["points"][:2]
        payload = build_comparison(contexts, results)
        self.assertEqual(
            payload["metrics"]["IPC"]["commonInputSizes"],
            [100, 200],
        )
        self.assertIn("METRIC_PARTIAL_COVERAGE", issue_codes(payload, "warnings"))

    def test_existing_variability_fields_are_copied_without_recalculation(self):
        _, results, payload = self._build(2)
        original = results[0]["metrics"]["DurationTime"]["points"][0]
        public = payload["metrics"]["DurationTime"]["series"][0]["points"][0]
        self.assertEqual(public["stddev"], original["stddev"])
        self.assertEqual(public["q1"], original["q1"])
        self.assertEqual(public["q3"], original["q3"])
        self.assertEqual(public["iqr"], original["iqr"])
        self.assertEqual(public["samplesTotal"], original["samples_total"])
        self.assertEqual(public["samplesValid"], original["samples_valid"])
        self.assertEqual(
            public["iqrOutliersDetected"],
            original["iqr_outliers_detected"],
        )

    def test_multiple_sources_inside_one_execution_are_incompatible(self):
        contexts, results = build_fixture()
        results[0]["metrics"]["DurationTime"]["points"][0]["source"] = "other.cpp"
        payload = build_comparison(contexts, results)
        self.assertIn(
            "AMBIGUOUS_RESULT_PROVENANCE",
            issue_codes(payload, "blockers"),
        )

    def test_historical_path_variants_with_same_basename_are_not_ambiguous(self):
        contexts, results = build_fixture()
        results[0]["metrics"]["DurationTime"]["points"][0]["source"] = "old\\impl1.cpp"
        results[0]["metrics"]["IPC"]["points"][0]["source"] = "new/impl1.cpp"
        payload = build_comparison(contexts, results)
        self.assertNotIn(
            "AMBIGUOUS_RESULT_PROVENANCE",
            issue_codes(payload, "blockers"),
        )

    def test_incompatible_response_never_contains_metric_series(self):
        contexts, results = build_fixture()
        contexts[1]["benchmark"] = "OTHER"
        payload = build_comparison(contexts, results)
        self.assertEqual(payload["compatibility"]["status"], "INCOMPATIBLE")
        self.assertEqual(payload["metrics"], {})

    def test_nonfinite_values_are_converted_to_null(self):
        contexts, results = build_fixture()
        point = results[0]["metrics"]["DurationTime"]["points"][0]
        point["mean"] = float("nan")
        point["stddev"] = float("inf")
        payload = build_comparison(contexts, results)
        public = payload["metrics"]["DurationTime"]["series"][0]["points"][0]
        self.assertIsNone(public["mean"])
        self.assertIsNone(public["stddev"])
        json.dumps(payload, allow_nan=False)

    def test_private_context_and_result_fields_never_reach_payload(self):
        _, _, payload = self._build(2)
        serialized = json.dumps(payload)
        for forbidden in (
            "execution_id",
            "owner_user_id",
            "owner_email",
            "result_path",
            "archive_file_path",
            "hardware_snapshot",
            "execution_config",
            "private-host",
            "/private/",
            "private-note",
            "do-not-compare",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_source_filename_is_a_safe_basename_from_execution_config(self):
        _, _, payload = self._build(2)
        self.assertEqual(payload["executions"][0]["sourceFilename"], "impl1.cpp")
        self.assertEqual(
            payload["metrics"]["DurationTime"]["series"][0]["sourceFilename"],
            "impl1.cpp",
        )

    def test_points_are_sorted_by_numeric_input_size(self):
        contexts, results = build_fixture()
        for metric in results[0]["metrics"].values():
            metric["points"].reverse()
        payload = build_comparison(contexts, results)
        self.assertEqual(
            [
                point["inputSize"]
                for point in payload["metrics"]["DurationTime"]["series"][0]["points"]
            ],
            [100, 200, 300],
        )

    def test_same_inputs_produce_identical_semantic_payload(self):
        contexts, results = build_fixture()
        first = build_comparison(copy.deepcopy(contexts), copy.deepcopy(results))
        second = build_comparison(copy.deepcopy(contexts), copy.deepcopy(results))
        self.assertEqual(first, second)
        self.assertNotIn("generatedAt", json.dumps(first))

    def test_invalid_structured_results_raise_domain_error(self):
        contexts, results = build_fixture()
        results[1]["metrics"] = []
        with self.assertRaises(ComparisonResultsInvalid):
            build_comparison(contexts, results)


if __name__ == "__main__":
    unittest.main()
