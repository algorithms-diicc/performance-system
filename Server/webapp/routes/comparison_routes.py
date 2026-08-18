"""API efímera de comparación científica entre executions autorizadas."""

import os
import re

from flask import Blueprint, g, jsonify, request

from ..repositories import comparison_repository, export_repository
from ..services.comparison_candidates_service import (
    CandidateComparisonInvalid,
    build_historical_candidate,
    build_unavailable_candidate,
)
from ..services.comparison_service import (
    ComparisonResultsInvalid,
    build_comparison,
)
from ..services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_viewer,
)
from ..services.result_artifact_service import (
    ResultArtifactInvalidReference,
    ResultArtifactNotReady,
    assert_canonical_result_reference,
)
from ..services.results_service import (
    ResultsInvalidError,
    ResultsNotFoundError,
    build_execution_results,
)
from ..utils.api_errors import (
    APIError,
    ForbiddenError,
    NotFoundError,
)
from ..utils.auth_decorators import get_user_role_name, login_required


comparisons_bp = Blueprint(
    "comparisons",
    __name__,
    url_prefix="/api",
)
CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")
PUBLIC_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{12}$"
)
WEBAPP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(WEBAPP_DIR, "static")
SERVER_DIR = os.path.dirname(WEBAPP_DIR)


def _comparison_error(status_code, code, message):
    raise APIError(
        message,
        status_code=status_code,
        code=code,
    )


def _validated_codenames(*, maximum, count_message):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {"executions"}:
        _comparison_error(
            400,
            "INVALID_COMPARISON_REQUEST",
            "La solicitud debe contener únicamente el campo executions.",
        )

    values = body.get("executions")
    if not isinstance(values, list) or not 2 <= len(values) <= maximum:
        _comparison_error(
            400,
            "INVALID_COMPARISON_REQUEST",
            count_message,
        )

    codenames = []
    for value in values:
        if not isinstance(value, str):
            _comparison_error(
                400,
                "INVALID_COMPARISON_REQUEST",
                "Cada execution debe identificarse mediante un codename válido.",
            )
        codename = value.strip()
        if (
            not codename
            or not CODENAME_RE.fullmatch(codename)
            or codename.isdecimal()
            or PUBLIC_UUID_RE.fullmatch(codename)
        ):
            _comparison_error(
                400,
                "INVALID_COMPARISON_REQUEST",
                "Cada execution debe identificarse mediante un codename válido.",
            )
        codenames.append(codename)

    if len(set(codenames)) != len(codenames):
        _comparison_error(
            400,
            "INVALID_COMPARISON_REQUEST",
            "No se permiten codenames duplicados.",
        )
    return codenames


def _validated_execution_codenames():
    return _validated_codenames(
        maximum=4,
        count_message="La comparación requiere entre dos y cuatro ejecuciones.",
    )


def _validated_candidate_selection():
    return _validated_codenames(
        maximum=3,
        count_message=(
            "La búsqueda histórica requiere dos o tres ejecuciones seleccionadas."
        ),
    )


def _current_role_name():
    role_name = getattr(g, "current_role_name", None)
    return role_name or get_user_role_name(g.current_user)


def _authorize_all(codenames):
    role_name = _current_role_name()
    for codename in codenames:
        try:
            assert_execution_viewer(
                codename=codename,
                current_user_id=g.current_user["id"],
                current_role_name=role_name,
            )
        except ExecutionAccessNotFound:
            raise NotFoundError("La ejecución solicitada no existe.")
        except ExecutionAccessForbidden:
            raise ForbiddenError(
                "No tienes permiso para comparar las ejecuciones solicitadas."
            )


def _load_execution_context(codename):
    row = export_repository.get_execution_export_row_by_codename(codename)
    if row is None:
        raise NotFoundError("La ejecución solicitada no existe.")
    return row


def _validate_result_reference(codename, execution_row):
    try:
        assert_canonical_result_reference(
            codename,
            execution_row,
            static_dir=STATIC_DIR,
            server_dir=SERVER_DIR,
        )
    except ResultArtifactNotReady:
        _comparison_error(
            409,
            "COMPARISON_RESULTS_NOT_READY",
            "Al menos una ejecución todavía no posee resultados publicables.",
        )
    except ResultArtifactInvalidReference:
        _comparison_error(
            422,
            "COMPARISON_RESULTS_INVALID",
            "La referencia de resultados no cumple el contrato canónico.",
        )


