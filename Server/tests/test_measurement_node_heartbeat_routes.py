from datetime import datetime
import os
import unittest
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.measurement_node_heartbeat_routes import (
    configured_heartbeat_secret,
    derive_measurement_node_heartbeat_token,
    measurement_node_heartbeat_bp,
)


SECRET = "s" * 64


class MeasurementNodeHeartbeatRoutesTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(
            measurement_node_heartbeat_bp
        )
        app.testing = True
        self.client = app.test_client()

    def token(self, node_key="shenu"):
        return derive_measurement_node_heartbeat_token(
            SECRET,
            node_key,
        )

    def post(
        self,
        node_key="shenu",
        token=None,
    ):
        headers = {}

        if token is not None:
            headers["Authorization"] = (
                "Bearer {}".format(token)
            )

        return self.client.post(
            "/api/internal/measurement-nodes/heartbeat",
            json={"nodeKey": node_key},
            headers=headers,
        )

    def test_secret_configuration_fails_closed(self):
        self.assertIsNone(
            configured_heartbeat_secret(
                {
                    "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                        "CHANGE_ME"
                }
            )
        )
        self.assertIsNone(
            configured_heartbeat_secret(
                {
                    "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                        "short"
                }
            )
        )

    def test_route_is_unavailable_without_server_secret(self):
        with patch.dict(
            os.environ,
            {
                "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                    ""
            },
        ):
            response = self.post(
                token=self.token()
            )

        self.assertEqual(
            response.status_code,
            503,
        )

    @patch(
        "Server.webapp.routes."
        "measurement_node_heartbeat_routes."
        "record_measurement_node_heartbeat"
    )
    def test_invalid_token_is_rejected_before_write(
        self,
        heartbeat_mock,
    ):
        with patch.dict(
            os.environ,
            {
                "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                    SECRET
            },
        ):
            response = self.post(
                token="invalid"
            )

        self.assertEqual(
            response.status_code,
            401,
        )
        heartbeat_mock.assert_not_called()

    @patch(
        "Server.webapp.routes."
        "measurement_node_heartbeat_routes."
        "record_measurement_node_heartbeat"
    )
    def test_token_is_bound_to_node_key(
        self,
        heartbeat_mock,
    ):
        with patch.dict(
            os.environ,
            {
                "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                    SECRET
            },
        ):
            response = self.post(
                node_key="ryzen-validation",
                token=self.token("shenu"),
            )

        self.assertEqual(
            response.status_code,
            401,
        )
        heartbeat_mock.assert_not_called()

    @patch(
        "Server.webapp.routes."
        "measurement_node_heartbeat_routes."
        "record_measurement_node_heartbeat"
    )
    def test_valid_token_records_heartbeat(
        self,
        heartbeat_mock,
    ):
        heartbeat_mock.return_value = {
            "id": 1,
            "node_key": "shenu",
            "last_heartbeat_at":
                datetime(2026, 8, 28, 5, 0, 0),
        }

        with patch.dict(
            os.environ,
            {
                "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                    SECRET
            },
        ):
            response = self.post(
                token=self.token()
            )

        self.assertEqual(
            response.status_code,
            200,
        )
        self.assertEqual(
            response.get_json()["nodeKey"],
            "shenu",
        )
        heartbeat_mock.assert_called_once_with(
            "shenu"
        )

    @patch(
        "Server.webapp.routes."
        "measurement_node_heartbeat_routes."
        "record_measurement_node_heartbeat"
    )
    def test_registered_identity_is_required(
        self,
        heartbeat_mock,
    ):
        from Server.webapp.services.measurement_node_service import (
            MeasurementNodeMissing,
        )

        heartbeat_mock.side_effect = (
            MeasurementNodeMissing("missing")
        )

        with patch.dict(
            os.environ,
            {
                "MEASUREMENT_NODE_HEARTBEAT_SECRET":
                    SECRET
            },
        ):
            response = self.post(
                token=self.token()
            )

        self.assertEqual(
            response.status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main()
