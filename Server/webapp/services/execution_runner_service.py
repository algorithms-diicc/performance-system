"""
Iteración 9 — runner canónico de una sola Execution.

Responsabilidades:
- preparar la señal técnica legacy para el slave;
- ejecutar una única medición;
- persistir RUNNING -> PROCESSING -> COMPLETED/FAILED;
- post-procesar artefactos de esa Execution;
- sincronizar `submissions.status` sólo cuando todas sus executions terminan.
"""

import os
import time

from ..dataProcessing import graph_results
from ..repositories import execution_repository
from ..repositories import submission_repository
from ..socketUtils import escribir_estado
from ..socketUtils import slave_serve
from .execution_pipeline_service import (
    execution_result_path,
    read_legacy_outcome,
    result_bundle_exists,
)
from .worker_execution_service import (
    activate_claimed_execution,
    mark_processing_failed,
    mark_worker_completed,
    mark_worker_failed,
    mark_worker_started,
    persist_worker_outcome,
)


def _write_status_signal(path, value):
    os.makedirs(
        os.path.dirname(path),
        exist_ok=True,
    )
    with open(
        path,
        "w",
        encoding="utf-8",
        newline="\n",
    ) as handle:
        handle.write(value)


def run_single_execution(
    *,
    source_path,
    codename,
    original_filename,
    input_size,
    samples,
    status_dir,
    static_dir,
    base_dir,
    opt_cmd="-O3",
    already_claimed=False,
    public_id=None,
    max_wait_seconds=None,
    slave_serve_func=slave_serve,
    status_writer_func=escribir_estado,
    read_legacy_outcome_func=read_legacy_outcome,
    mark_worker_started_func=mark_worker_started,
    activate_claimed_execution_func=activate_claimed_execution,
    mark_worker_failed_func=mark_worker_failed,
    persist_worker_outcome_func=persist_worker_outcome,
    graph_results_func=graph_results,
    result_bundle_exists_func=result_bundle_exists,
    execution_result_path_func=execution_result_path,
    mark_processing_failed_func=mark_processing_failed,
    mark_worker_completed_func=mark_worker_completed,
):
    """
    Ejecuta y post-procesa exactamente una Execution.

    `already_claimed=False` conserva el flujo legacy QUEUED -> RUNNING.
    `already_claimed=True` se usa por el dispatcher persistente: el claim
    PostgreSQL ya hizo QUEUED -> RUNNING y sólo se activa el heartbeat.
    """
    if already_claimed and not public_id:
        raise ValueError(
            "public_id es obligatorio para una execution ya reclamada."
        )

    max_wait = (
        int(os.getenv("MASTER_EXECUTION_TIMEOUT_SECONDS", "2000"))
        if max_wait_seconds is None
        else max(1, int(max_wait_seconds))
    )

    status_file_path = os.path.join(
        status_dir,
        codename,
    )

    # El slave legacy detecta trabajo mediante una señal IN QUEUE reciente.
    _write_status_signal(
        status_file_path,
        "IN QUEUE",
    )
    os.utime(status_file_path, None)

    if already_claimed:
        activate_claimed_execution_func(
            codename,
            public_id,
        )
    else:
        mark_worker_started_func(codename)

    try:
        slave_serve_func(
            source_path,
            codename,
            opt_cmd,
            input_size,
            samples,
        )
    except Exception as exc:
        message = (
            "Fallo en la comunicación Master/Slave: {}".format(exc)
        )

        try:
            _write_status_signal(
                status_file_path,
                "ERROR: master/slave communication failure",
            )
        except OSError:
            pass

        failed = mark_worker_failed_func(
            codename,
            failure_stage="INFRASTRUCTURE",
            error_code="MASTER_SLAVE_ERROR",
            error_message=message,
        )
        status_writer_func(
            codename,
            "❌ {}".format(message),
            tipo="ERROR",
        )
        return failed

    print(
        "⏳ Esperando que finalice la ejecución de {}...".format(
            codename
        )
    )

    waited = 0
    outcome = read_legacy_outcome_func(
        codename,
        status_dir,
        static_dir,
    )

    while outcome.kind not in ("SUCCESS", "FAILED"):
        time.sleep(2)
        waited += 2

        if waited >= max_wait:
            _write_status_signal(
                status_file_path,
                "ERROR: timeout exceeded",
            )
            status_writer_func(
                codename,
                (
                    "❌ ERROR DETECTADO: se agotó el tiempo máximo "
                    "de espera del Master."
                ),
                tipo="ERROR",
            )

        outcome = read_legacy_outcome_func(
            codename,
            status_dir,
            static_dir,
        )

        if waited >= max_wait:
            break

    print(
        "✅ Finalizado pipeline worker: {} → {}".format(
            codename,
            outcome.status_text,
        )
    )

    persisted = persist_worker_outcome_func(
        codename,
        outcome,
    )

    if persisted["execution_state"] != "PROCESSING":
        return persisted

    status_writer_func(
        codename,
        "📊 Generando gráficos...",
    )

    try:
        graph_results_func(
            [codename],
            [original_filename],
            input_size,
        )
    except Exception as exc:
        message = "Falló graph_results: {}".format(exc)
        failed = mark_processing_failed_func(
            codename,
            error_code="GRAPH_PROCESSING_ERROR",
            error_message=message,
        )
        status_writer_func(
            codename,
            "❌ {}".format(message),
            tipo="ERROR",
        )
        return failed

    if not result_bundle_exists_func(
        [codename],
        static_dir,
    ):
        message = (
            "El post-procesamiento terminó sin producir "
            "CombinedResults.csv para la ejecución."
        )
        failed = mark_processing_failed_func(
            codename,
            error_code="RESULT_ARTIFACT_MISSING",
            error_message=message,
        )
        status_writer_func(
            codename,
            "❌ {}".format(message),
            tipo="ERROR",
        )
        return failed

    absolute_result_path = execution_result_path_func(
        codename,
        static_dir,
    )
    persisted_result_path = os.path.relpath(
        absolute_result_path,
        base_dir,
    )

    completed = mark_worker_completed_func(
        codename,
        result_path=persisted_result_path,
    )
    status_writer_func(
        codename,
        "✅ Resultados listos.",
    )
    print(
        "💾 PostgreSQL: {} → {} (v{})".format(
            codename,
            completed["execution_state"],
            completed["state_version"],
        )
    )
    return completed


def legacy_submission_status_from_counts(counts):
    counts = counts or {}
    total = int(counts.get("total") or 0)
    active = sum(
        int(counts.get(name) or 0)
        for name in ("queued", "running", "processing")
    )
    completed = int(counts.get("completed") or 0)

    if total <= 0 or active > 0:
        return None

    if completed == total:
        return "finished"

    return "ERROR"


def sync_submission_terminal_status(
    submission_id,
    execution_repo=execution_repository,
    submission_repo=submission_repository,
):
    """
    Actualiza el status legacy sólo cuando todas las executions son terminales.
    """
    counts = execution_repo.summarize_submission_execution_states(
        submission_id
    )
    target = legacy_submission_status_from_counts(
        counts
    )

    if target is None:
        return {
            "updated": False,
            "status": None,
            "counts": counts,
        }

    submission = submission_repo.update_submission_status(
        submission_id,
        target,
    )
    return {
        "updated": True,
        "status": target,
        "counts": counts,
        "submission": submission,
    }
