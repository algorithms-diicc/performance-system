import os
import re

from flask import Blueprint, g, jsonify, request

from ..services.results_service import (
    ResultsInvalidError,
    ResultsNotFoundError,
    build_execution_results,
)
from ..services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_viewer,
)
from ..utils.api_errors import ForbiddenError, NotFoundError
from ..utils.auth_decorators import get_user_role_name, login_required
from ..services.ai_explanation_service import (
    AIExplanationError,
    AINotConfiguredError,
    AIOutputRejectedError,
    AIProviderError,
    generate_ai_explanation,
)


results_bp = Blueprint(
    "results",
    __name__,
    url_prefix="/api/executions",
)

# Los codenames actuales son IDs numéricos + sufijo de benchmark (LCS/CAMM...),
# pero permitimos también guion y underscore para no bloquear futuras versiones.
CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")

WEBAPP_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)
STATIC_DIR = os.path.join(WEBAPP_DIR, "static")
SERVER_DIR = os.path.dirname(WEBAPP_DIR)


class ExecutionResultsNotReady(Exception):
    """La Execution todavía no posee un resultado publicable."""


class ExecutionResultContractMismatch(Exception):
    """La referencia persistida no coincide con el artefacto de la Execution."""


def _assert_current_user_can_view(codename):
    role_name = getattr(g, "current_role_name", None)
    if not role_name:
        role_name = get_user_role_name(g.current_user)

    return assert_execution_viewer(
        codename=codename,
        current_user_id=g.current_user["id"],
        current_role_name=role_name,
    )


def _assert_canonical_result_reference(
    codename,
    execution_row,
    static_dir=None,
    server_dir=None,
):
    """
    MULTI-01: una ruta /executions/<codename>/... sólo puede publicar
    el artefacto canónico persistido para ESA Execution.

    No existe fallback a artefactos de siblings ni compatibilidad con bundles
    multi-CPP históricos. Los datos de prueba legacy pueden regenerarse.
    """
    if (
        execution_row.get("execution_state") != "COMPLETED"
        or execution_row.get("result_available") is not True
    ):
        raise ExecutionResultsNotReady(
            "La ejecución todavía no posee resultados publicables."
        )

    persisted_result_path = str(
        execution_row.get("result_path") or ""
    ).strip()
    if not persisted_result_path:
        raise ExecutionResultContractMismatch(
            "La ejecución COMPLETED no posee result_path."
        )

    static_root = os.path.realpath(static_dir or STATIC_DIR)
    server_root = os.path.realpath(server_dir or SERVER_DIR)

    expected_path = os.path.realpath(
        os.path.join(
            static_root,
            codename,
            "CombinedResults.csv",
        )
    )

    if os.path.isabs(persisted_result_path):
        persisted_path = os.path.realpath(persisted_result_path)
    else:
        persisted_path = os.path.realpath(
            os.path.join(
                server_root,
                persisted_result_path,
            )
        )

    if persisted_path != expected_path:
        raise ExecutionResultContractMismatch(
            "result_path no corresponde al codename solicitado."
        )

    return expected_path


@results_bp.route("/<codename>/results", methods=["GET"])
@login_required
def get_execution_results(codename):
    """
    GET /api/executions/<codename>/results

    Entrega los resultados estructurados de UNA ejecución concreta.

    Requiere autenticación y verifica en PostgreSQL si el actor es propietario,
    Admin o profesor responsable del curso antes de leer los resultados.
    """
    if not CODENAME_RE.fullmatch(codename):
        return _error_response(
            status=400,
            code="INVALID_EXECUTION_ID",
            message="El identificador de ejecución no tiene un formato válido.",
        )

    try:
        execution_row = _assert_current_user_can_view(codename)
    except ExecutionAccessNotFound:
        raise NotFoundError(
            "La ejecución solicitada no existe."
        )
    except ExecutionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a esta ejecución."
        )

    try:
        _assert_canonical_result_reference(
            codename,
            execution_row,
        )
    except ExecutionResultsNotReady:
        return _error_response(
            status=409,
            code="RESULTS_NOT_READY",
            message="La ejecución todavía no posee resultados publicables.",
        )
    except ExecutionResultContractMismatch:
        return _error_response(
            status=422,
            code="RESULTS_INVALID",
            message=(
                "La ejecución terminó, pero su referencia de resultados "
                "no cumple el contrato esperado."
            ),
        )

    try:
        payload = build_execution_results(
            static_dir=STATIC_DIR,
            codename=codename,
            hardware_snapshot=execution_row.get(
                "hardware_snapshot"
            ),
        )
    except ResultsNotFoundError:
        return _error_response(
            status=404,
            code="RESULTS_NOT_FOUND",
            message="No se encontraron resultados procesados para esta ejecución.",
        )
    except ResultsInvalidError:
        return _error_response(
            status=422,
            code="RESULTS_INVALID",
            message=(
                "Los resultados existen, pero no pudieron procesarse "
                "correctamente."
            ),
        )

    payload["execution"]["submission_id"] = (
        execution_row["submission_id"]
    )

    return jsonify(payload), 200


