"""
CORE-04B-1 — Creación persistente de Submission + Executions.

Responsabilidad:
- validar la configuración mínima de creación;
- crear UNA submission por upload;
- crear UNA execution por fuente .c/.cpp;
- hacerlo en una única transacción;
- devolver public_id/codename antes de que el trabajo sea encolado.

Este servicio todavía NO toca `queuelist`, Master ni Slave.
"""

import hashlib
from pathlib import Path, PurePosixPath
import re
import uuid
import zipfile

from psycopg2.extras import RealDictCursor

from ...source_contract import (
    CANONICAL_COMPILER_FLAGS,
    LANGUAGE_C,
    LANGUAGE_CPP,
    SOURCE_CONTRACT_VERSION,
    SourceContractError,
    enumerate_source_members,
    infer_v2_source_metadata,
)
from ..repositories import execution_repository
from ..repositories import submission_repository
from .upload_service import (
    UploadValidationError,
    normalize_original_zip_filename,
)
from .experimental_protocol_service import (
    ProtocolUnavailable,
    resolve_submission_protocol,
)
from ...db_connection import get_connection


ALLOWED_BENCHMARKS = frozenset({
    "CAMM",
    "CAMMR",
    "CAMMS",
    "CAMMSO",
    "LCS",
    "SIZE",
})

PROFILE_BY_SAMPLES = {
    10: "QUICK",
    30: "BALANCED",
    50: "EXHAUSTIVE",
}

INPUT_LIMITS_BY_BENCHMARK = {
    "LCS": (100, 50000),
    "CAMM": (1000, 150000),
    "CAMMR": (1000, 150000),
    "CAMMS": (1000, 150000),
    "CAMMSO": (1000, 150000),
    "SIZE": (100, 100000),
}
MAX_SAMPLES = 100
MAX_SUBMISSION_TITLE_CHARS = 255
MAX_SUBMISSION_NOTE_CHARS = 500
MAX_SOURCE_NAME_CHARS = 512


# CORE-06D-4
# Protocolo final de muestreo del dominio de entrada.
# Diez puntos equilibran lectura de tendencia y costo experimental.
# Las repeticiones por punto siguen determinadas por QUICK/BALANCED/EXHAUSTIVE.
DEFAULT_MEASUREMENT_POINTS = 10
DEFAULT_WARMUP_ROUNDS = 1
DEFAULT_PERF_SCOPE = "process"
DEFAULT_SINGLE_EVENT_FALLBACK = True


def build_measurement_snapshot(samples):
    # Snapshot reproducible del protocolo de medición.
    return {
        "schema_version": "1.0",
        "points": DEFAULT_MEASUREMENT_POINTS,
        "samples_per_point": int(samples),
        "warmup_rounds": DEFAULT_WARMUP_ROUNDS,
        "perf_scope": DEFAULT_PERF_SCOPE,
        "single_event_fallback": DEFAULT_SINGLE_EVENT_FALLBACK,
    }


class ExecutionCreationError(Exception):
    """Error base del servicio de creación."""


class InvalidExecutionRequest(ExecutionCreationError):
    """La configuración recibida no puede convertirse en una ejecución."""


def normalize_submission_note(value):
    """Normaliza la nota opcional antes de entregarla al repository."""
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized:
        return None

    if len(normalized) > MAX_SUBMISSION_NOTE_CHARS:
        raise InvalidExecutionRequest(
            "note must contain at most {} characters.".format(
                MAX_SUBMISSION_NOTE_CHARS
            )
        )

    return normalized


def normalize_submission_original_filename(value):
    """Normaliza el nombre del ZIP sin hacerlo obligatorio para llamadores legacy."""
    if value is None or not str(value).strip():
        return None

    try:
        return normalize_original_zip_filename(value)
    except UploadValidationError as exc:
        raise InvalidExecutionRequest(str(exc))


def _positive_int(value, field):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise InvalidExecutionRequest(
            "{} must be an integer.".format(field)
        )

    if parsed <= 0:
        raise InvalidExecutionRequest(
            "{} must be greater than zero.".format(field)
        )

    return parsed


