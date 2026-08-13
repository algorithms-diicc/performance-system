from flask import Blueprint, g, jsonify

from ..services.execution_query_service import (
    ExecutionSnapshotForbidden,
    ExecutionSnapshotNotFound,
    get_execution_snapshot_for_user,
)
from ..utils.api_errors import ForbiddenError, NotFoundError, handle_api_errors
from ..utils.auth_decorators import login_required

execution_status_bp = Blueprint(
    "execution_status",
    __name__,
    url_prefix="/api/executions",
)

@execution_status_bp.route("/<uuid:public_id>", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_status(public_id):
    try:
        execution = get_execution_snapshot_for_user(
            public_id=str(public_id),
            current_user_id=g.current_user["id"],
        )
    except ExecutionSnapshotNotFound:
        raise NotFoundError("La ejecución solicitada no existe.")
    except ExecutionSnapshotForbidden:
        raise ForbiddenError("No tienes permiso para ver esta ejecución.")

    return jsonify({"execution": execution}), 200