@results_bp.route(
    "/<codename>/ai-explanation",
    methods=["POST"],
)
@login_required
def create_ai_explanation(codename):
    """
    POST /api/executions/<codename>/ai-explanation

    Genera una explicación pedagógica complementaria con IA a partir
    exclusivamente de metrics + analysis + pedagogy.

    El código C/C++ del estudiante y el CSV bruto no se envían al proveedor.
    """
    if not CODENAME_RE.fullmatch(codename):
        return _error_response(
            status=400,
            code="INVALID_EXECUTION_ID",
            message="El identificador de ejecución no tiene un formato válido.",
        )

    try:
        execution_row = _assert_current_user_can_view(codename)
    except ExecutionAccessNotFound:
        raise NotFoundError(
            "La ejecución solicitada no existe."
        )
    except ExecutionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a esta ejecución."
        )

    try:
        _assert_canonical_result_reference(
            codename,
            execution_row,
        )
    except ExecutionResultsNotReady:
        return _error_response(
            status=409,
            code="RESULTS_NOT_READY",
            message="La ejecución todavía no posee resultados publicables.",
        )
    except ExecutionResultContractMismatch:
        return _error_response(
            status=422,
            code="RESULTS_INVALID",
            message=(
                "La ejecución terminó, pero su referencia de resultados "
                "no cumple el contrato esperado."
            ),
        )

    body = request.get_json(silent=True) or {}
    force = bool(body.get("force", False))

    try:
        results_payload = build_execution_results(
            static_dir=STATIC_DIR,
            codename=codename,
            hardware_snapshot=execution_row.get(
                "hardware_snapshot"
            ),
        )

        payload = generate_ai_explanation(
            static_dir=STATIC_DIR,
            codename=codename,
            results_payload=results_payload,
            force=force,
        )
    except ResultsNotFoundError:
        return _error_response(
            status=404,
            code="RESULTS_NOT_FOUND",
            message="No se encontraron resultados procesados para esta ejecución.",
        )
    except ResultsInvalidError:
        return _error_response(
            status=422,
            code="RESULTS_INVALID",
            message=(
                "Los resultados existen, pero no pudieron procesarse "
                "correctamente."
            ),
        )
    except AINotConfiguredError:
        return _error_response(
            status=503,
            code="AI_NOT_CONFIGURED",
            message="La explicación con IA no está configurada.",
        )
    except AIOutputRejectedError:
        return _error_response(
            status=502,
            code="AI_OUTPUT_REJECTED",
            message="La explicación generada no superó las validaciones.",
        )
    except AIProviderError:
        return _error_response(
            status=502,
            code="AI_PROVIDER_ERROR",
            message="El proveedor de IA no está disponible temporalmente.",
        )
    except AIExplanationError:
        return _error_response(
            status=500,
            code="AI_EXPLANATION_ERROR",
            message="No fue posible generar la explicación con IA.",
        )

    return jsonify(payload), 200


def _error_response(status, code, message):
    return (
        jsonify(
            {
                "error": {
                    "code": code,
                    "message": message,
                }
            }
        ),
        status,
    )
