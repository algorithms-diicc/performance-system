"""Descriptor seguro para reutilizar la configuración de una Execution.

La reutilización nunca muta la Submission/Execution histórica ni expone código,
resultados, métricas o snapshots internos. Solo devuelve parámetros necesarios
para precargar un nuevo análisis.
"""

from ..repositories import execution_query_repository


class ExecutionReuseError(Exception):
    pass


class ExecutionReuseNotFound(ExecutionReuseError):
    pass


class ExecutionReuseForbidden(ExecutionReuseError):
    pass


def build_execution_reuse_descriptor(row, current_user_id):
    if row is None:
        raise ExecutionReuseNotFound(
            "La ejecución solicitada no existe."
        )

    if int(row.get("owner_user_id")) != int(current_user_id):
        raise ExecutionReuseForbidden(
            "No tienes permiso para reutilizar esta ejecución."
        )

    benchmark = str(row.get("benchmark") or "").strip().upper()
    execution_profile = str(
        row.get("execution_profile") or ""
    ).strip().upper()

    return {
        "sourcePublicId": row.get("public_id"),
        "benchmark": benchmark or None,
        "inputSize": row.get("input_size"),
        "samples": row.get("samples"),
        "executionProfile": execution_profile or None,
        "courseId": row.get("reusable_course_id"),
    }


def get_execution_reuse_for_user(
    public_id,
    current_user_id,
    repository=execution_query_repository,
):
    row = repository.get_execution_reuse_row(public_id)
    return build_execution_reuse_descriptor(
        row,
        current_user_id=current_user_id,
    )
