from contextlib import ExitStack
from datetime import datetime, timezone
import json
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.comparison_routes import comparisons_bp
from Server.webapp.services.result_artifact_service import (
    ResultArtifactNotReady,
)
from Server.webapp.utils.api_errors import APIError


OWNER = {"id": 3, "role_name": "Student"}
TEACHER = {"id": 20, "role_name": "Teacher"}
ADMIN = {"id": 99, "role_name": "Admin"}
TARGET_UNITS = {
    "DurationTime": "ms",
    "IPC": "ratio",
    "CacheMissRate": "ratio",
    "BranchMissRate": "ratio",
    "EnergyPkg": "J",
}


def access_row(codename, *, owner_id=3, teacher_id=20):
    return {
        "execution_id": len(codename),
        "public_id": "access-{}".format(codename),
        "codename": codename,
        "execution_state": "COMPLETED",
        "result_available": True,
        "result_path": "webapp/static/{}/CombinedResults.csv".format(codename),
        "hardware_snapshot": {},
        "submission_id": 100,
        "owner_user_id": owner_id,
        "course_id": 70,
        "course_teacher_user_id": teacher_id,
    }


def export_row(
    codename,
    index,
    *,
    benchmark="SIZE",
    cpu_model="Intel Core Test",
    perf_version="perf version 6.8",
):
    return {
        "execution_id": 900 + index,
        "public_id": "public-{}".format(codename),
        "codename": codename,
        "execution_state": "COMPLETED",
        "benchmark": benchmark,
        "input_size": 300,
        "samples": 10,
        "execution_profile": "BALANCED",
        "execution_config": {
            "original_filename": "private/nested/impl{}.cpp".format(index),
            "compiler_flags": "-O3",
            "measurement": {
                "schema_version": "1.0",
                "points": 3,
                "samples_per_point": 10,
                "warmup_rounds": 1,
                "perf_scope": "process",
                "single_event_fallback": True,
            },
            "secret": "do-not-return",
        },
        "hardware_snapshot": {
            "node": {
                "cpu_vendor": "GenuineIntel",
                "cpu_model": cpu_model,
                "architecture": "x86_64",
                "logical_cpus": 8,
                "hostname": "private-host",
            },
            "measurement": {
                "backend": "perf",
                "perf_version": perf_version,
                "requested_perf_scope": "process",
            },
            "env": {"TOKEN": "private"},
        },
        "created_at": datetime(2026, 8, 18, 12, index, tzinfo=timezone.utc),
        "result_available": True,
        "result_path": "webapp/static/{}/CombinedResults.csv".format(codename),
        "submission_id": 100 + index,
        "submission_title": "Entrega {}".format(index),
        "archive_file_path": "/private/archive.zip",
        "owner_id": 3,
        "email": "private@example.test",
        "note": "private note",
        "isPinned": True,
    }


def structured_results(index, sizes=(100, 200, 300)):
    metrics = {}
    for metric_offset, (metric, unit) in enumerate(
        TARGET_UNITS.items(),
        start=1,
    ):
        metrics[metric] = {
            "unit": unit,
            "points": [
                {
                    "source": "impl{}.cpp".format(index),
                    "input_size": size,
                    "median": size * (index + metric_offset) / 100,
                    "mean": size * (index + metric_offset) / 100 + 0.1,
                    "stddev": 0.2,
                    "q1": size * (index + metric_offset) / 100 - 0.1,
                    "q3": size * (index + metric_offset) / 100 + 0.1,
                    "iqr": 0.2,
                    "samples_total": 10,
                    "samples_valid": 10,
                    "iqr_outliers_detected": 0,
                }
                for size in sizes
            ],
        }
    return {"metrics": metrics, "private": "/internal/results"}


def fixture_maps():
    names = [
        "execAlpha",
        "execBeta",
        "execGamma",
        "execDelta",
        "candCompatible",
        "candLimited",
        "candBenchmark",
        "candHardware",
        "candNoOverlap",
        "candBroken",
        "candForeign",
    ]
    access = {name: access_row(name) for name in names}
    exports = {
        name: export_row(name, index)
        for index, name in enumerate(names, start=1)
    }
    exports["candLimited"] = export_row(
        "candLimited",
        6,
        perf_version="perf version 6.9",
    )
    exports["candBenchmark"] = export_row(
        "candBenchmark",
        7,
        benchmark="LCS",
    )
    exports["candHardware"] = export_row(
        "candHardware",
        8,
        cpu_model="Other CPU",
    )
    results = {
        name: structured_results(index)
        for index, name in enumerate(names, start=1)
    }
    return access, exports, results


class ComparisonCandidatesRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(comparisons_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _post(
        self,
        body,
        *,
        user=OWNER,
        candidate_codenames=None,
        truncated=False,
        access_rows=None,
        export_rows=None,
        results=None,
        canonical_errors=None,
        events=None,
    ):
        default_access, default_exports, default_results = fixture_maps()
        access_rows = default_access if access_rows is None else access_rows
        export_rows = default_exports if export_rows is None else export_rows
        results = default_results if results is None else results
        canonical_errors = canonical_errors or {}
        events = events if events is not None else []
        candidates = candidate_codenames or ["candCompatible"]

        def get_access(codename):
            events.append("access:{}".format(codename))
            return access_rows.get(codename)

        def get_export(codename):
            events.append("export:{}".format(codename))
            return export_rows.get(codename)

        def get_results(*, codename, **_kwargs):
            events.append("results:{}".format(codename))
            value = results[codename]
            if isinstance(value, Exception):
                raise value
            return value

        def validate_reference(codename, *_args, **_kwargs):
            events.append("canonical:{}".format(codename))
            error = canonical_errors.get(codename)
            if error is not None:
                raise error
            return "/canonical/{}.csv".format(codename)

        def list_candidates(**kwargs):
            events.append("candidate-search")
            return {
                "items": [{"codename": value} for value in candidates],
                "truncated": truncated,
            }

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators.get_current_user",
                    return_value=user,
                )
            )
            access_mock = stack.enter_context(
                patch(
                    "Server.webapp.repositories.execution_access_repository."
                    "get_execution_access_row_by_codename",
                    side_effect=get_access,
                )
            )
            export_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.export_repository."
                    "get_execution_export_row_by_codename",
                    side_effect=get_export,
                )
            )
            canonical_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "assert_canonical_result_reference",
                    side_effect=validate_reference,
                )
            )
            results_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "build_execution_results",
                    side_effect=get_results,
                )
            )
            candidate_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "comparison_repository.list_recent_candidate_executions",
                    side_effect=list_candidates,
                )
            )
            response = self.client.post(
                "/api/comparisons/candidates",
                json=body,
            )

        return response, {
            "access": access_mock,
            "export": export_mock,
            "canonical": canonical_mock,
            "results": results_mock,
            "candidates": candidate_mock,
            "events": events,
        }

    def test_two_and_three_selected_are_valid_and_preserve_order(self):
        for executions in (
            ["execBeta", "execAlpha"],
            ["execGamma", "execAlpha", "execBeta"],
        ):
            with self.subTest(executions=executions):
                response, calls = self._post({"executions": executions})
                self.assertEqual(response.status_code, 200)
                payload = response.get_json()
                self.assertEqual(payload["selection"]["executions"], executions)
                self.assertEqual(payload["selection"]["count"], len(executions))
                kwargs = calls["candidates"].call_args.kwargs
                self.assertEqual(kwargs["excluded_codenames"], executions)

    def test_one_and_four_selected_are_rejected_without_search(self):
        for executions in (
            ["execAlpha"],
            ["execAlpha", "execBeta", "execGamma", "execDelta"],
        ):
            with self.subTest(executions=executions):
                response, calls = self._post({"executions": executions})
                self.assertEqual(response.status_code, 400)
                calls["candidates"].assert_not_called()

    def test_invalid_body_duplicate_and_extra_key_are_rejected(self):
        bodies = (
            ["execAlpha", "execBeta"],
            {"executions": ["execAlpha", " execAlpha "]},
            {"executions": ["execAlpha", "../execBeta"]},
            {"executions": ["execAlpha", "execBeta"], "limit": 10},
        )
        for body in bodies:
            with self.subTest(body=body):
                response, calls = self._post(body)
                self.assertEqual(response.status_code, 400)
                calls["candidates"].assert_not_called()

    def test_selected_authorization_supports_owner_teacher_and_admin(self):
        for user in (OWNER, TEACHER, ADMIN):
            with self.subTest(role=user["role_name"]):
                response, calls = self._post(
                    {"executions": ["execAlpha", "execBeta"]},
                    user=user,
                )
                self.assertEqual(response.status_code, 200)
                kwargs = calls["candidates"].call_args.kwargs
                self.assertEqual(kwargs["current_user_id"], user["id"])
                self.assertEqual(
                    kwargs["current_role_name"], user["role_name"]
                )

    def test_mixed_selected_permission_is_403_before_candidate_search(self):
        access, exports, results = fixture_maps()
        access["execBeta"] = access_row(
            "execBeta",
            owner_id=77,
            teacher_id=88,
        )
        events = []
        response, calls = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            access_rows=access,
            export_rows=exports,
            results=results,
            events=events,
        )
        self.assertEqual(response.status_code, 403)
        calls["candidates"].assert_not_called()
        self.assertNotIn("candidate-search", events)
        self.assertFalse(any(item.startswith("export:") for item in events))

    def test_nonexistent_selected_is_404_before_candidate_search(self):
        access, exports, results = fixture_maps()
        access.pop("execBeta")
        response, calls = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            access_rows=access,
            export_rows=exports,
            results=results,
        )
        self.assertEqual(response.status_code, 404)
        calls["candidates"].assert_not_called()

    def test_candidate_search_starts_after_all_selected_are_authorized(self):
        events = []
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            events=events,
        )
        self.assertEqual(response.status_code, 200)
        search_index = events.index("candidate-search")
        self.assertLess(events.index("access:execAlpha"), search_index)
        self.assertLess(events.index("access:execBeta"), search_index)

    def test_foreign_candidate_is_never_returned(self):
        access, exports, results = fixture_maps()
        access["candForeign"] = access_row(
            "candForeign",
            owner_id=77,
            teacher_id=88,
        )
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candForeign", "candCompatible"],
            access_rows=access,
            export_rows=exports,
            results=results,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["codename"] for item in response.get_json()["items"]],
            ["candCompatible"],
        )

    def test_selected_codenames_are_defensively_excluded(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["execAlpha", "candCompatible"],
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["codename"] for item in response.get_json()["items"]],
            ["candCompatible"],
        )

    def test_compatible_candidate_is_selectable(self):
        response, calls = self._post(
            {"executions": ["execAlpha", "execBeta"]}
        )
        self.assertEqual(response.status_code, 200)
        item = response.get_json()["items"][0]
        self.assertEqual(item["status"], "COMPATIBLE")
        self.assertTrue(item["selectable"])
        self.assertIsNone(item["reason"])
        self.assertNotIn("metrics", item)
        self.assertEqual(calls["results"].call_count, 3)

    def test_limited_candidate_is_selectable_with_public_reason(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candLimited"],
        )
        item = response.get_json()["items"][0]
        self.assertEqual(item["status"], "LIMITED")
        self.assertTrue(item["selectable"])
        self.assertIn("version", item["reason"].casefold())

    def test_benchmark_and_hardware_mismatches_are_incompatible(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candBenchmark", "candHardware"],
        )
        self.assertEqual(response.status_code, 200)
        items = response.get_json()["items"]
        self.assertEqual(
            [item["status"] for item in items],
            ["INCOMPATIBLE", "INCOMPATIBLE"],
        )
        self.assertTrue(all(not item["selectable"] for item in items))

    def test_no_common_full_set_intersection_is_incompatible(self):
        access, exports, results = fixture_maps()
        results["execAlpha"] = structured_results(1, sizes=(100, 200))
        results["execBeta"] = structured_results(2, sizes=(100,))
        results["candNoOverlap"] = structured_results(9, sizes=(200,))
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candNoOverlap"],
            access_rows=access,
            export_rows=exports,
            results=results,
        )
        item = response.get_json()["items"][0]
        self.assertEqual(item["status"], "INCOMPATIBLE")
        self.assertIn("InputSize", item["reason"])

    def test_candidate_result_unavailable_becomes_sanitized_item(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candBroken"],
            canonical_errors={
                "candBroken": ResultArtifactNotReady("private path")
            },
        )
        self.assertEqual(response.status_code, 200)
        item = response.get_json()["items"][0]
        self.assertEqual(item["status"], "UNAVAILABLE")
        self.assertFalse(item["selectable"])
        self.assertEqual(
            item["reason"],
            "Los resultados de esta ejecución no están disponibles para comparación.",
        )
        self.assertNotIn("private path", json.dumps(item))

    def test_malformed_candidate_result_does_not_break_list(self):
        access, exports, results = fixture_maps()
        results["candBroken"] = {"metrics": "malformed", "path": "/private"}
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            candidate_codenames=["candBroken", "candCompatible"],
            access_rows=access,
            export_rows=exports,
            results=results,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["status"] for item in response.get_json()["items"]],
            ["UNAVAILABLE", "COMPATIBLE"],
        )

    def test_sensitive_fields_are_not_serialized(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]}
        )
        serialized = json.dumps(response.get_json())
        for forbidden in (
            "execution_id",
            "owner_id",
            "email",
            "note",
            "isPinned",
            "result_path",
            "archive_file_path",
            "hardware_snapshot",
            "execution_config",
            "hostname",
            "private-host",
            "TOKEN",
        ):
            self.assertNotIn(forbidden, serialized)
        item = response.get_json()["items"][0]
        self.assertEqual(item["sourceFilename"], "impl5.cpp")

    def test_truncated_and_max_contract_are_deterministic(self):
        response, _ = self._post(
            {"executions": ["execAlpha", "execBeta"]},
            truncated=True,
        )
        payload = response.get_json()
        self.assertTrue(payload["truncated"])
        self.assertEqual(payload["selection"]["max"], 4)
        self.assertEqual(payload["schemaVersion"], "1.0")


if __name__ == "__main__":
    unittest.main()