def normalize_benchmark(value):
    benchmark = str(value or "").strip().upper()
    if benchmark not in ALLOWED_BENCHMARKS:
        raise InvalidExecutionRequest(
            "Unsupported benchmark/task_type: {!r}.".format(value)
        )
    return benchmark


def validate_execution_limits(benchmark, input_size, samples):
    minimum, maximum = INPUT_LIMITS_BY_BENCHMARK[benchmark]
    if input_size < minimum or input_size > maximum:
        raise InvalidExecutionRequest(
            "input_size must be between {} and {} for {}.".format(
                minimum,
                maximum,
                benchmark,
            )
        )
    if samples > MAX_SAMPLES:
        raise InvalidExecutionRequest(
            "samples must be between 1 and {}.".format(MAX_SAMPLES)
        )


def infer_execution_profile(samples):
    return PROFILE_BY_SAMPLES.get(samples, "CUSTOM")




def resolve_submission_course(user_id, requested_course_id=None, conn=None):
    """
    Resuelve el contexto académico de una nueva submission.

    Reglas:
    - course_id explícito: debe ser un curso ACTIVO donde el usuario tenga
      membresía ACTIVA.
    - sin course_id:
        * 0 cursos activos -> None (compatibilidad/no curso);
        * 1 curso activo   -> se asigna automáticamente;
        * 2+ cursos        -> se exige selección explícita.
    """
    if not user_id:
        raise InvalidExecutionRequest("user_id is required.")

    parsed_course_id = None
    if requested_course_id not in (None, ""):
        parsed_course_id = _positive_int(
            requested_course_id,
            "course_id",
        )

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            if parsed_course_id is not None:
                cur.execute(
                    """
                    SELECT
                        c.id,
                        c.code,
                        c.name,
                        c.academic_year,
                        c.academic_term
                    FROM course_memberships cm
                    JOIN courses c
                      ON c.id = cm.course_id
                    WHERE cm.user_id = %s
                      AND cm.course_id = %s
                      AND cm.is_active = TRUE
                      AND c.is_active = TRUE;
                    """,
                    (user_id, parsed_course_id),
                )
                row = cur.fetchone()
                if row is None:
                    raise InvalidExecutionRequest(
                        "El curso seleccionado no está activo o el usuario "
                        "no pertenece actualmente a él."
                    )
                return int(row["id"])

            cur.execute(
                """
                SELECT
                    c.id,
                    c.code,
                    c.name,
                    c.academic_year,
                    c.academic_term
                FROM course_memberships cm
                JOIN courses c
                  ON c.id = cm.course_id
                WHERE cm.user_id = %s
                  AND cm.is_active = TRUE
                  AND c.is_active = TRUE
                ORDER BY
                    c.academic_year DESC,
                    c.academic_term DESC,
                    c.code,
                    c.id;
                """,
                (user_id,),
            )
            rows = cur.fetchall()

        if not rows:
            return None

        if len(rows) == 1:
            return int(rows[0]["id"])

        raise InvalidExecutionRequest(
            "Tienes más de un curso activo. Selecciona el curso "
            "correspondiente antes de crear la entrega."
        )

    finally:
        if owns_connection:
            db.close()


def make_codename(benchmark):
    """
    Identificador técnico no expuesto como ID principal.

    Se usa UUID4 en vez de random.randint para reducir colisiones y mantener
    independencia respecto del public_id generado por PostgreSQL.
    """
    return "{}{}".format(uuid.uuid4().hex, benchmark)


