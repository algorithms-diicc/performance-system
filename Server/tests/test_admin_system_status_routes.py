import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.admin_system_status_routes import (
    admin_system_status_bp,
)
from Server.webapp.utils.api_errors import APIError


ADMIN = {"id": 1, "role_name": "Admin"}
STUDENT = {"id": 2, "role_name": "Student"}
TEACHER = {"id": 3, "role_name": "Teacher"}


def safe_payload():
    return {
        "checkedAt": "2026-08-22T13:30:00-04:00",
        "backend": {"status": "AVAILABLE"},
        "database": {"status": "UNKNOWN"},
        "queue": {"queued": None},
        "runtime": {"executionMode": "local"},
        "processSignals": {
            "dispatcher": {"signal": "UNKNOWN"},
            "watchdog": {"signal": "UNKNOWN"},
        },
        "measurementNodes": {
            "status": "AVAILABLE",
            "items": [
                {
                    "key": "shenu",
                    "name": "Shenu",
                    "state": "AVAILABLE",
                    "hardwareProfile": {
                        "key": "shenu-intel-i5-9400",
                        "name": "Shenu Intel i5-9400",
                    },
                    "enabled": True,
                    "validationOnly": False,
                    "draining": False,
                    "lastHeartbeatAt":
                        "2026-08-22T13:29:50",
                    "heartbeatAgeSeconds": 10.0,
                }
            ],
        },
        "measurementEnvironment": {"historical": True},
    }


class AdminSystemStatusRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(admin_system_status_bp)

        @app.errorhandler(APIError)
        def handle_api_error(error):
            return error.to_response()

        self.client = app.test_client()

    def _get_as(self, user):
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=user,
        ), patch(
            "Server.webapp.routes.admin_system_status_routes."
            "system_status_service.build_system_status",
            return_value=safe_payload(),
        ) as build_status:
            response = self.client.get("/api/admin/system-status")
        return response, build_status

    def test_admin_receives_exact_read_only_payload_with_200(self):
        response, build_status = self._get_as(ADMIN)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), safe_payload())
        build_status.assert_called_once_with()

    def test_missing_session_receives_401_without_running_diagnostic(self):
        response, build_status = self._get_as(None)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"]["code"], "UNAUTHENTICATED")
        build_status.assert_not_called()

    def test_student_receives_403_without_running_diagnostic(self):
        response, build_status = self._get_as(STUDENT)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"]["code"], "FORBIDDEN")
        build_status.assert_not_called()

    def test_teacher_receives_403_without_running_diagnostic(self):
        response, build_status = self._get_as(TEACHER)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"]["code"], "FORBIDDEN")
        build_status.assert_not_called()


if __name__ == "__main__":
    unittest.main()
