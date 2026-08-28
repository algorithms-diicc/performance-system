"""Contrato operacional de MeasurementNode y su liveness."""

from collections.abc import Mapping
from datetime import datetime
import os
import re

from ..repositories import measurement_node_repository


AVAILABLE = "AVAILABLE"
OFFLINE = "OFFLINE"
DRAINING = "DRAINING"

DEFAULT_MEASUREMENT_NODE_STALE_SECONDS = 30

NODE_KEY_RE = re.compile(
    r"^[a-z0-9][a-z0-9_-]{0,63}$"
)


class MeasurementNodeError(Exception):
    """Error base del dominio MeasurementNode."""


class MeasurementNodeMissing(MeasurementNodeError):
    """El node_key solicitado no corresponde a un nodo registrado."""


def _positive_integer(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return parsed if parsed > 0 else default


def configured_stale_seconds(environment=None):
    source = os.environ if environment is None else environment

    return _positive_integer(
        source.get("MEASUREMENT_NODE_STALE_SECONDS"),
        DEFAULT_MEASUREMENT_NODE_STALE_SECONDS,
    )


def normalize_node_key(value):
    node_key = str(value or "").strip().lower()

    if not NODE_KEY_RE.fullmatch(node_key):
        raise MeasurementNodeError(
            "Invalid measurement node_key."
        )

    return node_key


def register_measurement_node(
    node_key,
    display_name,
    hardware_profile_id,
    institutional_priority=0,
    is_enabled=False,
    is_validation_only=False,
    is_draining=False,
    repository=measurement_node_repository,
    conn=None,
):
    normalized_key = normalize_node_key(node_key)
    normalized_name = str(display_name or "").strip()

    if not normalized_name:
        raise MeasurementNodeError(
            "Measurement node display_name is required."
        )

    try:
        profile_id = int(hardware_profile_id)
    except (TypeError, ValueError):
        raise MeasurementNodeError(
            "hardware_profile_id must be an integer."
        )

    if profile_id <= 0:
        raise MeasurementNodeError(
            "hardware_profile_id must be positive."
        )

    try:
        priority = int(institutional_priority)
    except (TypeError, ValueError):
        raise MeasurementNodeError(
            "institutional_priority must be an integer."
        )

    if priority < 0:
        raise MeasurementNodeError(
            "institutional_priority must be non-negative."
        )

    return repository.upsert_measurement_node(
        node_key=normalized_key,
        display_name=normalized_name,
        hardware_profile_id=profile_id,
        institutional_priority=priority,
        is_enabled=bool(is_enabled),
        is_validation_only=bool(is_validation_only),
        is_draining=bool(is_draining),
        conn=conn,
    )


def record_measurement_node_heartbeat(
    node_key,
    repository=measurement_node_repository,
    conn=None,
):
    normalized_key = normalize_node_key(node_key)

    row = repository.touch_measurement_node_heartbeat(
        normalized_key,
        conn=conn,
    )

    if row is None:
        raise MeasurementNodeMissing(
            "Measurement node {!r} is not registered.".format(
                normalized_key
            )
        )

    return row


def _heartbeat_age_seconds(last_heartbeat_at, now):
    if last_heartbeat_at is None:
        return None

    if not isinstance(last_heartbeat_at, datetime):
        return None

    reference_now = now

    if reference_now is None:
        if last_heartbeat_at.tzinfo is not None:
            reference_now = datetime.now(
                tz=last_heartbeat_at.tzinfo
            )
        else:
            reference_now = datetime.now()

    if not isinstance(reference_now, datetime):
        raise MeasurementNodeError(
            "now must be a datetime."
        )

    try:
        age = (
            reference_now - last_heartbeat_at
        ).total_seconds()
    except TypeError:
        return None

    return max(0.0, age)


def derive_measurement_node_state(
    node,
    now=None,
    stale_after_seconds=None,
):
    """
    Deriva estado operacional sin persistirlo.

    Reglas:
    - deshabilitado o HardwareProfile inactivo -> OFFLINE;
    - heartbeat ausente/inválido/stale -> OFFLINE;
    - nodo vivo con draining -> DRAINING;
    - nodo vivo y habilitado -> AVAILABLE.

    BUSY pertenece al selector/ejecución y no se introduce en Gate 6.
    """
    if not isinstance(node, Mapping):
        raise MeasurementNodeError(
            "Measurement node must be a mapping."
        )

    stale_seconds = (
        configured_stale_seconds()
        if stale_after_seconds is None
        else _positive_integer(
            stale_after_seconds,
            DEFAULT_MEASUREMENT_NODE_STALE_SECONDS,
        )
    )

    age = _heartbeat_age_seconds(
        node.get("last_heartbeat_at"),
        now,
    )

    if not bool(node.get("is_enabled")):
        return OFFLINE

    if not bool(
        node.get("hardware_profile_is_active", True)
    ):
        return OFFLINE

    if age is None or age > stale_seconds:
        return OFFLINE

    if bool(node.get("is_draining")):
        return DRAINING

    return AVAILABLE


def project_measurement_node_status(
    node,
    now=None,
    stale_after_seconds=None,
):
    if not isinstance(node, Mapping):
        raise MeasurementNodeError(
            "Measurement node must be a mapping."
        )

    stale_seconds = (
        configured_stale_seconds()
        if stale_after_seconds is None
        else _positive_integer(
            stale_after_seconds,
            DEFAULT_MEASUREMENT_NODE_STALE_SECONDS,
        )
    )

    projected = dict(node)
    projected["operational_state"] = (
        derive_measurement_node_state(
            node,
            now=now,
            stale_after_seconds=stale_seconds,
        )
    )
    projected["heartbeat_age_seconds"] = (
        _heartbeat_age_seconds(
            node.get("last_heartbeat_at"),
            now,
        )
    )
    projected["stale_after_seconds"] = stale_seconds

    return projected


def list_measurement_node_statuses(
    repository=measurement_node_repository,
    conn=None,
    now=None,
    stale_after_seconds=None,
):
    rows = repository.list_measurement_nodes(
        conn=conn
    )

    return [
        project_measurement_node_status(
            row,
            now=now,
            stale_after_seconds=stale_after_seconds,
        )
        for row in rows
    ]
