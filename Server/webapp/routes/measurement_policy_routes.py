"""API read-only para políticas y targets de medición públicos."""

from flask import Blueprint, g, jsonify, request

from ..services.hardware_profile_service import (
    HardwareProfileError,
    configured_measurement_profile_key,
    list_hardware_profile_policies,
)
from ..services.measurement_node_selector_service import (
    MeasurementNodeSelectionError,
    is_new_measurement_target_available,
    list_pinnable_measurement_nodes,
    resolve_pinned_measurement_node,
)
from ..utils.api_errors import APIError, handle_api_errors
from ..utils.auth_decorators import (
    get_user_role_name,
    login_required,
)


measurement_policy_bp = Blueprint(
    "measurement_policy",
    __name__,
    url_prefix="/api",
)


def serialize_measurement_policy(row):
    """
    Contrato público mínimo.

    No expone IDs internos, IP, SSH ni detalles administrativos del nodo.
    """
    return {
        "benchmark": row["benchmark"],
        "executionProfile": row["execution_profile"],
        "minimumInput": int(row["minimum_input"]),
        "defaultInput": int(row["default_input"]),
        "recommendedMaxInput": int(
            row["recommended_max_input"]
        ),
        "hardMaxInput": int(row["hard_max_input"]),
        "inputStep": int(row["input_step"]),
        "operationalTimeoutSeconds": int(
            row["operational_timeout_seconds"]
        ),
    }


def serialize_measurement_node_option(row):
    """
    Identidad pública estable del target.

    No expone measurement_node_id ni información de transporte.
    """
    return {
        "nodeKey": row["node_key"],
        "displayName": row["display_name"],
        "state": row["operational_state"],
        "validationOnly": bool(
            row.get("is_validation_only")
        ),
        "hardwareProfile": {
            "profileKey": row[
                "hardware_profile_key"
            ],
            "name": row[
                "hardware_profile_name"
            ],
        },
    }


@measurement_policy_bp.route(
    "/measurement/nodes",
    methods=["GET"],
)
@handle_api_errors
@login_required
def get_measurement_nodes():
    role_name = get_user_role_name(
        g.current_user
    )

    rows = list_pinnable_measurement_nodes(
        role_name
    )

    items = [
        serialize_measurement_node_option(row)
        for row in rows
    ]

    return jsonify(
        {
            "defaultMode": "AUTO",
            "items": items,
            "total": len(items),
        }
    ), 200


@measurement_policy_bp.route(
    "/measurement/policies",
    methods=["GET"],
)
@handle_api_errors
@login_required
def get_measurement_policies():
    role_name = get_user_role_name(
        g.current_user
    )

    requested_node_key = (
        request.args.get("nodeKey")
        or request.args.get("node_key")
        or None
    )

    environment = {
        "mode": "AUTO",
    }

    if requested_node_key is not None:
        try:
            target = resolve_pinned_measurement_node(
                requested_node_key,
                current_role_name=role_name,
            )
        except MeasurementNodeSelectionError as exc:
            raise APIError(
                str(exc),
                status_code=400,
                code="MEASUREMENT_NODE_SELECTION_INVALID",
            )

        profile_key = target[
            "hardware_profile_key"
        ]

        environment = {
            "mode": "PINNED",
            "node": serialize_measurement_node_option(
                target
            ),
        }
        measurement_available = True

    else:
        profile_key = (
            configured_measurement_profile_key()
        )
        measurement_available = (
            is_new_measurement_target_available(
                role_name,
                "AUTO",
            )
        )

    try:
        rows = list_hardware_profile_policies(
            profile_key
        )
    except HardwareProfileError:
        raise APIError(
            "La política del entorno de medición no está disponible.",
            status_code=503,
            code="MEASUREMENT_POLICY_UNAVAILABLE",
        )

    return jsonify(
        {
            "environment": environment,
            "availability": {
                "available": bool(
                    measurement_available
                ),
            },
            "items": [
                serialize_measurement_policy(row)
                for row in rows
            ],
            "total": len(rows),
        }
    ), 200
