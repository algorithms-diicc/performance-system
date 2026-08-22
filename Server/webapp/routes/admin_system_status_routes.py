"""Endpoint Admin read-only para diagnóstico operacional mínimo."""

from flask import Blueprint, jsonify

from ..services import system_status_service
from ..utils.auth_decorators import admin_required, login_required
from ..utils.api_errors import handle_api_errors


admin_system_status_bp = Blueprint(
    "admin_system_status",
    __name__,
    url_prefix="/api/admin/system-status",
)


@admin_system_status_bp.route("", methods=["GET"])
@login_required
@admin_required
@handle_api_errors
def get_system_status():
    return jsonify(system_status_service.build_system_status()), 200
