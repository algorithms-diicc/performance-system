from contextlib import ExitStack
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.comparison_routes import comparisons_bp
from Server.webapp.utils.api_errors import APIError


OWNER = {"id": 3, "role_name": "Student"}
TEACHER = {"id": 20, "role_name": "Teacher"}


def access_row(codename, owner_id=3, teacher_id=20):
    return {
        "codename": codename,
        "owner_user_id": owner_id,
        "course_teacher_user_id": teacher_id,
        "submission_id": 7,
    }


def candidate(codename, status):
    return {
        "codename": codename,
        "publicId": "public-{}".format(codename),
        "submissionId": 8,
        "submissionTitle": "Reference",
        "sourceFilename": "{}.cpp".format(codename),
        "createdAt": "2026-08-20T12:00:00+00:00",
        "benchmark": "SIZE",
        "profile": "BALANCED",
        "status": status,
        "selectable": status in {"COMPATIBLE", "LIMITED"},
        "compatibility": {"status": status},
        "reason": "configuration differs" if status == "INCOMPATIBLE" else None,
    }


class ComparisonShortcutRoutesTests(unittest.TestCase):
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
        path,
        *,
        user=OWNER,
        current_owner=3,
        rows=None,
        statuses=None,
        invisible=None,
        body=None,
    ):
        rows = list(rows or [])
        statuses = statuses or {}
        invisible = set(invisible or [])

        def get_access(codename):
            if codename in invisible:
                return None
            return access_row(codename, owner_id=current_owner)

        def build_item(_codename, context, *_args):
            codename = context["codename"]
            return candidate(
                codename,
                statuses.get(codename, "COMPATIBLE"),
            )

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators.get_current_user",
                    return_value=user,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.repositories.execution_access_repository."
                    "get_execution_access_row_by_codename",
                    side_effect=get_access,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "_load_selected_comparison_inputs",
                    return_value=([{"codename": "currentA"}], [{}]),
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.export_repository."
                    "get_execution_export_row_by_codename",
                    side_effect=lambda codename: {"codename": codename},
                )
            )
            item_mock = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes._candidate_item",
                    side_effect=build_item,
                )
            )
            reference_repo = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "comparison_repository.list_reference_candidate_executions",
                    return_value={"items": rows, "truncated": False},
                )
            )
            previous_repo = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "comparison_repository.list_previous_candidate_executions",
                    return_value={"items": rows, "truncated": False},
                )
            )
            response = self.client.post(
                path,
                json=body or {"execution": "currentA"},
            )

        return response, reference_repo, previous_repo, item_mock

    def test_reference_candidates_are_owner_scoped_and_keep_incompatible_reason(self):
        response, repository, _, _ = self._post(
            "/api/comparisons/reference-candidates",
            rows=[{"codename": "refCompatible"}, {"codename": "refBlocked"}],
            statuses={"refBlocked": "INCOMPATIBLE"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(
            [item["status"] for item in payload["items"]],
            ["COMPATIBLE", "INCOMPATIBLE"],
        )
        self.assertFalse(payload["items"][1]["selectable"])
        self.assertEqual(payload["items"][1]["reason"], "configuration differs")
        repository.assert_called_once_with(
            owner_user_id=OWNER["id"],
            excluded_codename="currentA",
        )

    def test_reference_candidates_return_useful_empty_state_contract(self):
        response, _, _, _ = self._post(
            "/api/comparisons/reference-candidates",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["items"], [])

    def test_teacher_cannot_read_student_personal_references(self):
        response, repository, _, item_mock = self._post(
            "/api/comparisons/reference-candidates",
            user=TEACHER,
            current_owner=OWNER["id"],
            rows=[{"codename": "privateReference"}],
        )
        self.assertEqual(response.status_code, 403)
        repository.assert_not_called()
        item_mock.assert_not_called()

    def test_previous_skips_incompatible_and_returns_first_selectable(self):
        response, _, repository, item_mock = self._post(
            "/api/comparisons/previous-compatible",
            user=TEACHER,
            rows=[{"codename": "nearestBlocked"}, {"codename": "nearestLimited"}],
            statuses={
                "nearestBlocked": "INCOMPATIBLE",
                "nearestLimited": "LIMITED",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["candidate"]["codename"],
            "nearestLimited",
        )
        repository.assert_called_once_with(
            current_codename="currentA",
            owner_user_id=OWNER["id"],
        )
        self.assertEqual(item_mock.call_count, 2)

    def test_previous_skips_candidates_not_visible_to_actor(self):
        response, _, _, item_mock = self._post(
            "/api/comparisons/previous-compatible",
            rows=[{"codename": "hiddenA"}],
            invisible={"hiddenA"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["candidate"])
        item_mock.assert_not_called()

    def test_previous_returns_null_when_no_selectable_candidate_exists(self):
        response, _, _, _ = self._post(
            "/api/comparisons/previous-compatible",
            rows=[{"codename": "blockedA"}],
            statuses={"blockedA": "INCOMPATIBLE"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["candidate"])

    def test_previous_scans_bounded_pages_until_first_selectable(self):
        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    "Server.webapp.utils.auth_decorators.get_current_user",
                    return_value=OWNER,
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.repositories.execution_access_repository."
                    "get_execution_access_row_by_codename",
                    side_effect=lambda codename: access_row(codename),
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "_load_selected_comparison_inputs",
                    return_value=([{"codename": "currentA"}], [{}]),
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes.export_repository."
                    "get_execution_export_row_by_codename",
                    side_effect=lambda codename: {"codename": codename},
                )
            )
            stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes._candidate_item",
                    side_effect=lambda _codename, context, *_args: candidate(
                        context["codename"],
                        "LIMITED"
                        if context["codename"] == "olderLimited"
                        else "INCOMPATIBLE",
                    ),
                )
            )
            repository = stack.enter_context(
                patch(
                    "Server.webapp.routes.comparison_routes."
                    "comparison_repository.list_previous_candidate_executions",
                    side_effect=[
                        {
                            "items": [{"codename": "nearestBlocked"}],
                            "truncated": True,
                        },
                        {
                            "items": [{"codename": "olderLimited"}],
                            "truncated": False,
                        },
                    ],
                )
            )

            response = self.client.post(
                "/api/comparisons/previous-compatible",
                json={"execution": "currentA"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["candidate"]["codename"],
            "olderLimited",
        )
        self.assertEqual(
            repository.call_args_list[0].kwargs,
            {
                "current_codename": "currentA",
                "owner_user_id": OWNER["id"],
            },
        )
        self.assertEqual(
            repository.call_args_list[1].kwargs,
            {
                "current_codename": "currentA",
                "owner_user_id": OWNER["id"],
                "offset": 1,
            },
        )

    def test_shortcut_payload_is_strict(self):
        response, _, _, _ = self._post(
            "/api/comparisons/previous-compatible",
            body={"execution": "currentA", "owner": 3},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
