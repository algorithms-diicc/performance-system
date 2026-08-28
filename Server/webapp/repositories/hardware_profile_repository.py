"""Acceso persistente a perfiles de hardware y sus políticas operacionales."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


def get_hardware_profile_by_key(profile_key, conn=None):
    """Obtiene un HardwareProfile por su identidad estable."""
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    id,
                    profile_key,
                    name,
                    cpu_vendor,
                    cpu_model,
                    architecture,
                    logical_cpus,
                    ram_gb,
                    capabilities,
                    description,
                    is_active,
                    created_at,
                    updated_at
                FROM hardware_profiles
                WHERE profile_key = %s
                LIMIT 1;
                """,
                (profile_key,),
            )
            row = cur.fetchone()

        return dict(row) if row is not None else None

    finally:
        if owns_connection:
            db.close()


def get_active_policy(
    hardware_profile_id,
    benchmark,
    execution_profile,
    conn=None,
):
    """
    Obtiene la política operacional activa para la combinación exacta
    HardwareProfile + benchmark + execution profile.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.id,
                    p.hardware_profile_id,
                    p.benchmark,
                    p.execution_profile,
                    p.minimum_input,
                    p.default_input,
                    p.recommended_max_input,
                    p.hard_max_input,
                    p.input_step,
                    p.operational_timeout_seconds,
                    p.is_active,
                    p.created_at,
                    p.updated_at
                FROM hardware_profile_policies p
                JOIN hardware_profiles hp
                  ON hp.id = p.hardware_profile_id
                WHERE p.hardware_profile_id = %s
                  AND p.benchmark = %s
                  AND p.execution_profile = %s
                  AND p.is_active = TRUE
                  AND hp.is_active = TRUE
                LIMIT 1;
                """,
                (
                    hardware_profile_id,
                    benchmark,
                    execution_profile,
                ),
            )
            row = cur.fetchone()

        return dict(row) if row is not None else None

    finally:
        if owns_connection:
            db.close()


