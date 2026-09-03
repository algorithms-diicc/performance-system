"""API efímera de comparación científica entre executions autorizadas."""

import os
import re

from flask import Blueprint, current_app, g, jsonify, request

from ..repositories import comparison_repository, export_repository
from ..services.comparison_candidates_service import (
    CandidateComparisonInvalid,
    build_historical_candidate,
    build_unavailable_candidate,
)
from ..services.ai_runtime import AIInvalidLanguageError
from ..services.comparison_ai_service import (
    ComparisonAIError,
    ComparisonAINotConfiguredError,
    ComparisonAIOutputRejectedError,
    ComparisonAIProviderError,
    ComparisonAITimeoutError,
    ComparisonAIUnavailableError,
    generate_comparison_ai_explanation,
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


def _validated_execution_values(
    values,
    *,
    minimum=2,
    maximum,
    count_message,
    error_code="INVALID_COMPARISON_REQUEST",
):
    if (
        not isinstance(values, list)
        or not minimum <= len(values) <= maximum
    ):
        _comparison_error(
            400,
            error_code,
            count_message,
        )

    codenames = []
    for value in values:
        if not isinstance(value, str):
            _comparison_error(
                400,
                error_code,
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
                error_code,
                "Cada execution debe identificarse mediante un codename válido.",
            )

        codenames.append(codename)

    if len(set(codenames)) != len(codenames):
        _comparison_error(
            400,
            error_code,
            "No se permiten codenames duplicados.",
        )

    return codenames


def _validated_codenames(*, maximum, count_message):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {"executions"}:
        _comparison_error(
            400,
            "INVALID_COMPARISON_REQUEST",
            "La solicitud debe contener únicamente el campo executions.",
        )

    return _validated_execution_values(
        body.get("executions"),
        maximum=maximum,
        count_message=count_message,
    )


def _validated_ai_request():
    body = request.get_json(silent=True)
    allowed = {"executions", "language", "force"}

    if (
        not isinstance(body, dict)
        or "executions" not in body
        or not set(body).issubset(allowed)
    ):
        _comparison_error(
            400,
            "INVALID_COMPARISON_AI_REQUEST",
            (
                "La solicitud de IA comparativa sólo admite executions, "
                "language y force."
            ),
        )

    language = body.get("language", "es")
    force = body.get("force", False)

    if not isinstance(language, str):
        _comparison_error(
            400,
            "INVALID_COMPARISON_AI_REQUEST",
            "language debe ser un string.",
        )

    if not isinstance(force, bool):
        _comparison_error(
            400,
            "INVALID_COMPARISON_AI_REQUEST",
            "force debe ser booleano.",
        )

    codenames = _validated_execution_values(
        body.get("executions"),
        maximum=4,
        count_message=(
            "La comparación requiere entre dos y cuatro ejecuciones."
        ),
        error_code="INVALID_COMPARISON_AI_REQUEST",
    )

    return codenames, language, force


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


def _validated_single_execution():
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {"execution"}:
        _comparison_error(
            400,
            "INVALID_COMPARISON_SHORTCUT_REQUEST",
            "La solicitud debe contener únicamente el campo execution.",
        )

    return _validated_execution_values(
        [body.get("execution")],
        minimum=1,
        maximum=1,
        count_message="La solicitud requiere una execution.",
        error_code="INVALID_COMPARISON_SHORTCUT_REQUEST",
    )[0]


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


def _authorize_one(codename):
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
            "No tienes permiso para comparar la ejecución solicitada."
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


@comparisons_bp.route(
    "/comparisons/ai-explanation",
    methods=["POST"],
)
@login_required
def create_comparison_ai_explanation():
    codenames, language, force = _validated_ai_request()

    # Gate all-or-nothing: no se carga evidencia antes de autorizar
    # la selección completa.
    _authorize_all(codenames)

    execution_contexts, results_payloads = _load_selected_comparison_inputs(
        codenames
    )

    try:
        comparison_payload = build_comparison(
            execution_contexts,
            results_payloads,
        )
    except ComparisonResultsInvalid:
        _comparison_error(
            422,
            "COMPARISON_RESULTS_INVALID",
            "Los resultados estructurados no cumplen el contrato esperado.",
        )

    try:
        payload = generate_comparison_ai_explanation(
            static_dir=STATIC_DIR,
            comparison_payload=comparison_payload,
            force=force,
            language=language,
        )
    except AIInvalidLanguageError:
        _comparison_error(
            400,
            "INVALID_AI_LANGUAGE",
            "El idioma solicitado para la explicación no está soportado.",
        )
    except ComparisonAIUnavailableError:
        _comparison_error(
            422,
            "COMPARISON_AI_UNAVAILABLE",
            (
                "La comparación no posee una base experimental válida "
                "suficiente para generar una síntesis asistida."
            ),
        )
    except ComparisonAINotConfiguredError:
        _comparison_error(
            503,
            "AI_NOT_CONFIGURED",
            "La explicación con IA no está configurada.",
        )
    except ComparisonAITimeoutError:
        _comparison_error(
          504,
          "AI_PROVIDER_TIMEOUT",
          "El proveedor de IA excedió el tiempo máximo de respuesta.",
        )
    except ComparisonAIOutputRejectedError as exc:
        current_app.logger.warning(
            "Comparison AI output rejected by guardrails: %s",
            exc,
        )
        _comparison_error(
            502,
            "AI_OUTPUT_REJECTED",
            "La explicación generada no superó las validaciones.",
        )
    except ComparisonAIProviderError:
        _comparison_error(
            502,
            "AI_PROVIDER_ERROR",
            "El proveedor de IA no está disponible temporalmente.",
        )
    except ComparisonAIError:
        _comparison_error(
            500,
            "COMPARISON_AI_ERROR",
            "No fue posible generar la explicación comparativa con IA.",
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


@comparisons_bp.route(
    "/comparisons/reference-candidates",
    methods=["POST"],
)
@login_required
def list_reference_comparison_candidates():
    codename = _validated_single_execution()
    access_row = _authorize_one(codename)
    owner_user_id = access_row.get("owner_user_id")

    # Las Referencias y sus notas son metadata personal. Incluso Teacher/Admin
    # deben usar este browser únicamente sobre su propio Experimento.
    if int(owner_user_id) != int(g.current_user["id"]):
        raise ForbiddenError(
            "Las referencias personales solo están disponibles para su propietario."
        )

    selected_contexts, selected_results = _load_selected_comparison_inputs(
        [codename]
    )
    candidate_rows = (
        comparison_repository.list_reference_candidate_executions(
            owner_user_id=owner_user_id,
            excluded_codename=codename,
        )
    )

    role_name = _current_role_name()
    items = []
    for row in candidate_rows.get("items", []):
        candidate_codename = str(row.get("codename") or "").strip()
        if not candidate_codename or not _candidate_is_visible(
            candidate_codename,
            role_name,
        ):
            continue
        candidate_context = (
            export_repository.get_execution_export_row_by_codename(
                candidate_codename
            )
        )
        if candidate_context is None:
            continue
        items.append(
            _candidate_item(
                candidate_codename,
                candidate_context,
                selected_contexts,
                selected_results,
            )
        )

    return jsonify(
        {
            "schemaVersion": "1.0",
            "execution": codename,
            "items": items,
            "truncated": bool(candidate_rows.get("truncated")),
        }
    ), 200


@comparisons_bp.route(
    "/comparisons/previous-compatible",
    methods=["POST"],
)
@login_required
def get_previous_compatible_execution():
    codename = _validated_single_execution()
    access_row = _authorize_one(codename)
    owner_user_id = access_row.get("owner_user_id")
    selected_contexts, selected_results = _load_selected_comparison_inputs(
        [codename]
    )
    role_name = _current_role_name()
    offset = 0
    while True:
        repository_args = {
            "current_codename": codename,
            "owner_user_id": owner_user_id,
        }
        if offset:
            repository_args["offset"] = offset
        candidate_rows = (
            comparison_repository.list_previous_candidate_executions(
                **repository_args
            )
        )

        rows = candidate_rows.get("items", [])
        for row in rows:
            candidate_codename = str(
                row.get("codename") or ""
            ).strip()
            if not candidate_codename or not _candidate_is_visible(
                candidate_codename,
                role_name,
            ):
                continue
            candidate_context = (
                export_repository.get_execution_export_row_by_codename(
                    candidate_codename
                )
            )
            if candidate_context is None:
                continue
            candidate = _candidate_item(
                candidate_codename,
                candidate_context,
                selected_contexts,
                selected_results,
            )
            if candidate.get("selectable") is True:
                return jsonify({"candidate": candidate}), 200

        # Cada lectura permanece acotada, pero la búsqueda sigue siendo exacta:
        # si una página no contiene un candidate seleccionable, se avanza en
        # el mismo orden determinista hasta agotar las filas anteriores.
        if not candidate_rows.get("truncated") or not rows:
            break
        offset += len(rows)

    return jsonify({"candidate": None}), 200
