"""Framing, targeting and authenticated MeasurementNode transport."""

import hashlib
import hmac
import json
import re
import secrets


TRANSPORT_VERSION = 2

HELLO_MESSAGE_TYPE = "measurement_node_hello"
CONTROL_NOT_SELECTED = "NOT_SELECTED"

AUTH_CHALLENGE_MESSAGE_TYPE = (
    "measurement_node_auth_challenge"
)
AUTH_PROOF_MESSAGE_TYPE = "measurement_node_auth_proof"
AUTH_OK_MESSAGE_TYPE = "measurement_node_auth_ok"
AUTH_READY_MESSAGE_TYPE = "measurement_node_auth_ready"

AUTH_CONTEXT_PAYLOAD = "payload"
AUTH_CONTEXT_RESULT = "result"
AUTH_CONTEXTS = {
    AUTH_CONTEXT_PAYLOAD,
    AUTH_CONTEXT_RESULT,
}

MAX_TRANSPORT_FRAME_BYTES = 1024

NODE_KEY_RE = re.compile(
    r"^[a-z0-9][a-z0-9_-]{0,63}$"
)
TOKEN_RE = re.compile(r"^[0-9a-f]{64}$")
NONCE_RE = re.compile(r"^[0-9a-f]{64}$")


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


def normalize_node_token(value):
    token = str(value or "").strip().lower()

    if not TOKEN_RE.fullmatch(token):
        raise MeasurementNodeTransportError(
            "measurement node token must be a 64-character "
            "hexadecimal HMAC token"
        )

    return token


def normalize_auth_context(value):
    context = str(value or "").strip().lower()

    if context not in AUTH_CONTEXTS:
        raise MeasurementNodeTransportError(
            "unsupported measurement node authentication context"
        )

    return context


def normalize_auth_nonce(value):
    nonce = str(value or "").strip().lower()

    if not NONCE_RE.fullmatch(nonce):
        raise MeasurementNodeTransportError(
            "measurement node authentication nonce is invalid"
        )

    return nonce


