"""Endpoints canónicos de identidad reproducible y exportación."""

from io import BytesIO
import re

from flask import Blueprint, g, jsonify, send_file

from ..repositories import export_repository
from ..services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_viewer,
)
from ..services.reproducibility_service import (
    ReproducibilityError,
    build_bundle_bytes,
    build_reproducibility_snapshot,
)
from ..services.result_artifact_service import (
    ResultArtifactError,
    inspect_result_artifact,
    require_result_artifact,
)
from ..utils.api_errors import (
    APIError,
    ForbiddenError,
    NotFoundError,
    handle_api_errors,
)
from ..utils.auth_decorators import get_user_role_name, login_required


export_bp = Blueprint("export", __name__, url_prefix="/api")
CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _current_role_name():
    role_name = getattr(g, "current_role_name", None)
    if role_name:
        return role_name
    return get_user_role_name(g.current_user)


def _validate_codename(codename):
    if not CODENAME_RE.fullmatch(str(codename or "")):
        raise APIError(
            "El identificador de ejecución no tiene un formato válido.",
            status_code=400,
            code="INVALID_EXECUTION_ID",
        )


def _execution_export_row(codename):
    _validate_codename(codename)
    try:
        assert_execution_viewer(
            codename=codename,
            current_user_id=g.current_user["id"],
            current_role_name=_current_role_name(),
        )
    except ExecutionAccessNotFound:
        raise NotFoundError("La ejecución solicitada no existe.")
    except ExecutionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a esta ejecución."
        )

    row = export_repository.get_execution_export_row_by_codename(codename)
    if row is None:
        raise NotFoundError("La ejecución solicitada no existe.")
    return row


def _raise_result_api_error(error):
    raise APIError(
        error.message,
        status_code=error.status_code,
        code=error.code,
    )


def _raise_reproducibility_api_error(error):
    raise APIError(
        error.message,
        status_code=error.status_code,
        code=error.code,
    )


def _no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@export_bp.route("/executions/<codename>/manifest", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_manifest(codename):
    row = _execution_export_row(codename)
    snapshot = build_reproducibility_snapshot(row)
    return _no_store(jsonify(snapshot.manifest)), 200


@export_bp.route(
    "/executions/<codename>/manifest/download",
    methods=["GET"],
)
@login_required
@handle_api_errors
def download_execution_manifest(codename):
    row = _execution_export_row(codename)
    snapshot = build_reproducibility_snapshot(row)
    response = send_file(
        BytesIO(snapshot.manifest_bytes),
        mimetype="application/json",
        as_attachment=True,
        download_name=(
            "performance-system-{}-manifest.json".format(codename)
        ),
        conditional=False,
        max_age=0,
    )
    return _no_store(response)


@export_bp.route(
    "/executions/<codename>/measurements/download",
    methods=["GET"],
)
@login_required
@handle_api_errors
def download_execution_measurements(codename):
    row = _execution_export_row(codename)
    result_snapshot = inspect_result_artifact(codename, row)
    try:
        artifact = require_result_artifact(result_snapshot)
    except ResultArtifactError as error:
        _raise_result_api_error(error)

    response = send_file(
        BytesIO(artifact.content_bytes),
        mimetype="text/csv",
        as_attachment=True,
        download_name="performance-system-{}.csv".format(codename),
        conditional=False,
        max_age=0,
    )
    return _no_store(response)


@export_bp.route("/executions/<codename>/bundle", methods=["GET"])
@login_required
@handle_api_errors
def download_execution_bundle(codename):
    row = _execution_export_row(codename)
    snapshot = build_reproducibility_snapshot(row)
    try:
        bundle_bytes = build_bundle_bytes(snapshot)
    except ReproducibilityError as error:
        _raise_reproducibility_api_error(error)

    response = send_file(
        BytesIO(bundle_bytes),
        mimetype="application/zip",
        as_attachment=True,
        download_name=(
            "performance-system-{}-bundle.zip".format(codename)
        ),
        conditional=False,
        max_age=0,
    )
    return _no_store(response)
