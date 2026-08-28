"""Endpoint interno autenticado para liveness de MeasurementNode."""

import hashlib
import hmac
import os

from flask import Blueprint, jsonify, request

from ..services.measurement_node_service import (
    MeasurementNodeError,
    MeasurementNodeMissing,
    normalize_node_key,
    record_measurement_node_heartbeat,
)


measurement_node_heartbeat_bp = Blueprint(
    "measurement_node_heartbeat",
    __name__,
    url_prefix="/api/internal/measurement-nodes",
)

HEARTBEAT_SECRET_ENV = "MEASUREMENT_NODE_HEARTBEAT_SECRET"
MIN_HEARTBEAT_SECRET_LENGTH = 32


def configured_heartbeat_secret(environment=None):
    source = os.environ if environment is None else environment
    secret = str(source.get(HEARTBEAT_SECRET_ENV) or "").strip()

    if (
        not secret
        or secret == "CHANGE_ME"
        or len(secret) < MIN_HEARTBEAT_SECRET_LENGTH
    ):
        return None

    return secret


def derive_measurement_node_heartbeat_token(
    secret,
    node_key,
):
    """
    Deriva un bearer por nodo sin exponer el secreto maestro al slave.
    """
    normalized_key = normalize_node_key(node_key)

    if not isinstance(secret, str) or not secret:
        raise MeasurementNodeError(
            "Measurement node heartbeat secret is required."
        )

    return hmac.new(
        secret.encode("utf-8"),
        normalized_key.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _error_response(code, message, status):
    return (
        jsonify(
            {
                "error": {
                    "code": code,
                    "message": message,
                }
            }
        ),
        status,
    )


def _bearer_token():
    authorization = request.headers.get(
        "Authorization",
        "",
    ).strip()

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        return None

    token = authorization[len(prefix):].strip()

    return token or None


@measurement_node_heartbeat_bp.post("/heartbeat")
def measurement_node_heartbeat():
    """
    Renueva exclusivamente last_heartbeat_at de un nodo registrado.

    No habilita nodos ni modifica draining, prioridad o HardwareProfile.
    """
    secret = configured_heartbeat_secret()

    if secret is None:
        return _error_response(
            "MEASUREMENT_NODE_HEARTBEAT_UNAVAILABLE",
            "Measurement node heartbeat is unavailable.",
            503,
        )

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return _error_response(
            "INVALID_MEASUREMENT_NODE_HEARTBEAT",
            "A valid heartbeat payload is required.",
            400,
        )

    try:
        node_key = normalize_node_key(
            payload.get("nodeKey")
        )
    except MeasurementNodeError:
        return _error_response(
            "INVALID_MEASUREMENT_NODE_HEARTBEAT",
            "A valid heartbeat payload is required.",
            400,
        )

    supplied_token = _bearer_token()
    expected_token = (
        derive_measurement_node_heartbeat_token(
            secret,
            node_key,
        )
    )

    if (
        supplied_token is None
        or not hmac.compare_digest(
            supplied_token,
            expected_token,
        )
    ):
        return _error_response(
            "INVALID_MEASUREMENT_NODE_CREDENTIALS",
            "Invalid measurement node credentials.",
            401,
        )

    try:
        row = record_measurement_node_heartbeat(
            node_key
        )
    except MeasurementNodeMissing:
        return _error_response(
            "MEASUREMENT_NODE_NOT_FOUND",
            "Measurement node is not registered.",
            404,
        )

    heartbeat_at = row.get("last_heartbeat_at")
    serialize = getattr(
        heartbeat_at,
        "isoformat",
        None,
    )

    return jsonify(
        {
            "nodeKey": node_key,
            "heartbeatAt": (
                serialize()
                if callable(serialize)
                else None
            ),
        }
    )