def _frame(payload):
    return (
        json.dumps(
            payload,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def receive_transport_frame(
    sock,
    timeout_seconds=5,
):
    """
    Recibe exactamente un frame JSON terminado en LF.

    Los bytes de aplicación nunca se mezclan con el handshake:
    challenge/proof/ack deben terminar antes de transmitir payloads.
    """
    sock.settimeout(timeout_seconds)
    payload = b""

    while b"\n" not in payload:
        if len(payload) >= MAX_TRANSPORT_FRAME_BYTES:
            raise MeasurementNodeTransportError(
                "measurement node transport frame exceeds maximum size"
            )

        chunk = sock.recv(
            min(
                128,
                MAX_TRANSPORT_FRAME_BYTES - len(payload),
            )
        )

        if not chunk:
            raise MeasurementNodeTransportError(
                "measurement node disconnected during transport frame"
            )

        payload += chunk

    line, remainder = payload.split(b"\n", 1)

    if remainder:
        raise MeasurementNodeTransportError(
            "unexpected bytes after measurement node transport frame"
        )

    try:
        decoded = json.loads(line.decode("utf-8"))
    except (
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as exc:
        raise MeasurementNodeTransportError(
            "measurement node transport frame is not valid JSON"
        ) from exc

    if not isinstance(decoded, dict):
        raise MeasurementNodeTransportError(
            "measurement node transport frame must be an object"
        )

    return decoded


def build_slave_hello(node_key):
    payload = {
        "transport_version": TRANSPORT_VERSION,
        "message_type": HELLO_MESSAGE_TYPE,
        "node_key": normalize_node_key(node_key),
    }

    return _frame(payload)


def send_slave_hello(sock, node_key):
    sock.sendall(build_slave_hello(node_key))


def receive_slave_hello(sock, timeout_seconds=5):
    hello = receive_transport_frame(
        sock,
        timeout_seconds=timeout_seconds,
    )

    if hello.get("transport_version") != TRANSPORT_VERSION:
        raise MeasurementNodeTransportError(
            "unsupported measurement node transport version"
        )

    if hello.get("message_type") != HELLO_MESSAGE_TYPE:
        raise MeasurementNodeTransportError(
            "unexpected measurement node hello type"
        )

    return normalize_node_key(
        hello.get("node_key")
    )


def build_not_selected_payload():
    return _frame(
        {
            "transport_version": TRANSPORT_VERSION,
            "transport_control": CONTROL_NOT_SELECTED,
        }
    )


def is_not_selected_payload(payload):
    return (
        isinstance(payload, dict)
        and payload.get("transport_control")
        == CONTROL_NOT_SELECTED
    )


def _auth_message(
    node_key,
    nonce,
    context,
):
    return "\x00".join(
        (
            str(TRANSPORT_VERSION),
            normalize_auth_context(context),
            normalize_node_key(node_key),
            normalize_auth_nonce(nonce),
        )
    ).encode("utf-8")


def derive_transport_auth_proof(
    node_token,
    node_key,
    nonce,
    context,
):
    token = normalize_node_token(node_token)

    return hmac.new(
        bytes.fromhex(token),
        _auth_message(
            node_key,
            nonce,
            context,
        ),
        hashlib.sha256,
    ).hexdigest()


def build_auth_challenge(
    context,
    nonce=None,
):
    normalized_context = normalize_auth_context(
        context
    )

    normalized_nonce = normalize_auth_nonce(
        nonce
        if nonce is not None
        else secrets.token_hex(32)
    )

    return _frame(
        {
            "transport_version": TRANSPORT_VERSION,
            "message_type":
                AUTH_CHALLENGE_MESSAGE_TYPE,
            "context": normalized_context,
            "nonce": normalized_nonce,
        }
    )


def build_auth_proof(
    node_token,
    node_key,
    nonce,
    context,
):
    normalized_context = normalize_auth_context(
        context
    )
    normalized_nonce = normalize_auth_nonce(
        nonce
    )
    normalized_node_key = normalize_node_key(
        node_key
    )

    return _frame(
        {
            "transport_version": TRANSPORT_VERSION,
            "message_type": AUTH_PROOF_MESSAGE_TYPE,
            "context": normalized_context,
            "nonce": normalized_nonce,
            "node_key": normalized_node_key,
            "proof": derive_transport_auth_proof(
                node_token,
                normalized_node_key,
                normalized_nonce,
                normalized_context,
            ),
        }
    )


def validate_auth_proof(
    payload,
    node_token,
    expected_node_key,
    expected_nonce,
    expected_context,
):
    if not isinstance(payload, dict):
        return False

    try:
        context = normalize_auth_context(
            payload.get("context")
        )
        nonce = normalize_auth_nonce(
            payload.get("nonce")
        )
        node_key = normalize_node_key(
            payload.get("node_key")
        )
        expected_key = normalize_node_key(
            expected_node_key
        )
        expected_nonce = normalize_auth_nonce(
            expected_nonce
        )
        expected_context = normalize_auth_context(
            expected_context
        )
        supplied = str(
            payload.get("proof") or ""
        ).strip().lower()

        if (
            payload.get("transport_version")
            != TRANSPORT_VERSION
            or payload.get("message_type")
            != AUTH_PROOF_MESSAGE_TYPE
            or context != expected_context
            or nonce != expected_nonce
            or node_key != expected_key
            or not TOKEN_RE.fullmatch(supplied)
        ):
            return False

        expected = derive_transport_auth_proof(
            node_token,
            expected_key,
            expected_nonce,
            expected_context,
        )

    except MeasurementNodeTransportError:
        return False

    return hmac.compare_digest(
        supplied,
        expected,
    )


def build_auth_ok(
    node_key,
    nonce,
    context,
):
    return _frame(
        {
            "transport_version": TRANSPORT_VERSION,
            "message_type": AUTH_OK_MESSAGE_TYPE,
            "context": normalize_auth_context(
                context
            ),
            "nonce": normalize_auth_nonce(
                nonce
            ),
            "node_key": normalize_node_key(
                node_key
            ),
        }
    )


def validate_auth_ok(
    payload,
    expected_node_key,
    expected_nonce,
    expected_context,
):
    if not isinstance(payload, dict):
        return False

    try:
        return (
            payload.get("transport_version")
            == TRANSPORT_VERSION
            and payload.get("message_type")
            == AUTH_OK_MESSAGE_TYPE
            and normalize_node_key(
                payload.get("node_key")
            )
            == normalize_node_key(
                expected_node_key
            )
            and normalize_auth_nonce(
                payload.get("nonce")
            )
            == normalize_auth_nonce(
                expected_nonce
            )
            and normalize_auth_context(
                payload.get("context")
            )
            == normalize_auth_context(
                expected_context
            )
        )
    except MeasurementNodeTransportError:
        return False


def authenticate_measurement_node_peer(
    sock,
    node_key,
    node_token,
    context,
    nonce=None,
):
    """
    Master -> peer challenge-response.

    El token no cruza el socket. La prueba queda ligada a:
    - versión de transporte;
    - contexto payload/result;
    - node_key;
    - nonce aleatorio por conexión.
    """
    normalized_key = normalize_node_key(
        node_key
    )
    normalized_context = normalize_auth_context(
        context
    )
    normalize_node_token(node_token)

    auth_nonce = normalize_auth_nonce(
        nonce
        if nonce is not None
        else secrets.token_hex(32)
    )

    sock.sendall(
        build_auth_challenge(
            normalized_context,
            nonce=auth_nonce,
        )
    )

    proof = receive_transport_frame(sock)

    if not validate_auth_proof(
        proof,
        node_token,
        normalized_key,
        auth_nonce,
        normalized_context,
    ):
        raise MeasurementNodeTransportError(
            "measurement node authentication proof is invalid"
        )

    sock.sendall(
        build_auth_ok(
            normalized_key,
            auth_nonce,
            normalized_context,
        )
    )

    # En el canal payload el master es también quien enviará
    # inmediatamente los bytes de aplicación. Esperar READY garantiza
    # que el slave ya consumió el ACK y evita coalescencia ACK+payload.
    if normalized_context == AUTH_CONTEXT_PAYLOAD:
        ready = receive_transport_frame(sock)

        if not validate_auth_ready(
            ready,
            normalized_key,
            auth_nonce,
            normalized_context,
        ):
            raise MeasurementNodeTransportError(
                "measurement node authentication ready frame is invalid"
            )

    return auth_nonce


def respond_to_auth_challenge(
    sock,
    challenge,
    node_key,
    node_token,
    expected_context,
):
    """
    Slave -> master proof.

    Espera ACK explícito antes de permitir bytes de aplicación,
    evitando mezclar proof y payload en un mismo frame TCP.
    """
    if not isinstance(challenge, dict):
        raise MeasurementNodeTransportError(
            "measurement node authentication challenge is invalid"
        )

    if (
        challenge.get("transport_version")
        != TRANSPORT_VERSION
        or challenge.get("message_type")
        != AUTH_CHALLENGE_MESSAGE_TYPE
    ):
        raise MeasurementNodeTransportError(
            "unexpected measurement node authentication challenge"
        )

    context = normalize_auth_context(
        challenge.get("context")
    )
    expected_context = normalize_auth_context(
        expected_context
    )

    if context != expected_context:
        raise MeasurementNodeTransportError(
            "measurement node authentication context mismatch"
        )

    nonce = normalize_auth_nonce(
        challenge.get("nonce")
    )
    normalized_key = normalize_node_key(
        node_key
    )
    normalize_node_token(node_token)

    sock.sendall(
        build_auth_proof(
            node_token,
            normalized_key,
            nonce,
            context,
        )
    )

    ack = receive_transport_frame(sock)

    if not validate_auth_ok(
        ack,
        normalized_key,
        nonce,
        context,
    ):
        raise MeasurementNodeTransportError(
            "measurement node authentication acknowledgement is invalid"
        )

    if context == AUTH_CONTEXT_PAYLOAD:
        sock.sendall(
            build_auth_ready(
                normalized_key,
                nonce,
                context,
            )
        )

    return True


def build_auth_ready(
    node_key,
    nonce,
    context,
):
    return _frame(
        {
            "transport_version": TRANSPORT_VERSION,
            "message_type": AUTH_READY_MESSAGE_TYPE,
            "context": normalize_auth_context(
                context
            ),
            "nonce": normalize_auth_nonce(
                nonce
            ),
            "node_key": normalize_node_key(
                node_key
            ),
        }
    )


def validate_auth_ready(
    payload,
    expected_node_key,
    expected_nonce,
    expected_context,
):
    if not isinstance(payload, dict):
        return False

    try:
        return (
            payload.get("transport_version")
            == TRANSPORT_VERSION
            and payload.get("message_type")
            == AUTH_READY_MESSAGE_TYPE
            and normalize_node_key(
                payload.get("node_key")
            )
            == normalize_node_key(
                expected_node_key
            )
            and normalize_auth_nonce(
                payload.get("nonce")
            )
            == normalize_auth_nonce(
                expected_nonce
            )
            and normalize_auth_context(
                payload.get("context")
            )
            == normalize_auth_context(
                expected_context
            )
        )
    except MeasurementNodeTransportError:
        return False


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
        "node_key": normalize_node_key(
            measurement_node_key
        ),
    }


def validate_payload_assignment(
    payload,
    local_node_key,
):
    if not isinstance(payload, dict):
        raise MeasurementNodeTransportError(
            "execution payload must be an object"
        )

    assignment = payload.get(
        "measurement_node"
    )

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

    expected = normalize_node_key(
        assignment.get("node_key")
    )
    actual = normalize_node_key(
        local_node_key
    )

    if actual != expected:
        raise MeasurementNodeTransportError(
            "execution payload targets a different measurement node"
        )

    return dict(assignment)


def attach_result_identity(
    payload,
    node_key,
):
    result = dict(payload)

    if node_key is not None:
        result[
            "measurement_node_key"
        ] = normalize_node_key(
            node_key
        )

    return result


def validate_result_identity(
    payload,
    expected_node_key,
):
    if expected_node_key is None:
        return True

    if not isinstance(payload, dict):
        return False

    try:
        actual = normalize_node_key(
            payload.get(
                "measurement_node_key"
            )
        )
        expected = normalize_node_key(
            expected_node_key
        )
    except MeasurementNodeTransportError:
        return False

    return actual == expected
