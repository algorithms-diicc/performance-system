import os
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.measurement_policy_routes import (
    measurement_policy_bp,
)


STUDENT = {
    "id": 7,
    "email": "student@example.com",
    "full_name": "Student User",
    "role_name": "Student",
}


def policy_row(**overrides):
    row = {
        "id": 1,
        "hardware_profile_id": 3,
        "profile_key": "shenu-intel-i5-9400",
        "hardware_profile_name": "Shenu Intel i5-9400",
        "benchmark": "LCS",
        "execution_profile": "BALANCED",
        "minimum_input": 100,
        "default_input": 500,
        "recommended_max_input": 500,
        "hard_max_input": 750,
        "input_step": 100,
        "operational_timeout_seconds": 1680,
        "is_active": True,
    }
    row.update(overrides)
    return row


class MeasurementPolicyRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(
            TESTING=True,
            SECRET_KEY="test-only",
        )
        app.register_blueprint(measurement_policy_bp)
        self.client = app.test_client()

    def _get(
        self,
        rows,
        path="/api/measurement/policies",
        available=True,
    ):
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=STUDENT,
        ), patch(
            "Server.webapp.routes.measurement_policy_routes."
            "list_hardware_profile_policies",
            return_value=rows,
        ) as list_policies, patch(
            "Server.webapp.routes.measurement_policy_routes."
            "is_new_measurement_target_available",
            return_value=available,
        ), patch.dict(
            os.environ,
            {
                "MEASUREMENT_HARDWARE_PROFILE_KEY":
                    "shenu-intel-i5-9400",
            },
            clear=False,
        ):
            response = self.client.get(path)

        return response, list_policies

    def test_authenticated_user_receives_public_policy_contract(self):
        response, list_policies = self._get(
            [
                policy_row(),
                policy_row(
                    id=2,
                    benchmark="CAMM",
                    execution_profile="QUICK",
                    minimum_input=1000,
                    default_input=5000,
                    recommended_max_input=100000,
                    hard_max_input=130000,
                    input_step=1000,
                    operational_timeout_seconds=360,
                ),
            ]
        )

        self.assertEqual(response.status_code, 200)

        payload = response.get_json()

        self.assertEqual(payload["environment"], {"mode": "AUTO"})
        self.assertEqual(
            payload["availability"],
            {"available": True},
        )
        self.assertEqual(payload["total"], 2)
        self.assertEqual(
            payload["items"][0],
            {
                "benchmark": "LCS",
                "executionProfile": "BALANCED",
                "minimumInput": 100,
                "defaultInput": 500,
                "recommendedMaxInput": 500,
                "hardMaxInput": 750,
                "inputStep": 100,
                "operationalTimeoutSeconds": 1680,
            },
        )

        list_policies.assert_called_once_with(
            "shenu-intel-i5-9400"
        )

    def test_auto_contract_reports_temporary_unavailability(self):
        response, _list_policies = self._get(
            [policy_row()],
            available=False,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(
            payload["availability"],
            {"available": False},
        )
        self.assertEqual(
            payload["environment"],
            {"mode": "AUTO"},
        )

        # Availability remains a minimal public signal; no node transport,
        # heartbeat, or internal identity is surfaced here.
        self.assertNotIn("node", payload["availability"])
        self.assertNotIn("heartbeat", payload["availability"])
        self.assertNotIn("measurementNodeId", payload["availability"])

    def test_client_cannot_override_profile_key(self):
        response, list_policies = self._get(
            [policy_row()],
            path=(
                "/api/measurement/policies"
                "?profile_key=ryzen-user-machine"
            ),
        )

        self.assertEqual(response.status_code, 200)

        list_policies.assert_called_once_with(
            "shenu-intel-i5-9400"
        )

    def test_internal_identifiers_are_not_exposed(self):
        response, _list_policies = self._get(
            [policy_row()]
        )

        item = response.get_json()["items"][0]

        self.assertNotIn("id", item)
        self.assertNotIn("hardwareProfileId", item)
        self.assertNotIn("profileKey", item)
        self.assertNotIn("hardwareProfileName", item)


if __name__ == "__main__":
    unittest.main()