def _load_structured_results(codename, execution_row):
    try:
        return build_execution_results(
            static_dir=STATIC_DIR,
            codename=codename,
            hardware_snapshot=execution_row.get("hardware_snapshot"),
        )
    except ResultsNotFoundError:
        _comparison_error(
            404,
            "COMPARISON_RESULTS_NOT_FOUND",
            "No se encontraron resultados procesados para la comparación.",
        )
    except ResultsInvalidError:
        _comparison_error(
            422,
            "COMPARISON_RESULTS_INVALID",
            "Los resultados estructurados no cumplen el contrato esperado.",
        )


def _load_selected_comparison_inputs(codenames):
    contexts = [_load_execution_context(codename) for codename in codenames]
    results = []
    for codename, execution_row in zip(codenames, contexts):
        _validate_result_reference(codename, execution_row)
        results.append(_load_structured_results(codename, execution_row))
    return contexts, results


def _candidate_is_visible(codename, role_name):
    try:
        assert_execution_viewer(
            codename=codename,
            current_user_id=g.current_user["id"],
            current_role_name=role_name,
        )
        return True
    except (ExecutionAccessNotFound, ExecutionAccessForbidden):
        return False


def _candidate_item(
    codename,
    candidate_context,
    selected_contexts,
    selected_results,
):
    try:
        assert_canonical_result_reference(
            codename,
            candidate_context,
            static_dir=STATIC_DIR,
            server_dir=SERVER_DIR,
        )
        candidate_results = build_execution_results(
            static_dir=STATIC_DIR,
            codename=codename,
            hardware_snapshot=candidate_context.get("hardware_snapshot"),
        )
        return build_historical_candidate(
            selected_contexts,
            selected_results,
            candidate_context,
            candidate_results,
        )
    except (
        ResultArtifactNotReady,
        ResultArtifactInvalidReference,
        ResultsNotFoundError,
        ResultsInvalidError,
        CandidateComparisonInvalid,
    ):
        return build_unavailable_candidate(candidate_context)


@comparisons_bp.route("/comparisons", methods=["POST"])
@login_required
def create_comparison():
    codenames = _validated_execution_codenames()

    # All or nothing: no se carga contexto científico hasta que todas las
    # executions hayan superado la política canónica de visualización.
    _authorize_all(codenames)

    execution_contexts, results_payloads = _load_selected_comparison_inputs(
        codenames
    )

    try:
        payload = build_comparison(
            execution_contexts,
            results_payloads,
        )
    except ComparisonResultsInvalid:
        _comparison_error(
            422,
            "COMPARISON_RESULTS_INVALID",
            "Los resultados estructurados no cumplen el contrato esperado.",
        )

    return jsonify(payload), 200


@comparisons_bp.route("/comparisons/candidates", methods=["POST"])
@login_required
def list_comparison_candidates():
    codenames = _validated_candidate_selection()

    # La búsqueda histórica sólo comienza después de autorizar la selección
    # completa. Sus resultados se cargan una vez y se reutilizan por candidate.
    _authorize_all(codenames)
    selected_contexts, selected_results = _load_selected_comparison_inputs(
        codenames
    )

    role_name = _current_role_name()
    candidate_rows = comparison_repository.list_recent_candidate_executions(
        current_user_id=g.current_user["id"],
        current_role_name=role_name,
        excluded_codenames=codenames,
    )
    selected_set = set(codenames)
    items = []
    for row in candidate_rows.get("items", []):
        codename = str(row.get("codename") or "").strip()
        if not codename or codename in selected_set:
            continue
        if not _candidate_is_visible(codename, role_name):
            continue

        candidate_context = (
            export_repository.get_execution_export_row_by_codename(codename)
        )
        if candidate_context is None:
            continue
        items.append(
            _candidate_item(
                codename,
                candidate_context,
                selected_contexts,
                selected_results,
            )
        )

    return jsonify(
        {
            "schemaVersion": "1.0",
            "selection": {
                "executions": codenames,
                "count": len(codenames),
                "max": 4,
            },
            "items": items,
            "truncated": bool(candidate_rows.get("truncated")),
        }
    ), 200
