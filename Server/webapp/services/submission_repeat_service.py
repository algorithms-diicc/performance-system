"""Descriptor read-only para repetir un Experimento histórico completo."""

from ..repositories import trace_repository
from .source_provenance_service import (
    archive_download_name,
    inspect_archive,
    require_verified_archive,
)


class SubmissionRepeatError(Exception):
    pass


class SubmissionRepeatNotFound(SubmissionRepeatError):
    pass


class SubmissionRepeatForbidden(SubmissionRepeatError):
    pass


class SubmissionRepeatConfigurationInvalid(SubmissionRepeatError):
    pass


def _normalized_configuration(row):
    benchmark = str(row.get("benchmark") or "").strip().upper()
    execution_profile = str(
        row.get("execution_profile") or ""
    ).strip().upper()

    try:
        input_size = int(row.get("input_size"))
        samples = int(row.get("samples"))
    except (TypeError, ValueError):
        raise SubmissionRepeatConfigurationInvalid(
            "El Experimento no posee una configuración común reutilizable."
        )

    if not benchmark or not execution_profile:
        raise SubmissionRepeatConfigurationInvalid(
            "El Experimento no posee una configuración común reutilizable."
        )

    return benchmark, input_size, samples, execution_profile


def build_submission_repeat_descriptor(
    archive_row,
    configuration_rows,
    *,
    current_user_id,
    archive_inspector=inspect_archive,
):
    if archive_row is None:
        raise SubmissionRepeatNotFound(
            "El Experimento solicitado no existe."
        )

    if int(archive_row.get("owner_user_id")) != int(current_user_id):
        raise SubmissionRepeatForbidden(
            "Solo el propietario puede repetir este Experimento."
        )

    # Valida existencia, referencia, SHA-256 y estructura ZIP. Los bytes no se
    # serializan: el navegador los descarga por el endpoint autenticado actual.
    require_verified_archive(archive_inspector(archive_row))

    rows = list(configuration_rows or [])
    if not rows:
        raise SubmissionRepeatConfigurationInvalid(
            "El Experimento no posee ejecuciones que puedan repetirse como conjunto."
        )

    expected = _normalized_configuration(rows[0])
    for row in rows:
        if int(row.get("owner_user_id")) != int(current_user_id):
            raise SubmissionRepeatForbidden(
                "Solo el propietario puede repetir este Experimento."
            )
        if _normalized_configuration(row) != expected:
            raise SubmissionRepeatConfigurationInvalid(
                "Las ejecuciones históricas no comparten una configuración común. Usa la reutilización individual."
            )

    benchmark, input_size, samples, execution_profile = expected
    reusable_course_id = rows[0].get("reusable_course_id")

    return {
        "sourceSubmissionId": archive_row["submission_id"],
        "archiveFilename": archive_download_name(archive_row),
        "benchmark": benchmark,
        "inputSize": input_size,
        "samples": samples,
        "executionProfile": execution_profile,
        "courseId": reusable_course_id,
        "archiveUrl": "/api/submissions/{}/archive".format(
            archive_row["submission_id"]
        ),
    }


def get_submission_repeat_for_user(
    submission_id,
    current_user_id,
    repository=trace_repository,
    archive_inspector=inspect_archive,
):
    archive_row = repository.get_submission_archive_by_id(submission_id)
    configuration_rows = (
        repository.list_submission_repeat_configurations(submission_id)
    )
    return build_submission_repeat_descriptor(
        archive_row,
        configuration_rows,
        current_user_id=current_user_id,
        archive_inspector=archive_inspector,
    )
