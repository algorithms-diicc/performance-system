"""Framing and identity helpers for serial MeasurementNode targeting."""

import json
import re


TRANSPORT_VERSION = 1
HELLO_MESSAGE_TYPE = "measurement_node_hello"
CONTROL_NOT_SELECTED = "NOT_SELECTED"
MAX_HELLO_BYTES = 512
NODE_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


class MeasurementNodeTransportError(ValueError):
    """The peer does not satisfy the MeasurementNode transport contract."""


def normalize_node_key(value, required=True):
    key = str(value or "").strip().lower()
    if not key:
        if required:
            raise MeasurementNodeTransportError(
                "measurement node key is required"
            )
        return None
    if not NODE_KEY_RE.fullmatch(key):
        raise MeasurementNodeTransportError(
            "measurement node key has invalid format"
        )
    return key


def build_slave_hello(node_key):
    payload = {
        "transport_version": TRANSPORT_VERSION,
        "message_type": HELLO_MESSAGE_TYPE,
        "node_key": normalize_node_key(node_key),
    }
    return (
        json.dumps(payload, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def send_slave_hello(sock, node_key):
    sock.sendall(build_slave_hello(node_key))


def receive_slave_hello(sock, timeout_seconds=5):
    sock.settimeout(timeout_seconds)
    payload = b""

    while b"\n" not in payload:
        if len(payload) >= MAX_HELLO_BYTES:
            raise MeasurementNodeTransportError(
                "measurement node hello exceeds maximum size"
            )
        chunk = sock.recv(
            min(128, MAX_HELLO_BYTES - len(payload))
        )
        if not chunk:
            raise MeasurementNodeTransportError(
                "measurement node disconnected before hello"
            )
        payload += chunk

    line, remainder = payload.split(b"\n", 1)
    if remainder:
        raise MeasurementNodeTransportError(
            "unexpected bytes after measurement node hello"
        )

    try:
        hello = json.loads(line.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MeasurementNodeTransportError(
            "measurement node hello is not valid JSON"
        ) from exc

    if not isinstance(hello, dict):
        raise MeasurementNodeTransportError(
            "measurement node hello must be an object"
        )
    if hello.get("transport_version") != TRANSPORT_VERSION:
        raise MeasurementNodeTransportError(
            "unsupported measurement node transport version"
        )
    if hello.get("message_type") != HELLO_MESSAGE_TYPE:
        raise MeasurementNodeTransportError(
            "unexpected measurement node hello type"
        )

    return normalize_node_key(hello.get("node_key"))


def build_not_selected_payload():
    return json.dumps(
        {
            "transport_version": TRANSPORT_VERSION,
            "transport_control": CONTROL_NOT_SELECTED,
        },
        separators=(",", ":"),
    ).encode("utf-8")


def is_not_selected_payload(payload):
    return (
        isinstance(payload, dict)
        and payload.get("transport_control") == CONTROL_NOT_SELECTED
    )


def build_assignment(
    measurement_node_id,
    hardware_profile_id,
    measurement_node_key,
):
    try:
        node_id = int(measurement_node_id)
        profile_id = int(hardware_profile_id)
    except (TypeError, ValueError) as exc:
        raise MeasurementNodeTransportError(
            "target assignment requires numeric node/profile ids"
        ) from exc

    if node_id <= 0 or profile_id <= 0:
        raise MeasurementNodeTransportError(
            "target assignment ids must be positive"
        )

    return {
        "measurement_node_id": node_id,
        "hardware_profile_id": profile_id,
        "node_key": normalize_node_key(measurement_node_key),
    }


def validate_payload_assignment(payload, local_node_key):
    if not isinstance(payload, dict):
        raise MeasurementNodeTransportError(
            "execution payload must be an object"
        )

    assignment = payload.get("measurement_node")
    if assignment is None:
        if local_node_key is None:
            return None
        raise MeasurementNodeTransportError(
            "targeted measurement node requires payload assignment"
        )
    if not isinstance(assignment, dict):
        raise MeasurementNodeTransportError(
            "measurement_node assignment must be an object"
        )

    expected = normalize_node_key(assignment.get("node_key"))
    actual = normalize_node_key(local_node_key)
    if actual != expected:
        raise MeasurementNodeTransportError(
            "execution payload targets a different measurement node"
        )
    return dict(assignment)


def attach_result_identity(payload, node_key):
    result = dict(payload)
    if node_key is not None:
        result["measurement_node_key"] = normalize_node_key(node_key)
    return result


def validate_result_identity(payload, expected_node_key):
    if expected_node_key is None:
        return True
    if not isinstance(payload, dict):
        return False
    try:
        actual = normalize_node_key(payload.get("measurement_node_key"))
        expected = normalize_node_key(expected_node_key)
    except MeasurementNodeTransportError:
        return False
    return actual == expected
