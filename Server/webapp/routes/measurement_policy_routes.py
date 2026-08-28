"""API read-only para políticas operacionales de medición."""

from flask import Blueprint, jsonify

from ..services.hardware_profile_service import (
    HardwareProfileError,
    configured_measurement_profile_key,
    list_hardware_profile_policies,
)
from ..utils.api_errors import APIError, handle_api_errors
from ..utils.auth_decorators import login_required


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


@measurement_policy_bp.route(
    "/measurement/policies",
    methods=["GET"],
)
@handle_api_errors
@login_required
def get_measurement_policies():
    profile_key = configured_measurement_profile_key()

    try:
        rows = list_hardware_profile_policies(profile_key)
    except HardwareProfileError:
        raise APIError(
            "La política del entorno de medición no está disponible.",
            status_code=503,
            code="MEASUREMENT_POLICY_UNAVAILABLE",
        )

    return jsonify(
        {
            "environment": {
                "mode": "AUTO",
            },
            "items": [
                serialize_measurement_policy(row)
                for row in rows
            ],
            "total": len(rows),
        }
    ), 200
