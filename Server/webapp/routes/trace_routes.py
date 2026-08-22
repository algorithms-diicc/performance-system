"""API dedicada a la procedencia segura de ZIP, fuentes y Executions."""

from io import BytesIO
import re

from flask import Blueprint, g, jsonify, send_file

from ..repositories import trace_repository
from ..services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_viewer,
)
from ..services.source_provenance_service import (
    SourceProvenanceError,
    archive_download_name,
    build_trace_payload,
    inspect_archive,
    load_source_artifact,
    require_verified_archive,
    resolve_source_metadata_for_row,
    serialize_source_artifact,
    source_download_name,
    source_mime_type,
)
from ..services.submission_access_service import (
    SubmissionAccessForbidden,
    SubmissionAccessNotFound,
    assert_submission_viewer,
    is_submission_owner,
)
from ..utils.api_errors import (
    APIError,
    ForbiddenError,
    NotFoundError,
    handle_api_errors,
)
from ..utils.auth_decorators import get_user_role_name, login_required


trace_bp = Blueprint("trace", __name__, url_prefix="/api")
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


def _assert_current_user_can_view_execution(codename):
    _validate_codename(codename)
    try:
        return assert_execution_viewer(
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


def _execution_provenance(codename):
    access_row = _assert_current_user_can_view_execution(codename)
    provenance_row = trace_repository.get_execution_provenance_by_codename(
        codename
    )
    if provenance_row is None:
        raise NotFoundError("La ejecución solicitada no existe.")
    return access_row, provenance_row


def _raise_api_error(error):
    raise APIError(
        error.message,
        status_code=error.status_code,
        code=error.code,
    )


def _verified_source(provenance_row):
    archive = inspect_archive(provenance_row)
    try:
        resolve_source_metadata_for_row(provenance_row)
        return load_source_artifact(
            archive,
            provenance_row.get("source_filename"),
        )
    except SourceProvenanceError as error:
        _raise_api_error(error)


def _no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@trace_bp.route("/executions/<codename>/trace", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_trace(codename):
    access_row, provenance_row = _execution_provenance(codename)
    siblings = trace_repository.list_submission_sources(
        provenance_row["submission_id"]
    )
    payload = build_trace_payload(
        provenance_row,
        siblings,
        can_download_archive=is_submission_owner(
            access_row,
            g.current_user["id"],
        ),
    )
    return _no_store(jsonify(payload)), 200


@trace_bp.route("/executions/<codename>/source", methods=["GET"])
@login_required
@handle_api_errors
def get_execution_source(codename):
    _access_row, provenance_row = _execution_provenance(codename)
    artifact = _verified_source(provenance_row)
    try:
        payload = serialize_source_artifact(artifact)
    except SourceProvenanceError as error:
        _raise_api_error(error)
    return _no_store(jsonify(payload)), 200


@trace_bp.route(
    "/executions/<codename>/source/download",
    methods=["GET"],
)
@login_required
@handle_api_errors
def download_execution_source(codename):
    _access_row, provenance_row = _execution_provenance(codename)
    artifact = _verified_source(provenance_row)
    try:
        download_name = source_download_name(artifact)
    except SourceProvenanceError as error:
        _raise_api_error(error)

    response = send_file(
        BytesIO(artifact.content_bytes),
        mimetype=source_mime_type(artifact),
        as_attachment=True,
        download_name=download_name,
        conditional=False,
        max_age=0,
    )
    return _no_store(response)


@trace_bp.route("/submissions/<int:submission_id>/archive", methods=["GET"])
@login_required
@handle_api_errors
def download_submission_archive(submission_id):
    try:
        access_row = assert_submission_viewer(
            submission_id=submission_id,
            current_user_id=g.current_user["id"],
            current_role_name=_current_role_name(),
        )
    except SubmissionAccessNotFound:
        raise NotFoundError("La Submission solicitada no existe.")
    except SubmissionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a esta Submission."
        )

    if not is_submission_owner(access_row, g.current_user["id"]):
        raise ForbiddenError(
            "Solo el propietario puede descargar el archivo original."
        )

    archive_row = trace_repository.get_submission_archive_by_id(submission_id)
    if archive_row is None:
        raise NotFoundError("La Submission solicitada no existe.")

    archive = inspect_archive(archive_row)
    try:
        archive_bytes = require_verified_archive(archive)
    except SourceProvenanceError as error:
        _raise_api_error(error)

    response = send_file(
        BytesIO(archive_bytes),
        mimetype="application/zip",
        as_attachment=True,
        download_name=archive_download_name(archive_row),
        conditional=False,
        max_age=0,
    )
    return _no_store(response)
