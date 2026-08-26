from flask import Blueprint, g, jsonify

from ..services.execution_query_service import (
    ExecutionSnapshotForbidden,
    ExecutionSnapshotNotFound,
    get_execution_snapshot_for_user,
)
from ..services.execution_cancellation_service import (
    ExecutionCancellationConflict,
    ExecutionCancellationForbidden,
    ExecutionCancellationNotFound,
    cancel_queued_execution,
)
from ..services.execution_reuse_service import (
    ExecutionReuseForbidden,
    ExecutionReuseNotFound,
    get_execution_reuse_for_user,
)
from ..utils.api_errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    handle_api_errors,
)
from ..utils.auth_decorators import get_user_role_name, login_required

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


@execution_status_bp.route("/<uuid:public_id>/cancel", methods=["POST"])
@login_required
@handle_api_errors
def cancel_execution(public_id):
    try:
        execution = cancel_queued_execution(
            public_id=str(public_id),
            current_user_id=g.current_user["id"],
            current_role_name=get_user_role_name(g.current_user),
        )
    except ExecutionCancellationNotFound:
        raise NotFoundError("La ejecución solicitada no existe.")
    except ExecutionCancellationForbidden:
        raise ForbiddenError(
            "No tienes permiso para cancelar esta ejecución."
        )
    except ExecutionCancellationConflict:
        raise ConflictError(
            "La ejecución ya no está en cola y no puede cancelarse."
        )

    return jsonify({"execution": execution}), 200


@execution_status_bp.route("/<uuid:public_id>/reuse", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_reuse(public_id):
    try:
        reuse = get_execution_reuse_for_user(
            public_id=str(public_id),
            current_user_id=g.current_user["id"],
        )
    except ExecutionReuseNotFound:
        raise NotFoundError(
            "La ejecución solicitada no existe."
        )
    except ExecutionReuseForbidden:
        raise ForbiddenError(
            "No tienes permiso para reutilizar esta ejecución."
        )

    return jsonify({"reuse": reuse}), 200
