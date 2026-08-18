"""Contrato público y sanitizado para candidates de comparación histórica."""

from datetime import date, datetime
from pathlib import PurePosixPath
import re

from .comparison_service import ComparisonResultsInvalid, build_comparison


UNAVAILABLE_REASON = (
    "Los resultados de esta ejecución no están disponibles para comparación."
)
WHITESPACE_RE = re.compile(r"\s+")


class CandidateComparisonInvalid(ValueError):
    """El candidate no permite construir el contrato de comparación."""


def _text(value):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    normalized = WHITESPACE_RE.sub(" ", str(value).strip())
    return normalized or None


def _scalar(value):
    if value is None or isinstance(value, (dict, list, tuple, set, bool)):
        return None
    return value if isinstance(value, (int, float, str)) else str(value)


def _safe_basename(value):
    normalized = _text(value)
    if normalized is None or "\x00" in normalized:
        return None
    filename = PurePosixPath(normalized.replace("\\", "/")).name
    return filename if filename not in {"", ".", ".."} else None


def _created_at(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return _text(value)


def _candidate_identity(context):
    execution_config = context.get("execution_config")
    if not isinstance(execution_config, dict):
        execution_config = {}
    source_filename = _safe_basename(
        execution_config.get("original_filename")
        or context.get("source_filename")
    )
    return {
        "publicId": _scalar(context.get("public_id")),
        "codename": _text(context.get("codename")),
        "submissionId": _scalar(context.get("submission_id")),
        "submissionTitle": _text(context.get("submission_title")),
        "sourceFilename": source_filename,
        "createdAt": _created_at(context.get("created_at")),
        "benchmark": _text(context.get("benchmark")),
        "profile": _text(context.get("execution_profile")),
    }


def _compatibility_summary(compatibility):
    source = compatibility if isinstance(compatibility, dict) else {}
    return {
        "status": _text(source.get("status")) or "INCOMPATIBLE",
        "blockers": (
            source.get("blockers")
            if isinstance(source.get("blockers"), list)
            else []
        ),
        "warnings": (
            source.get("warnings")
            if isinstance(source.get("warnings"), list)
            else []
        ),
        "commonInputSizes": (
            source.get("commonInputSizes")
            if isinstance(source.get("commonInputSizes"), list)
            else []
        ),
        "commonMetrics": (
            source.get("commonMetrics")
            if isinstance(source.get("commonMetrics"), list)
            else []
        ),
    }


def _first_public_message(summary):
    status = str(summary.get("status") or "").upper()
    collections = (
        (summary.get("blockers"), summary.get("warnings"))
        if status == "INCOMPATIBLE"
        else (summary.get("warnings"), summary.get("blockers"))
    )
    for collection in collections:
        for issue in collection or []:
            if isinstance(issue, dict):
                message = _text(issue.get("message"))
                if message:
                    return message
    return None


def build_historical_candidate(
    selected_contexts,
    selected_results,
    candidate_context,
    candidate_results,
):
    """Evalúa el candidate contra el conjunto seleccionado completo."""
    try:
        payload = build_comparison(
            [*selected_contexts, candidate_context],
            [*selected_results, candidate_results],
        )
    except ComparisonResultsInvalid as error:
        raise CandidateComparisonInvalid() from error

    summary = _compatibility_summary(payload.get("compatibility"))
    status = str(summary["status"]).upper()
    if status not in {"COMPATIBLE", "LIMITED", "INCOMPATIBLE"}:
        status = "INCOMPATIBLE"
    summary["status"] = status

    public_execution = {}
    executions = payload.get("executions")
    if isinstance(executions, list) and executions:
        public_execution = executions[-1]

    item = _candidate_identity(candidate_context)
    for key in (
        "publicId",
        "codename",
        "submissionId",
        "submissionTitle",
        "sourceFilename",
        "benchmark",
        "profile",
    ):
        if key in public_execution:
            item[key] = public_execution.get(key)
    item.update(
        {
            "status": status,
            "selectable": status in {"COMPATIBLE", "LIMITED"},
            "compatibility": summary,
            "reason": _first_public_message(summary),
        }
    )
    return item


def build_unavailable_candidate(candidate_context):
    item = _candidate_identity(candidate_context)
    item.update(
        {
            "status": "UNAVAILABLE",
            "selectable": False,
            "compatibility": {
                "status": "UNAVAILABLE",
                "blockers": [],
                "warnings": [],
                "commonInputSizes": [],
                "commonMetrics": [],
            },
            "reason": UNAVAILABLE_REASON,
        }
    )
    return item