def upsert_hardware_profile(
    profile_key,
    name,
    cpu_vendor=None,
    cpu_model=None,
    architecture=None,
    logical_cpus=None,
    ram_gb=None,
    capabilities=None,
    description=None,
    is_active=True,
    conn=None,
):
    """
    Crea o actualiza un HardwareProfile por su identidad estable profile_key.

    El profile_key identifica una configuración operativa conocida; no se
    deriva automáticamente de un ranking o potencia de CPU.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO hardware_profiles (
                    profile_key,
                    name,
                    cpu_vendor,
                    cpu_model,
                    architecture,
                    logical_cpus,
                    ram_gb,
                    capabilities,
                    description,
                    is_active,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s::jsonb, %s, %s,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (profile_key)
                WHERE profile_key IS NOT NULL
                DO UPDATE SET
                    name = EXCLUDED.name,
                    cpu_vendor = EXCLUDED.cpu_vendor,
                    cpu_model = EXCLUDED.cpu_model,
                    architecture = EXCLUDED.architecture,
                    logical_cpus = EXCLUDED.logical_cpus,
                    ram_gb = EXCLUDED.ram_gb,
                    capabilities = EXCLUDED.capabilities,
                    description = EXCLUDED.description,
                    is_active = EXCLUDED.is_active,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING
                    id,
                    profile_key,
                    name,
                    cpu_vendor,
                    cpu_model,
                    architecture,
                    logical_cpus,
                    ram_gb,
                    capabilities,
                    description,
                    is_active,
                    created_at,
                    updated_at
                """,
                (
                    profile_key,
                    name,
                    cpu_vendor,
                    cpu_model,
                    architecture,
                    logical_cpus,
                    ram_gb,
                    capabilities,
                    description,
                    is_active,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return row

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def upsert_hardware_profile_policy(
    hardware_profile_id,
    benchmark,
    execution_profile,
    minimum_input,
    default_input,
    recommended_max_input,
    hard_max_input,
    input_step,
    operational_timeout_seconds,
    is_active=True,
    conn=None,
):
    """
    Crea o actualiza una política operacional para una combinación
    HardwareProfile + familia de benchmark + execution_profile.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO hardware_profile_policies (
                    hardware_profile_id,
                    benchmark,
                    execution_profile,
                    minimum_input,
                    default_input,
                    recommended_max_input,
                    hard_max_input,
                    input_step,
                    operational_timeout_seconds,
                    is_active,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (
                    hardware_profile_id,
                    benchmark,
                    execution_profile
                )
                DO UPDATE SET
                    minimum_input = EXCLUDED.minimum_input,
                    default_input = EXCLUDED.default_input,
                    recommended_max_input =
                        EXCLUDED.recommended_max_input,
                    hard_max_input = EXCLUDED.hard_max_input,
                    input_step = EXCLUDED.input_step,
                    operational_timeout_seconds =
                        EXCLUDED.operational_timeout_seconds,
                    is_active = EXCLUDED.is_active,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING
                    id,
                    hardware_profile_id,
                    benchmark,
                    execution_profile,
                    minimum_input,
                    default_input,
                    recommended_max_input,
                    hard_max_input,
                    input_step,
                    operational_timeout_seconds,
                    is_active,
                    created_at,
                    updated_at
                """,
                (
                    hardware_profile_id,
                    benchmark,
                    execution_profile,
                    minimum_input,
                    default_input,
                    recommended_max_input,
                    hard_max_input,
                    input_step,
                    operational_timeout_seconds,
                    is_active,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return row

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def get_active_hardware_profile_policy(
    profile_key,
    benchmark,
    execution_profile,
    conn=None,
):
    """
    Obtiene una política operacional activa mediante la identidad estable
    del HardwareProfile.

    Esta consulta no selecciona nodos ni realiza ranking de hardware.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.id,
                    p.hardware_profile_id,
                    hp.profile_key,
                    hp.name AS hardware_profile_name,
                    p.benchmark,
                    p.execution_profile,
                    p.minimum_input,
                    p.default_input,
                    p.recommended_max_input,
                    p.hard_max_input,
                    p.input_step,
                    p.operational_timeout_seconds,
                    p.is_active,
                    p.created_at,
                    p.updated_at
                FROM hardware_profile_policies p
                JOIN hardware_profiles hp
                  ON hp.id = p.hardware_profile_id
                WHERE hp.profile_key = %s
                  AND hp.is_active = TRUE
                  AND p.benchmark = %s
                  AND p.execution_profile = %s
                  AND p.is_active = TRUE
                LIMIT 1
                """,
                (
                    profile_key,
                    benchmark,
                    execution_profile,
                ),
            )
            return cur.fetchone()

    finally:
        if owns_connection:
            db.close()


def list_active_hardware_profile_policies(
    profile_key,
    conn=None,
):
    """
    Lista las políticas activas de un HardwareProfile activo.

    El orden es estable para producir contratos API deterministas.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    p.id,
                    p.hardware_profile_id,
                    hp.profile_key,
                    hp.name AS hardware_profile_name,
                    p.benchmark,
                    p.execution_profile,
                    p.minimum_input,
                    p.default_input,
                    p.recommended_max_input,
                    p.hard_max_input,
                    p.input_step,
                    p.operational_timeout_seconds,
                    p.is_active,
                    p.created_at,
                    p.updated_at
                FROM hardware_profile_policies p
                JOIN hardware_profiles hp
                  ON hp.id = p.hardware_profile_id
                WHERE hp.profile_key = %s
                  AND hp.is_active = TRUE
                  AND p.is_active = TRUE
                ORDER BY
                    CASE p.benchmark
                        WHEN 'LCS' THEN 1
                        WHEN 'CAMM' THEN 2
                        WHEN 'SIZE' THEN 3
                        ELSE 99
                    END,
                    CASE p.execution_profile
                        WHEN 'QUICK' THEN 1
                        WHEN 'BALANCED' THEN 2
                        WHEN 'EXHAUSTIVE' THEN 3
                        WHEN 'CUSTOM' THEN 4
                        ELSE 99
                    END,
                    p.id
                """,
                (profile_key,),
            )
            return cur.fetchall()

    finally:
        if owns_connection:
            db.close()
