from ..repositories import execution_query_repository

TERMINAL_STATES = frozenset({"COMPLETED", "FAILED", "CANCELLED"})

PUBLIC_FAILURE_MESSAGES = {
    "COMPILE_ERROR": "El código no pudo compilarse correctamente.",
    "EXECUTION_TIMEOUT": "La ejecución excedió el tiempo límite.",
    "MASTER_WAIT_TIMEOUT": "La ejecución excedió el tiempo máximo de espera.",
    "NO_MACHINES_AVAILABLE": (
        "No hay un nodo de medición disponible en este momento."
    ),
    "MASTER_SLAVE_ERROR": (
        "Se perdió la comunicación con el nodo de medición."
    ),
    "QUEUE_ENQUEUE_FAILED": (
        "No fue posible incorporar el análisis a la cola de ejecución."
    ),
    "RESULT_CSV_MISSING": (
        "La ejecución terminó sin producir los resultados esperados."
    ),
    "RESULT_ARTIFACT_MISSING": (
        "El procesamiento terminó sin generar el resultado esperado."
    ),
    "GRAPH_PROCESSING_ERROR": (
        "No fue posible completar el procesamiento de los resultados."
    ),
    "QUEUE_STALE": (
        "La ejecución permaneció en cola más tiempo del permitido."
    ),
    "COORDINATOR_HEARTBEAT_LOST": (
        "Se perdió la comunicación mientras la ejecución estaba activa."
    ),
    "PROCESSING_HEARTBEAT_LOST": (
        "Se perdió la comunicación durante el procesamiento de resultados."
    ),
    "EXECUTION_ERROR": "La ejecución terminó con un error inesperado.",
    "LEGACY_EXECUTION_ERROR": "La ejecución terminó con un error.",
    "UNKNOWN_WORKER_ERROR": "El nodo de medición informó un error.",
}

PUBLIC_STAGE_MESSAGES = {
    "COMPILATION": "El código no pudo compilarse correctamente.",
    "EXECUTION": "La ejecución terminó con un error.",
    "MEASUREMENT": "No fue posible completar las mediciones.",
    "PROCESSING": "No fue posible procesar los resultados.",
    "INFRASTRUCTURE": "La infraestructura de ejecución no estuvo disponible.",
}

class ExecutionSnapshotError(Exception):
    pass

class ExecutionSnapshotNotFound(ExecutionSnapshotError):
    pass

class ExecutionSnapshotForbidden(ExecutionSnapshotError):
    pass

def _iso(value):
    return value.isoformat() if value is not None else None

def _duration_ms(row):
    started = row.get("started_at")
    finished = row.get("finished_at")
    if started is not None and finished is not None:
        return max(0, int(round((finished - started).total_seconds() * 1000)))
    value = row.get("duration_ms")
    return int(value) if value is not None else None

def _original_filename(row):
    config = row.get("execution_config") or {}
    if isinstance(config, dict):
        value = config.get("original_filename")
        return str(value) if value else None
    return None


def build_public_failure_payload(row):
    code = str(row.get("error_code") or "").strip().upper()
    stage = str(row.get("failure_stage") or "").strip().upper()

    return {
        "stage": stage or None,
        "code": code or "EXECUTION_FAILED",
        "message": (
            PUBLIC_FAILURE_MESSAGES.get(code)
            or PUBLIC_STAGE_MESSAGES.get(stage)
            or "La ejecución no pudo completarse."
        ),
    }

def build_execution_snapshot(row, current_user_id):
    if row is None:
        raise ExecutionSnapshotNotFound("La ejecución solicitada no existe.")

    if int(row.get("owner_user_id")) != int(current_user_id):
        raise ExecutionSnapshotForbidden(
            "No tienes permiso para ver esta ejecución."
        )

    state = str(row.get("execution_state") or "")
    terminal = state in TERMINAL_STATES
    result_available = state == "COMPLETED" and bool(row.get("result_available"))
    codename = row.get("codename")

    failure = None
    if state == "FAILED":
        # error_message conserva el diagnóstico interno en PostgreSQL, pero la
        # API expone solamente mensajes públicos controlados por código/etapa.
        failure = build_public_failure_payload(row)

    queue_ahead = None
    if state == "QUEUED":
        raw_queue_ahead = row.get("queue_ahead")
        queue_ahead = max(
            0,
            int(raw_queue_ahead) if raw_queue_ahead is not None else 0,
        )

    can_cancel = (
        state == "QUEUED"
        and int(row.get("owner_user_id")) == int(current_user_id)
    )

    measurement_node = None
    node_key = str(row.get("measurement_node_key") or "").strip()
    node_name = str(row.get("measurement_node_name") or "").strip()

    if node_key or node_name:
        measurement_node = {
            "nodeKey": node_key or None,
            "displayName": node_name or None,
        }

    return {
        "publicId": row.get("public_id"),
        "submissionId": row.get("submission_id"),
        "submissionTitle": row.get("submission_title"),
        "originalFilename": _original_filename(row),
        "codename": codename,
        "state": state,
        "stateVersion": int(row.get("state_version") or 0),
        "terminal": terminal,
        "benchmark": row.get("benchmark"),
        "inputSize": row.get("input_size"),
        "samples": row.get("samples"),
        "executionProfile": row.get("execution_profile"),
        "hardwareProfile": row.get("hardware_profile_name"),
        "measurementNode": measurement_node,
        "createdAt": _iso(row.get("created_at")),
        "queuedAt": _iso(row.get("queued_at")),
        "queueAhead": queue_ahead,
        "queuePosition": (
            queue_ahead + 1 if queue_ahead is not None else None
        ),
        "startedAt": _iso(row.get("started_at")),
        "processingAt": _iso(row.get("processing_at")),
        "finishedAt": _iso(row.get("finished_at")),
        "updatedAt": _iso(row.get("updated_at")),
        "durationMs": _duration_ms(row),
        "resultAvailable": result_available,
        "resultsUrl": (
            "/api/executions/{}/results".format(codename)
            if result_available and codename
            else None
        ),
        "failure": failure,
        "canCancel": can_cancel,
    }

def get_execution_snapshot_for_user(
    public_id,
    current_user_id,
    repository=execution_query_repository,
):
    row = repository.get_execution_snapshot_row(public_id)
    return build_execution_snapshot(row, current_user_id=current_user_id)
