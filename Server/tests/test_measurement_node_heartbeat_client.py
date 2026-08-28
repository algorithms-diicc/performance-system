import json
import threading
import unittest

from Server import slave


TOKEN = "a" * 64


def valid_environment():
    return {
        "MEASUREMENT_NODE_KEY": "shenu",
        "MEASUREMENT_NODE_HEARTBEAT_URL":
            "https://performance.example/"
            "api/internal/measurement-nodes/heartbeat",
        "MEASUREMENT_NODE_HEARTBEAT_TOKEN":
            TOKEN,
        "MEASUREMENT_NODE_HEARTBEAT_SECONDS":
            "10",
        "MEASUREMENT_NODE_HEARTBEAT_TIMEOUT_SECONDS":
            "5",
    }


class FakeResponse:
    def __init__(
        self,
        node_key="shenu",
        status=200,
    ):
        self.status = status
        self.node_key = node_key

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        traceback,
    ):
        return False

    def getcode(self):
        return self.status

    def read(self):
        return json.dumps(
            {
                "nodeKey": self.node_key,
                "heartbeatAt":
                    "2026-08-28T05:00:00",
            }
        ).encode("utf-8")


class HeartbeatClientTests(unittest.TestCase):
    def tearDown(self):
        slave.stop_measurement_node_heartbeat()

    def test_no_configuration_keeps_legacy_mode_disabled(
        self,
    ):
        self.assertIsNone(
            slave.measurement_node_heartbeat_configuration(
                {}
            )
        )

    def test_partial_configuration_fails_closed(self):
        with self.assertRaises(ValueError):
            slave.measurement_node_heartbeat_configuration(
                {
                    "MEASUREMENT_NODE_KEY":
                        "shenu"
                }
            )

    def test_invalid_token_is_rejected(self):
        environment = valid_environment()
        environment[
            "MEASUREMENT_NODE_HEARTBEAT_TOKEN"
        ] = "not-a-derived-token"

        with self.assertRaises(ValueError):
            slave.measurement_node_heartbeat_configuration(
                environment
            )

    def test_valid_configuration_is_normalized(self):
        environment = valid_environment()
        environment["MEASUREMENT_NODE_KEY"] = (
            " ShEnU "
        )

        config = (
            slave.measurement_node_heartbeat_configuration(
                environment
            )
        )

        self.assertEqual(
            config["node_key"],
            "shenu",
        )
        self.assertEqual(
            config["interval_seconds"],
            10,
        )
        self.assertEqual(
            config["timeout_seconds"],
            5,
        )

    def test_send_uses_post_bound_identity_and_token(self):
        config = (
            slave.measurement_node_heartbeat_configuration(
                valid_environment()
            )
        )

        captured = {}

        def opener(request, timeout):
            captured["url"] = request.full_url
            captured["method"] = request.get_method()
            captured["authorization"] = (
                request.get_header(
                    "Authorization"
                )
            )
            captured["content_type"] = (
                request.get_header(
                    "Content-type"
                )
            )
            captured["body"] = json.loads(
                request.data.decode("utf-8")
            )
            captured["timeout"] = timeout

            return FakeResponse()

        result = (
            slave.send_measurement_node_heartbeat(
                configuration=config,
                opener=opener,
            )
        )

        self.assertTrue(result)
        self.assertEqual(
            captured["method"],
            "POST",
        )
        self.assertEqual(
            captured["authorization"],
            "Bearer {}".format(TOKEN),
        )
        self.assertEqual(
            captured["content_type"],
            "application/json",
        )
        self.assertEqual(
            captured["body"],
            {"nodeKey": "shenu"},
        )
        self.assertEqual(
            captured["timeout"],
            5,
        )

    def test_response_for_other_node_is_rejected(self):
        config = (
            slave.measurement_node_heartbeat_configuration(
                valid_environment()
            )
        )

        def opener(request, timeout):
            return FakeResponse(
                node_key="ryzen-validation"
            )

        with self.assertRaises(RuntimeError):
            slave.send_measurement_node_heartbeat(
                configuration=config,
                opener=opener,
            )

    def test_loop_sends_immediately(self):
        config = (
            slave.measurement_node_heartbeat_configuration(
                valid_environment()
            )
        )

        stop_event = threading.Event()
        calls = []

        def sender(configuration):
            calls.append(
                configuration["node_key"]
            )
            stop_event.set()
            return True

        slave._measurement_node_heartbeat_loop(
            stop_event,
            config,
            sender=sender,
        )

        self.assertEqual(
            calls,
            ["shenu"],
        )


if __name__ == "__main__":
    unittest.main()