def validate_source_specs(source_specs):
    if not isinstance(source_specs, (list, tuple)) or not source_specs:
        raise InvalidExecutionRequest(
            "At least one C/C++ source is required."
        )

    normalized = []
    seen_names = set()

    for index, spec in enumerate(source_specs):
        if not isinstance(spec, dict):
            raise InvalidExecutionRequest(
                "source_specs[{}] must be an object.".format(index)
            )

        original_filename = str(
            spec.get("original_filename") or ""
        ).strip()

        if not original_filename:
            raise InvalidExecutionRequest(
                "source_specs[{}].original_filename is required.".format(index)
            )

        if len(original_filename) > MAX_SOURCE_NAME_CHARS:
            raise InvalidExecutionRequest(
                "source_specs[{}].original_filename is too long.".format(index)
            )

        original_filename = original_filename.replace("\\", "/")
        source_path = PurePosixPath(original_filename)
        if (
            "\x00" in original_filename
            or source_path.is_absolute()
            or ".." in source_path.parts
            or (source_path.parts and ":" in source_path.parts[0])
        ):
            raise InvalidExecutionRequest(
                "source_specs[{}].original_filename is unsafe.".format(index)
            )

        try:
            source_metadata = infer_v2_source_metadata(original_filename)
        except SourceContractError:
            raise InvalidExecutionRequest(
                "{} is not a supported .c/.cpp source.".format(
                    original_filename
                )
            )

        # La ruta dentro del ZIP puede repetirse sólo si el ZIP fuese inválido;
        # no queremos crear dos executions lógicamente indistinguibles.
        key = original_filename.casefold()
        if key in seen_names:
            raise InvalidExecutionRequest(
                "Duplicated C/C++ source name: {}.".format(
                    original_filename
                )
            )
        seen_names.add(key)

        normalized.append(
            {
                "original_filename": original_filename,
                "source_index": index,
                **source_metadata.execution_config_fields(),
            }
        )

    return normalized


def derive_submission_language(source_specs):
    """Deriva el agregado visible sin intervenir en la selección runtime."""
    languages = {
        spec.get("source_language")
        for spec in source_specs
    }
    if languages == {LANGUAGE_C}:
        return LANGUAGE_C
    if languages == {LANGUAGE_CPP}:
        return LANGUAGE_CPP
    if languages == {LANGUAGE_C, LANGUAGE_CPP}:
        return "C/C++"
    raise InvalidExecutionRequest(
        "Source languages do not match the closed C/C++ contract."
    )


def _sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_v2_source_indices(
    source_specs,
    archive_path,
    archive_sha256,
):
    """Alinea índices v2 con el orden combinado real del ZIP persistido."""
    filesystem_path = Path(archive_path)
    if not filesystem_path.is_absolute():
        server_root = Path(__file__).resolve().parents[2]
        filesystem_path = server_root / filesystem_path

    # Mantiene los llamadores unitarios/legacy que usan repositorios fake sin
    # artefacto físico. El camino público siempre llega desde un ZIP ya guardado.
    if not filesystem_path.is_file():
        return source_specs

    if _sha256_file(filesystem_path) != archive_sha256:
        raise InvalidExecutionRequest(
            "The persisted archive does not match archive_sha256."
        )

    try:
        with zipfile.ZipFile(str(filesystem_path), "r") as archive:
            supported_members = enumerate_source_members(
                archive.infolist(),
                SOURCE_CONTRACT_VERSION,
            )
    except (
        OSError,
        RuntimeError,
        ValueError,
        zipfile.BadZipFile,
        zipfile.LargeZipFile,
    ):
        raise InvalidExecutionRequest(
            "The persisted archive is not a valid ZIP."
        )

    index_by_name = {}
    seen_names = set()
    for index, info in enumerate(supported_members):
        normalized_name = str(info.filename or "").replace("\\", "/")
        key = normalized_name.casefold()
        if key in seen_names:
            raise InvalidExecutionRequest(
                "Duplicated C/C++ source name: {}.".format(
                    normalized_name
                )
            )
        seen_names.add(key)
        index_by_name[normalized_name] = index

    resolved = []
    for spec in source_specs:
        filename = spec["original_filename"]
        if filename not in index_by_name:
            raise InvalidExecutionRequest(
                "{} does not exist in the persisted archive.".format(
                    filename
                )
            )
        resolved.append(
            {
                **spec,
                "source_index": index_by_name[filename],
            }
        )
    return resolved


