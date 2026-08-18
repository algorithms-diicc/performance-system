from contextlib import ExitStack
import json
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.comparison_routes import comparisons_bp
from Server.webapp.services.comparison_service import build_comparison
from Server.webapp.services.result_artifact_service import (
    ResultArtifactInvalidReference,
    ResultArtifactNotReady,
)
from Server.webapp.services.results_service import (
    ResultsInvalidError,
    ResultsNotFoundError,
)
from Server.webapp.utils.api_errors import APIError


OWNER = {"id": 3, "role_name": "Student"}
ASSIGNED_TEACHER = {"id": 20, "role_name": "Teacher"}
FOREIGN_TEACHER = {"id": 21, "role_name": "Teacher"}
ADMIN = {"id": 99, "role_name": "Admin"}


def access_row(codename, owner_id=3, teacher_id=20):
    return {
        "execution_id": int(codename[4]),
        "public_id": "access-{}".format(codename),
        "codename": codename,
        "execution_state": "COMPLETED",
        "result_available": True,
        "result_path": "webapp/static/{}/CombinedResults.csv".format(codename),
        "hardware_snapshot": {},
        "submission_id": 100 + int(codename[4]),
        "owner_user_id": owner_id,
        "course_id": 70,
        "course_teacher_user_id": teacher_id,
    }


def export_row(codename, index):
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
            "original_filename": "nested/impl{}.cpp".format(index),
            "compiler_flags": "-O3",
            "measurement": {
                "schema_version": "1.0",
                "points": 3,
                "samples_per_point": 10,
                "warmup_rounds": 1,
                "perf_scope": "process",
                "single_event_fallback": True,
            },
        },
        "hardware_snapshot": {
            "node": {
                "cpu_vendor": "GenuineIntel",
                "cpu_model": "Intel Core Test",
                "architecture": "x86_64",
                "logical_cpus": 8,
            },
            "measurement": {
                "backend": "perf",
                "perf_version": "perf version 6.8",
                "requested_perf_scope": "process",
            },
        },
        "result_available": True,
        "result_path": "webapp/static/{}/CombinedResults.csv".format(codename),
        "submission_id": 100 + index,
        "submission_title": "Entrega {}".format(index),
    }


def point(input_size, factor, source):
    median = input_size * factor
    return {
        "source": source,
        "input_size": input_size,
        "median": median,
        "mean": median + 0.1,
        "stddev": 0.2,
        "q1": median - 0.1,
        "q3": median + 0.1,
        "iqr": 0.2,
        "samples_total": 10,
        "samples_valid": 10,
        "iqr_outliers_detected": 0,
    }


def structured_results(index):
    units = {
        "DurationTime": "ms",
        "IPC": "ratio",
        "CacheMissRate": "ratio",
        "BranchMissRate": "ratio",
        "EnergyPkg": "J",
    }
    source = "impl{}.cpp".format(index)
    return {
        "schema_version": "1.3",
        "execution": {},
        "metrics": {
            name: {
                "status": "available",
                "unit": unit,
                "points": [
                    point(size, (index + offset) / 100.0, source)
                    for size in (100, 200, 300)
                ],
            }
            for offset, (name, unit) in enumerate(units.items(), start=1)
        },
    }


def fixture_maps(count=4):
    codenames = ["exec{}SIZE".format(index) for index in range(1, count + 1)]
    return (
        {codename: access_row(codename) for codename in codenames},
        {
            codename: export_row(codename, index)
            for index, codename in enumerate(codenames, start=1)
        },
        {
            codename: structured_results(index)
            for index, codename in enumerate(codenames, start=1)
        },
    )


