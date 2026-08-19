"""
CORE-04E — helpers canónicos para historial de ejecuciones.

Fuente lógica de estado:
    executions.execution_state

Compatibilidad temporal:
- La API todavía expone algunos nombres antiguos como status/statusLabel/rawStatus
  para no romper consumidores existentes.
- Esos campos se DERIVAN de execution_state; no de executions.status.
"""

from .execution_query_service import build_public_failure_payload

CANONICAL_STATES = frozenset({
    "QUEUED",
    "RUNNING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
})

STATE_LABELS = {
    "QUEUED": "En cola",
    "RUNNING": "En ejecución",
    "PROCESSING": "Procesando",
    "COMPLETED": "Completado",
    "FAILED": "Error",
    "CANCELLED": "Cancelada",
}


def map_execution_state_label(state):
    if not state:
        return "Desconocido"
    normalized = str(state).upper()
    return STATE_LABELS.get(normalized, normalized)


def build_failure_payload(row):
    state = str(row.get("execution_state") or "").upper()
    if state != "FAILED":
        return None

    return build_public_failure_payload(row)


def _iso(value):
    return value.isoformat() if value is not None else None


def _duration_ms(row):
    started = row.get("started_at")
    finished = row.get("finished_at")

    if started is not None and finished is not None:
        return max(
            0,
            int(round((finished - started).total_seconds() * 1000)),
        )

    value = row.get("duration_ms")
    return int(value) if value is not None else None


def serialize_execution_history_row(row):
    """
    Contrato de historial para una execution.

    status/statusLabel/rawStatus se conservan como aliases temporales,
    pero todos se derivan de execution_state.
    """
    state = str(row.get("execution_state") or "").upper()
    label = map_execution_state_label(state)

    return {
        "executionId": row.get("execution_id", row.get("id")),
        "publicId": row.get("public_id"),
        "codename": row.get("codename"),
        "originalFilename": (
            row.get("original_filename")
            or row.get("codename")
        ),
        "submissionId": row.get("submission_id"),
        "submissionTitle": row.get("submission_title"),
        "benchmark": row.get("benchmark"),
        "state": state,
        "stateLabel": label,
        "status": label,
        "statusLabel": label,
        "rawStatus": state,
        "startedAt": _iso(row.get("started_at")),
        "processingAt": _iso(row.get("processing_at")),
        "finishedAt": _iso(row.get("finished_at")),
        "durationMs": _duration_ms(row),
        "hardwareProfile": row.get("hardware_name"),
        "resultAvailable": bool(row.get("result_available")),
        "failure": build_failure_payload(row),
    }


def execution_status_filter_sql(status_param, alias="e"):
    """
    Convierte filtros UI/estado a SQL basado EXCLUSIVAMENTE en execution_state.

    Compatibilidad:
      Aprobado   -> COMPLETED
      Rechazado  -> FAILED + EXECUTION_TIMEOUT
      Error      -> FAILED excluyendo EXECUTION_TIMEOUT
    """
    if not alias.replace("_", "").isalnum():
        raise ValueError("Alias SQL inválido.")

    value = str(status_param or "all").strip()
    if not value or value.lower() == "all":
        return "", []

    normalized = value.upper()

    direct = {
        "QUEUED": "QUEUED",
        "EN COLA": "QUEUED",
        "RUNNING": "RUNNING",
        "EN EJECUCIÓN": "RUNNING",
        "EN EJECUCION": "RUNNING",
        "PROCESSING": "PROCESSING",
        "PROCESANDO": "PROCESSING",
        "COMPLETED": "COMPLETED",
        "COMPLETADO": "COMPLETED",
        "APROBADO": "COMPLETED",
        "CANCELLED": "CANCELLED",
        "CANCELADA": "CANCELLED",
    }

    if normalized in direct:
        return f" AND {alias}.execution_state = %s ", [direct[normalized]]

    if normalized in {"RECHAZADO", "TIMEOUT"}:
        return (
            f" AND {alias}.execution_state = 'FAILED' "
            f"AND {alias}.error_code = 'EXECUTION_TIMEOUT' ",
            [],
        )

    if normalized == "ERROR":
        return (
            f" AND {alias}.execution_state = 'FAILED' "
            f"AND COALESCE({alias}.error_code, '') <> 'EXECUTION_TIMEOUT' ",
            [],
        )

    if normalized == "FAILED":
        return f" AND {alias}.execution_state = 'FAILED' ", []

    raise ValueError("Valor inválido para 'status'.")


def summary_from_aggregate(row):
    completed = int(row.get("completed_executions") or 0)
    failed = int(row.get("failed_executions") or 0)
    timeout = int(row.get("timeout_executions") or 0)
    errors = int(row.get("error_executions") or 0)
    queued = int(row.get("queued_executions") or 0)
    running = int(row.get("running_executions") or 0)
    processing = int(row.get("processing_executions") or 0)
    cancelled = int(row.get("cancelled_executions") or 0)

    return {
        "executionsCount": int(row.get("executions_count") or 0),
        "completedExecutions": completed,
        "failedExecutions": failed,
        "timeoutExecutions": timeout,
        "errorExecutions": errors,
        "queuedExecutions": queued,
        "runningExecutions": running,
        "processingExecutions": processing,
        "cancelledExecutions": cancelled,
        # Compatibilidad temporal con UI antigua.
        "okExecutions": completed,
    }
