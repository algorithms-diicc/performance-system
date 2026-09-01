"""Dominio mínimo para protocolos experimentales de curso."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection
from .hardware_profile_service import (
    HardwareProfileError,
    configured_measurement_profile_key,
    normalize_policy_benchmark,
    normalize_policy_execution_profile,
    resolve_hardware_profile_policy,
)


PROTOCOL_BENCHMARKS = frozenset({"LCS", "CAMM", "SIZE"})
PROTOCOL_DATA_TYPES = frozenset({"CAMMR", "CAMMSO", "CAMMS"})
PROTOCOL_PROFILES = {
    "rapido": ("QUICK", 10),
    "quick": ("QUICK", 10),
    "equilibrado": ("BALANCED", 30),
    "balanced": ("BALANCED", 30),
    "exhaustivo": ("EXHAUSTIVE", 50),
    "exhaustive": ("EXHAUSTIVE", 50),
    "personalizado": ("CUSTOM", None),
    "custom": ("CUSTOM", None),
}
MAX_PROTOCOL_TITLE = 150
MAX_PROTOCOL_OBJECTIVE = 2000
MAX_PROTOCOL_INSTRUCTIONS = 5000
MAX_PROTOCOL_SAMPLES = 100


class InvalidProtocolConfiguration(ValueError):
    """Configuración de protocolo que no respeta el contrato experimental."""


class ProtocolUnavailable(ValueError):
    """El protocolo no puede utilizarse para crear una Submission."""


def _positive_int(value, field):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise InvalidProtocolConfiguration(
            "{} debe ser un número entero.".format(field)
        )

    if parsed <= 0:
        raise InvalidProtocolConfiguration(
            "{} debe ser mayor que cero.".format(field)
        )
    return parsed


def _required_text(value, field, maximum):
    normalized = str(value or "").strip()
    if not normalized:
        raise InvalidProtocolConfiguration(
            "{} es obligatorio.".format(field)
        )
    if len(normalized) > maximum:
        raise InvalidProtocolConfiguration(
            "{} no puede superar {} caracteres.".format(field, maximum)
        )
    return normalized


def _optional_text(value, field, maximum):
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > maximum:
        raise InvalidProtocolConfiguration(
            "{} no puede superar {} caracteres.".format(field, maximum)
        )
    return normalized


def normalize_protocol_configuration(data, base=None):
    """
    Valida y normaliza la configuración editable de un protocolo.

    `base` permite reutilizar la misma validación para PATCH: debe contener
    las claves de API ya normalizadas de la configuración existente.
    """
    if not isinstance(data, dict):
        raise InvalidProtocolConfiguration(
            "La configuración debe ser un objeto JSON."
        )

    allowed = {
        "title",
        "objective",
        "instructions",
        "benchmark",
        "inputSize",
        "executionProfile",
        "samples",
        "dataType",
    }
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise InvalidProtocolConfiguration(
            "Campos no permitidos: {}.".format(", ".join(unknown))
        )

    merged = dict(base or {})
    merged.update(data)

    title = _required_text(
        merged.get("title"),
        "title",
        MAX_PROTOCOL_TITLE,
    )
    objective = _required_text(
        merged.get("objective"),
        "objective",
        MAX_PROTOCOL_OBJECTIVE,
    )
    instructions = _optional_text(
        merged.get("instructions"),
        "instructions",
        MAX_PROTOCOL_INSTRUCTIONS,
    )

    benchmark = str(merged.get("benchmark") or "").strip().upper()
    if benchmark not in PROTOCOL_BENCHMARKS:
        raise InvalidProtocolConfiguration(
            "benchmark debe ser LCS, CAMM o SIZE."
        )

    # El protocolo conserva una configuración académica genérica.
    # Los límites operacionales dependen de HardwareProfilePolicy y se
    # validan separadamente contra el contrato AUTO vigente.
    input_size = _positive_int(
        merged.get("inputSize"),
        "inputSize",
    )

    raw_profile = str(
        merged.get("executionProfile") or ""
    ).strip().casefold()
    profile = PROTOCOL_PROFILES.get(raw_profile)
    if profile is None:
        raise InvalidProtocolConfiguration(
            "executionProfile no corresponde a un perfil válido."
        )

    execution_profile, fixed_samples = profile
    if fixed_samples is not None:
        raw_samples = merged.get("samples", fixed_samples)
        samples = _positive_int(raw_samples, "samples")
        if samples != fixed_samples:
            raise InvalidProtocolConfiguration(
                "El perfil seleccionado requiere {} repeticiones.".format(
                    fixed_samples
                )
            )
    else:
        samples = _positive_int(merged.get("samples"), "samples")
        if samples > MAX_PROTOCOL_SAMPLES:
            raise InvalidProtocolConfiguration(
                "samples debe estar entre 1 y {}.".format(
                    MAX_PROTOCOL_SAMPLES
                )
            )

    raw_data_type = merged.get("dataType")
    data_type = (
        str(raw_data_type or "").strip().upper()
        if raw_data_type is not None
        else ""
    )

    if benchmark == "CAMM":
        if data_type not in PROTOCOL_DATA_TYPES:
            raise InvalidProtocolConfiguration(
                "CAMM requiere dataType CAMMR, CAMMSO o CAMMS."
            )
    elif data_type:
        raise InvalidProtocolConfiguration(
            "dataType solo corresponde al benchmark CAMM."
        )
    else:
        data_type = None

    return {
        "title": title,
        "objective": objective,
        "instructions": instructions,
        "benchmark": benchmark,
        "input_size": input_size,
        "execution_profile": execution_profile,
        "samples": samples,
        "data_type": data_type,
    }


def validate_protocol_operational_policy(
    config,
    *,
    conn=None,
    policy_resolver=None,
    profile_key_resolver=None,
):
    # Valida el protocolo normalizado contra la policy AUTO vigente.
    # El protocolo no queda ligado a MeasurementNode ni persiste profile_key.
    if not isinstance(config, dict):
        raise InvalidProtocolConfiguration(
            "La configuración normalizada del protocolo es inválida."
        )

    policy_resolver = (
        policy_resolver
        or resolve_hardware_profile_policy
    )
    profile_key_resolver = (
        profile_key_resolver
        or configured_measurement_profile_key
    )

    profile_key = profile_key_resolver()

    benchmark = str(
        config.get("benchmark") or ""
    ).strip().upper()
    execution_profile = str(
        config.get("execution_profile") or ""
    ).strip().upper()
    input_size = _positive_int(
        config.get("input_size"),
        "inputSize",
    )

    policy = policy_resolver(
        profile_key,
        benchmark,
        execution_profile,
        conn=conn,
    )

    if not isinstance(policy, dict):
        raise HardwareProfileError(
            "The active measurement policy is invalid."
        )

    expected_benchmark = normalize_policy_benchmark(
        benchmark
    )
    expected_profile = (
        normalize_policy_execution_profile(
            execution_profile
        )
    )

    policy_benchmark = str(
        policy.get("benchmark") or ""
    ).strip().upper()
    policy_profile = str(
        policy.get("execution_profile") or ""
    ).strip().upper()

    if (
        policy_benchmark != expected_benchmark
        or policy_profile != expected_profile
    ):
        raise HardwareProfileError(
            "The active measurement policy does not match "
            "the protocol configuration."
        )

    try:
        minimum = int(policy["minimum_input"])
        default = int(policy["default_input"])
        recommended = int(
            policy["recommended_max_input"]
        )
        hard_max = int(policy["hard_max_input"])
        input_step = int(policy["input_step"])
        timeout = int(
            policy["operational_timeout_seconds"]
        )
    except (KeyError, TypeError, ValueError):
        raise HardwareProfileError(
            "The active measurement policy is incomplete."
        )

    if not (
        minimum > 0
        and minimum <= default
        and default <= recommended
        and recommended <= hard_max
        and input_step > 0
        and timeout > 0
    ):
        raise HardwareProfileError(
            "The active measurement policy contains invalid limits."
        )

    if policy.get("is_active") is False:
        raise HardwareProfileError(
            "The measurement policy is not active."
        )

    if input_size < minimum or input_size > hard_max:
        raise InvalidProtocolConfiguration(
            "inputSize debe estar entre {} y {} para {} "
            "con el perfil {} bajo la policy AUTO vigente.".format(
                minimum,
                hard_max,
                benchmark,
                execution_profile,
            )
        )

    return {
        "profile_key": profile_key,
        "benchmark": expected_benchmark,
        "execution_profile": expected_profile,
        "minimum_input": minimum,
        "default_input": default,
        "recommended_max_input": recommended,
        "hard_max_input": hard_max,
        "input_step": input_step,
        "operational_timeout_seconds": timeout,
        "above_recommended": (
            input_size > recommended
        ),
    }


def protocol_row_as_configuration(row):
    profile_names = {
        "QUICK": "rapido",
        "BALANCED": "equilibrado",
        "EXHAUSTIVE": "exhaustivo",
        "CUSTOM": "personalizado",
    }
    return {
        "title": row.get("title"),
        "objective": row.get("objective"),
        "instructions": row.get("instructions"),
        "benchmark": row.get("benchmark"),
        "inputSize": row.get("input_size"),
        "executionProfile": profile_names.get(
            row.get("execution_profile"),
            "personalizado",
        ),
        "samples": row.get("samples"),
        "dataType": (
            str(row.get("data_type") or "").lower() or None
        ),
    }


def resolve_submission_protocol(
    user_id,
    requested_protocol_id=None,
    requested_course_id=None,
    conn=None,
):
    """
    Resuelve la procedencia protocolar de una nueva Submission.

    Un protocol_id explícito solo es válido para un Student activo con
    membresía activa en el curso activo del protocolo, y únicamente mientras
    el protocolo permanezca publicado y activo.
    """
    if requested_protocol_id in (None, ""):
        return None

    try:
        protocol_id = int(requested_protocol_id)
    except (TypeError, ValueError):
        raise ProtocolUnavailable(
            "protocol_id debe ser un identificador positivo."
        )
    if protocol_id <= 0:
        raise ProtocolUnavailable(
            "protocol_id debe ser un identificador positivo."
        )

    course_id = None
    if requested_course_id not in (None, ""):
        try:
            course_id = int(requested_course_id)
        except (TypeError, ValueError):
            raise ProtocolUnavailable(
                "course_id debe ser un identificador positivo."
            )
        if course_id <= 0:
            raise ProtocolUnavailable(
                "course_id debe ser un identificador positivo."
            )

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.id,
                    p.course_id
                FROM experimental_protocols p
                JOIN courses c
                  ON c.id = p.course_id
                JOIN course_memberships cm
                  ON cm.course_id = c.id
                 AND cm.user_id = %s
                JOIN users u
                  ON u.id = cm.user_id
                JOIN roles r
                  ON r.id = u.role_id
                WHERE p.id = %s
                  AND p.is_active = TRUE
                  AND p.is_published = TRUE
                  AND c.is_active = TRUE
                  AND cm.is_active = TRUE
                  AND u.is_active = TRUE
                  AND LOWER(r.name) = 'student';
                """,
                (user_id, protocol_id),
            )
            row = cur.fetchone()

        if row is None:
            raise ProtocolUnavailable(
                "El protocolo no está disponible para este estudiante."
            )

        resolved_course_id = int(row["course_id"])
        if (
            course_id is not None
            and course_id != resolved_course_id
        ):
            raise ProtocolUnavailable(
                "El curso seleccionado no corresponde al protocolo."
            )

        return {
            "protocol_id": int(row["id"]),
            "course_id": resolved_course_id,
        }
    finally:
        if owns_connection:
            db.close()