class ComparisonRoutesTests(unittest.TestCase):
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
        access_rows=None,
        export_rows=None,
        results=None,
        canonical_side_effect=None,
        results_side_effect=None,
    ):
        default_access, default_export, default_results = fixture_maps()
        selected_access = access_rows or default_access
        selected_export = export_rows or default_export
        selected_results = results or default_results

        def get_access(codename):
            return selected_access.get(codename)

        def get_export(codename):
            return selected_export.get(codename)

        def get_results(*, codename, **_kwargs):
            if results_side_effect is not None:
                if isinstance(results_side_effect, Exception):
                    raise results_side_effect
                return results_side_effect(codename)
            return selected_results[codename]

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
                    side_effect=canonical_side_effect,
                )
            )
            results_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "build_execution_results",
                    side_effect=get_results,
                )
            )
            comparison_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.build_comparison",
                    wraps=build_comparison,
                )
            )
            response = self.client.post("/api/comparisons", json=body)
            calls = {
                "access": access_mock,
                "export": export_mock,
                "canonical": canonical_mock,
                "results": results_mock,
                "comparison": comparison_mock,
            }
            return response, calls

    def test_one_execution_is_rejected(self):
        response, _ = self._post({"executions": ["exec1SIZE"]})
        self.assertEqual(response.status_code, 400)

    def test_five_executions_are_rejected(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE", "exec3SIZE", "exec4SIZE", "exec5SIZE"]}
        )
        self.assertEqual(response.status_code, 400)

    def test_executions_must_be_an_array(self):
        response, _ = self._post({"executions": "exec1SIZE,exec2SIZE"})
        self.assertEqual(response.status_code, 400)

    def test_duplicate_codename_is_rejected_after_trim(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", " exec1SIZE "]}
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_codename_is_rejected(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "../exec2SIZE"]}
        )
        self.assertEqual(response.status_code, 400)

    def test_non_string_codename_is_rejected(self):
        response, _ = self._post({"executions": ["exec1SIZE", 2]})
        self.assertEqual(response.status_code, 400)

    def test_numeric_execution_id_string_is_rejected(self):
        response, _ = self._post({"executions": ["exec1SIZE", "42"]})
        self.assertEqual(response.status_code, 400)

    def test_public_uuid_substitute_is_rejected(self):
        response, _ = self._post(
            {
                "executions": [
                    "exec1SIZE",
                    "123e4567-e89b-12d3-a456-426614174000",
                ]
            }
        )
        self.assertEqual(response.status_code, 400)

    def test_unknown_request_key_is_rejected(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"], "mode": "unsafe"}
        )
        self.assertEqual(response.status_code, 400)

    def test_body_must_be_an_object(self):
        response, _ = self._post(["exec1SIZE", "exec2SIZE"])
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_request_is_rejected(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=None,
        )
        self.assertEqual(response.status_code, 401)

    def test_owner_can_compare_two_own_executions(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=OWNER,
        )
        self.assertEqual(response.status_code, 200)

    def test_assigned_teacher_can_compare_accessible_executions(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=ASSIGNED_TEACHER,
        )
        self.assertEqual(response.status_code, 200)

    def test_admin_can_compare_accessible_executions(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=ADMIN,
        )
        self.assertEqual(response.status_code, 200)

    def test_foreign_teacher_is_forbidden(self):
        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=FOREIGN_TEACHER,
        )
        self.assertEqual(response.status_code, 403)
        calls["export"].assert_not_called()

    def test_mixed_permission_is_all_or_nothing(self):
        access_rows, _, _ = fixture_maps()
        access_rows["exec2SIZE"] = access_row(
            "exec2SIZE",
            owner_id=30,
            teacher_id=22,
        )
        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            user=ASSIGNED_TEACHER,
            access_rows=access_rows,
        )
        self.assertEqual(response.status_code, 403)
        calls["export"].assert_not_called()
        calls["comparison"].assert_not_called()

    def test_nonexistent_execution_returns_generic_not_found(self):
        access_rows, _, _ = fixture_maps()
        access_rows["exec2SIZE"] = None
        response, calls = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            access_rows=access_rows,
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "NOT_FOUND")
        calls["export"].assert_not_called()

    def test_running_execution_returns_results_not_ready(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            canonical_side_effect=[
                None,
                ResultArtifactNotReady("not ready"),
            ],
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "COMPARISON_RESULTS_NOT_READY",
        )

    def test_failed_execution_without_result_returns_results_not_ready(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            canonical_side_effect=ResultArtifactNotReady("failed"),
        )
        self.assertEqual(response.status_code, 409)

    def test_canonical_result_mismatch_returns_422(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            canonical_side_effect=ResultArtifactInvalidReference("invalid"),
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "COMPARISON_RESULTS_INVALID",
        )

    def test_missing_canonical_results_file_returns_404(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            results_side_effect=ResultsNotFoundError("missing"),
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "COMPARISON_RESULTS_NOT_FOUND",
        )

    def test_invalid_structured_results_return_422(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            results_side_effect=ResultsInvalidError("invalid"),
        )
        self.assertEqual(response.status_code, 422)

    def test_exactly_two_executions_are_accepted(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["executions"]), 2)

    def test_exactly_three_executions_are_accepted(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE", "exec3SIZE"]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["executions"]), 3)

    def test_exactly_four_executions_are_accepted(self):
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE", "exec3SIZE", "exec4SIZE"]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["executions"]), 4)

    def test_requested_order_reaches_service_after_trim(self):
        response, calls = self._post(
            {"executions": [" exec3SIZE ", "exec1SIZE", "exec2SIZE"]}
        )
        self.assertEqual(response.status_code, 200)
        contexts = calls["comparison"].call_args.args[0]
        self.assertEqual(
            [row["codename"] for row in contexts],
            ["exec3SIZE", "exec1SIZE", "exec2SIZE"],
        )

    def test_incompatible_domain_result_remains_http_200(self):
        _, export_rows, _ = fixture_maps()
        export_rows["exec2SIZE"]["benchmark"] = "LCS"
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            export_rows=export_rows,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["compatibility"]["status"],
            "INCOMPATIBLE",
        )
        self.assertEqual(response.get_json()["metrics"], {})

    def test_response_does_not_leak_owner_paths_snapshots_or_configs(self):
        _, export_rows, _ = fixture_maps()
        for row in export_rows.values():
            row.update(
                {
                    "owner_user_id": 999,
                    "owner_email": "secret@example.test",
                    "result_path": "/private/result.csv",
                    "archive_file_path": "/private/archive.zip",
                    "note": "private-note",
                }
            )
            row["hardware_snapshot"]["env"] = {"HOME": "/private/home"}
            row["execution_config"]["secret"] = "private-config"
        response, _ = self._post(
            {"executions": ["exec1SIZE", "exec2SIZE"]},
            export_rows=export_rows,
        )
        self.assertEqual(response.status_code, 200)
        serialized = json.dumps(response.get_json())
        for forbidden in (
            "owner_user_id",
            "secret@example.test",
            "result_path",
            "archive_file_path",
            "hardware_snapshot",
            "execution_config",
            "/private/",
            "private-note",
            "private-config",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_get_does_not_execute_a_comparison(self):
        response = self.client.get("/api/comparisons")
        self.assertEqual(response.status_code, 405)


if __name__ == "__main__":
    unittest.main()