def create_submission_bundle(
    *,
    user_id,
    title,
    archive_path,
    archive_sha256,
    benchmark,
    input_size,
    samples,
    source_specs,
    course_id=None,
    protocol_id=None,
    original_filename=None,
    note=None,
    compiler_flags="-O3",
    language=None,
    conn=None,
    submission_repo=submission_repository,
    execution_repo=execution_repository,
):
    """
    Crea la unidad persistente correspondiente a un upload.

    Devuelve:
      {
        "submission": {...},
        "executions": [...]
      }

    Si cualquier INSERT falla, toda la unidad se revierte.
    """
    if not user_id:
        raise InvalidExecutionRequest("user_id is required.")

    clean_title = str(title or "").strip()
    if not clean_title:
        raise InvalidExecutionRequest("title is required.")
    if len(clean_title) > MAX_SUBMISSION_TITLE_CHARS:
        raise InvalidExecutionRequest(
            "title must contain at most {} characters.".format(
                MAX_SUBMISSION_TITLE_CHARS
            )
        )

    archive_path = str(archive_path or "").strip()
    if not archive_path:
        raise InvalidExecutionRequest("archive_path is required.")

    archive_sha256 = str(archive_sha256 or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", archive_sha256):
        raise InvalidExecutionRequest(
            "archive_sha256 must be a 64-character hexadecimal SHA-256."
        )

    benchmark = normalize_benchmark(benchmark)
    input_size = _positive_int(input_size, "input_size")
    samples = _positive_int(samples, "samples")
    validate_execution_limits(benchmark, input_size, samples)
    source_specs = validate_source_specs(source_specs)
    submission_language = derive_submission_language(source_specs)
    if (
        language not in (None, "")
        and str(language).strip() != submission_language
    ):
        raise InvalidExecutionRequest(
            "Submission language must match the derived C/C++ aggregate."
        )
    if str(compiler_flags or "").strip() != CANONICAL_COMPILER_FLAGS:
        raise InvalidExecutionRequest(
            "Only the canonical -O3 compiler flags are accepted."
        )
    source_specs = _resolve_v2_source_indices(
        source_specs,
        archive_path,
        archive_sha256,
    )
    execution_profile = infer_execution_profile(samples)
    original_filename = normalize_submission_original_filename(
        original_filename
    )
    note = normalize_submission_note(note)

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        try:
            resolved_protocol = resolve_submission_protocol(
                user_id=user_id,
                requested_protocol_id=protocol_id,
                requested_course_id=course_id,
                conn=db,
            )
        except ProtocolUnavailable as exc:
            raise InvalidExecutionRequest(str(exc))

        if resolved_protocol is not None:
            resolved_protocol_id = resolved_protocol["protocol_id"]
            resolved_course_id = resolved_protocol["course_id"]
        else:
            resolved_protocol_id = None
            resolved_course_id = resolve_submission_course(
                user_id=user_id,
                requested_course_id=course_id,
                conn=db,
            )

        submission = submission_repo.create_submission(
            user_id=user_id,
            title=clean_title,
            language=submission_language,
            file_path=archive_path,
            original_filename=original_filename,
            code_hash=archive_sha256,
            note=note,
            course_id=resolved_course_id,
            protocol_id=resolved_protocol_id,
            status="QUEUED",
            conn=db,
        )

        executions = []

        for spec in source_specs:
            codename = make_codename(benchmark)

            execution_config = {
                "source_contract_version": spec[
                    "source_contract_version"
                ],
                "source_language": spec["source_language"],
                "compiler": spec["compiler"],
                "compiler_flags": spec["compiler_flags"],
                "original_filename": spec["original_filename"],
                "source_index": spec["source_index"],
                "archive_sha256": archive_sha256,
                "course_id": resolved_course_id,
                "measurement": build_measurement_snapshot(samples),
            }

            row = execution_repo.create_execution(
                submission_id=submission["id"],
                codename=codename,
                benchmark=benchmark,
                input_size=input_size,
                samples=samples,
                execution_profile=execution_profile,
                execution_config=execution_config,
                hardware_snapshot={},
                hardware_profile_id=None,
                idempotency_key=None,
                conn=db,
            )
            executions.append(row)

        if owns_connection:
            db.commit()

        return {
            "submission": submission,
            "executions": executions,
        }

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()
