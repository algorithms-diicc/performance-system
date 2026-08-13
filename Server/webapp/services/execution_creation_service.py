"""
CORE-04B-1 — Creación persistente de Submission + Executions.

Responsabilidad:
- validar la configuración mínima de creación;
- crear UNA submission por upload;
- crear UNA execution por archivo .cpp;
- hacerlo en una única transacción;
- devolver public_id/codename antes de que el trabajo sea encolado.

Este servicio todavía NO toca `queuelist`, Master ni Slave.
"""

import re
import uuid
from pathlib import PurePosixPath

from psycopg2.extras import RealDictCursor

from ..repositories import execution_repository
from ..repositories import submission_repository
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
            "At least one C++ source is required."
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

        if not original_filename.lower().endswith(".cpp"):
            raise InvalidExecutionRequest(
                "{} is not a .cpp source.".format(original_filename)
            )

        # La ruta dentro del ZIP puede repetirse sólo si el ZIP fuese inválido;
        # no queremos crear dos executions lógicamente indistinguibles.
        key = original_filename.casefold()
        if key in seen_names:
            raise InvalidExecutionRequest(
                "Duplicated C++ source name: {}.".format(original_filename)
            )
        seen_names.add(key)

        normalized.append({
            "original_filename": original_filename,
            "source_index": index,
        })

    return normalized


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
    compiler_flags="-O3",
    language="C++",
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
    execution_profile = infer_execution_profile(samples)

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        resolved_course_id = resolve_submission_course(
            user_id=user_id,
            requested_course_id=course_id,
            conn=db,
        )

        submission = submission_repo.create_submission(
            user_id=user_id,
            title=clean_title,
            language=language,
            file_path=archive_path,
            code_hash=archive_sha256,
            course_id=resolved_course_id,
            status="QUEUED",
            conn=db,
        )

        executions = []

        for spec in source_specs:
            codename = make_codename(benchmark)

            execution_config = {
                "compiler_flags": compiler_flags,
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
