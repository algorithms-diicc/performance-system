"""
CORE-04A-3 — Repository de executions.

Responsabilidades:
- Centralizar acceso SQL a la tabla executions.
- Aplicar actualizaciones de estado con optimistic concurrency (`state_version`).
- Mantener temporalmente `status` legacy sincronizado.
- Permitir que tests/servicios inyecten una conexión y controlen la transacción.

Este módulo NO decide si una transición de negocio es válida. Esa responsabilidad
pertenece a execution_state_service.py.
"""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


class ExecutionRepositoryError(Exception):
    """Error base del repository."""


class ExecutionNotFound(ExecutionRepositoryError):
    """La ejecución solicitada no existe."""


class ConcurrentExecutionUpdate(ExecutionRepositoryError):
    """La fila cambió entre lectura y actualización."""


def _legacy_status_for(new_state, error_code=None):
    """
    Traduce el estado canónico al campo legacy `status`.

    Se mantiene únicamente mientras profile/admin/submissions_routes continúan
    consumiendo executions.status.
    """
    if new_state == "QUEUED":
        return "pending"
    if new_state == "RUNNING":
        return "running"
    if new_state == "PROCESSING":
        return "processing"
    if new_state == "COMPLETED":
        return "ok"
    if new_state == "CANCELLED":
        return "cancelled"
    if new_state == "FAILED":
        if error_code == "TIMEOUT":
            return "timeout"
        return "runtime_error"
    return None



def create_execution(
    submission_id,
    codename,
    benchmark,
    input_size,
    samples,
    execution_profile,
    execution_config,
    hardware_snapshot=None,
    hardware_profile_id=None,
    idempotency_key=None,
    conn=None,
):
    """
    Crea una ejecución persistente en QUEUED.

    La asignación real de hardware ocurre más adelante, por lo que
    hardware_profile_id puede ser NULL y hardware_snapshot puede comenzar vacío.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    hardware_snapshot = hardware_snapshot or {}

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO executions (
                    submission_id,
                    hardware_profile_id,
                    public_id,
                    codename,
                    execution_state,
                    status,
                    queued_at,
                    benchmark,
                    input_size,
                    samples,
                    execution_profile,
                    execution_config,
                    hardware_snapshot,
                    result_available,
                    idempotency_key,
                    state_version
                )
                VALUES (
                    %s,
                    %s,
                    gen_random_uuid(),
                    %s,
                    'QUEUED',
                    'pending',
                    CURRENT_TIMESTAMP,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s::jsonb,
                    %s::jsonb,
                    FALSE,
                    %s,
                    0
                )
                RETURNING
                    id,
                    public_id::text AS public_id,
                    submission_id,
                    hardware_profile_id,
                    codename,
                    execution_state,
                    created_at,
                    queued_at,
                    benchmark,
                    input_size,
                    samples,
                    execution_profile,
                    execution_config,
                    hardware_snapshot,
                    result_available,
                    idempotency_key::text AS idempotency_key,
                    state_version,
                    status;
                """,
                (
                    submission_id,
                    hardware_profile_id,
                    codename,
                    benchmark,
                    input_size,
                    samples,
                    execution_profile,
                    __import__("json").dumps(execution_config),
                    __import__("json").dumps(hardware_snapshot),
                    str(idempotency_key) if idempotency_key else None,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def get_execution(public_id, conn=None, for_update=False):
    """
    Obtiene una ejecución por public_id.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        lock_clause = " FOR UPDATE" if for_update else ""
        query = """
            SELECT
                e.id,
                e.public_id::text AS public_id,
                e.submission_id,
                e.hardware_profile_id,
                e.codename,
                e.execution_state,
                e.failure_stage,
                e.error_code,
                e.error_message,
                e.created_at,
                e.queued_at,
                e.started_at,
                e.processing_at,
                e.finished_at,
                e.updated_at,
                e.last_heartbeat_at,
                e.benchmark,
                e.input_size,
                e.samples,
                e.execution_profile,
                e.execution_config,
                e.hardware_snapshot,
                e.result_available,
                e.result_path,
                e.idempotency_key::text AS idempotency_key,
                e.state_version,
                e.status,
                e.slave_id,
                e.duration_ms,
                e.log_path
            FROM executions e
            WHERE e.public_id = %s::uuid
        """ + lock_clause + ";"

        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (str(public_id),))
            row = cur.fetchone()

        if row is None:
            raise ExecutionNotFound(
                "Execution with public_id={} was not found.".format(public_id)
            )

        return dict(row)

    finally:
        if owns_connection:
            db.close()



def get_execution_by_codename(codename, conn=None):
    """
    Obtiene una execution por su identificador técnico de artefacto.

    codename es UNIQUE para ejecuciones nuevas y enlaza temporalmente
    el pipeline legacy con public_id sin cambiar el protocolo Master/Slave.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.id,
                    e.public_id::text AS public_id,
                    e.submission_id,
                    e.codename,
                    e.execution_state,
                e.benchmark,
                e.input_size,
                e.samples,
                e.execution_profile,
                e.execution_config,
                e.hardware_snapshot,
                    e.state_version,
                    e.status,
                    e.result_available,
                    e.result_path
                FROM executions e
                WHERE e.codename = %s
                LIMIT 1;
                """,
                (codename,),
            )
            row = cur.fetchone()

        if row is None:
            raise ExecutionNotFound(
                "Execution with codename={} was not found.".format(
                    codename
                )
            )

        return dict(row)

    finally:
        if owns_connection:
            db.close()


def list_queued_executions(
    limit=1,
    conn=None,
    for_update=False,
    skip_locked=False,
):
    """
    Lista executions QUEUED en orden FIFO persistente.

    `queued_at` define el orden primario y `id` resuelve empates de forma
    determinista. Cuando `for_update=True`, el llamador puede reclamar la
    fila dentro de su propia transacción. `skip_locked=True` permite que un
    coordinador concurrente omita filas ya reclamadas sin bloquearse.
    """
    try:
        parsed_limit = int(limit)
    except (TypeError, ValueError):
        raise ValueError("limit debe ser un entero.")

    if parsed_limit < 1 or parsed_limit > 1000:
        raise ValueError("limit debe estar entre 1 y 1000.")

    if skip_locked and not for_update:
        raise ValueError(
            "skip_locked requiere for_update=True."
        )

    owns_connection = conn is None
    db = conn or get_connection()

    lock_clause = ""
    if for_update:
        lock_clause = " FOR UPDATE"
        if skip_locked:
            lock_clause += " SKIP LOCKED"

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.id,
                    e.public_id::text AS public_id,
                    e.submission_id,
                    e.codename,
                    e.execution_state,
                    e.queued_at,
                    e.benchmark,
                    e.input_size,
                    e.samples,
                    e.execution_profile,
                    e.execution_config,
                    e.state_version,
                    e.status
                FROM executions e
                WHERE e.execution_state = 'QUEUED'
                ORDER BY
                    e.queued_at ASC NULLS LAST,
                    e.id ASC
                LIMIT %s
                """ + lock_clause + ";",
                (parsed_limit,),
            )
            rows = cur.fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:
        if owns_connection:
            db.close()



def transition_execution(
    public_id,
    expected_state,
    expected_version,
    new_state,
    failure_stage=None,
    error_code=None,
    error_message=None,
    result_available=None,
    result_path=None,
    conn=None,
):
    """
    Actualiza una ejecución de forma atómica usando optimistic concurrency.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    legacy_status = _legacy_status_for(new_state, error_code)

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE executions
                SET
                    execution_state = %s,
                    failure_stage = %s,
                    error_code = %s,
                    error_message = %s,
                    status = %s,

                    started_at = CASE
                        WHEN %s = 'RUNNING' AND started_at IS NULL
                            THEN CURRENT_TIMESTAMP
                        ELSE started_at
                    END,

                    processing_at = CASE
                        WHEN %s = 'PROCESSING' AND processing_at IS NULL
                            THEN CURRENT_TIMESTAMP
                        ELSE processing_at
                    END,

                    finished_at = CASE
                        WHEN %s IN ('COMPLETED', 'FAILED', 'CANCELLED')
                             AND finished_at IS NULL
                            THEN CURRENT_TIMESTAMP
                        ELSE finished_at
                    END,

                    result_available = COALESCE(%s, result_available),
                    result_path = COALESCE(%s, result_path),

                    updated_at = CURRENT_TIMESTAMP,
                    state_version = state_version + 1

                WHERE public_id = %s::uuid
                  AND execution_state = %s
                  AND state_version = %s

                RETURNING
                    id,
                    public_id::text AS public_id,
                    submission_id,
                    hardware_profile_id,
                    codename,
                    execution_state,
                    failure_stage,
                    error_code,
                    error_message,
                    created_at,
                    queued_at,
                    started_at,
                    processing_at,
                    finished_at,
                    updated_at,
                    last_heartbeat_at,
                    benchmark,
                    input_size,
                    samples,
                    execution_profile,
                    execution_config,
                    hardware_snapshot,
                    result_available,
                    result_path,
                    idempotency_key::text AS idempotency_key,
                    state_version,
                    status,
                    slave_id,
                    duration_ms,
                    log_path;
                """,
                (
                    new_state,
                    failure_stage,
                    error_code,
                    error_message,
                    legacy_status,
                    new_state,
                    new_state,
                    new_state,
                    result_available,
                    result_path,
                    str(public_id),
                    expected_state,
                    expected_version,
                ),
            )
            row = cur.fetchone()

        if row is None:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT execution_state, state_version
                    FROM executions
                    WHERE public_id = %s::uuid;
                    """,
                    (str(public_id),),
                )
                current = cur.fetchone()

            if current is None:
                raise ExecutionNotFound(
                    "Execution with public_id={} was not found.".format(public_id)
                )

            raise ConcurrentExecutionUpdate(
                "Execution {} changed concurrently: current state={}, "
                "version={}; expected state={}, version={}.".format(
                    public_id,
                    current["execution_state"],
                    current["state_version"],
                    expected_state,
                    expected_version,
                )
            )

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()



def store_hardware_snapshot_by_codename(
    codename,
    hardware_snapshot,
    conn=None,
):
    # CORE-06C-3: persiste provenance sin alterar state_version.
    if not isinstance(hardware_snapshot, dict) or not hardware_snapshot:
        raise ExecutionRepositoryError(
            "hardware_snapshot must be a non-empty dict."
        )

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE executions
                SET
                    hardware_snapshot = %s::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE codename = %s
                  AND execution_state IN ('RUNNING', 'PROCESSING')
                  AND hardware_snapshot = '{}'::jsonb
                RETURNING
                    id,
                    public_id::text AS public_id,
                    codename,
                    execution_state,
                    hardware_snapshot,
                    updated_at,
                    state_version;
                """,
                (
                    __import__("json").dumps(hardware_snapshot),
                    codename,
                ),
            )
            row = cur.fetchone()

        if row is None:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        id,
                        public_id::text AS public_id,
                        codename,
                        execution_state,
                        hardware_snapshot,
                        updated_at,
                        state_version
                    FROM executions
                    WHERE codename = %s
                    LIMIT 1;
                    """,
                    (codename,),
                )
                current = cur.fetchone()

            if current is None:
                raise ExecutionNotFound(
                    "Execution with codename={} was not found.".format(codename)
                )

            if current.get("hardware_snapshot"):
                if owns_connection:
                    db.commit()
                return dict(current)

            raise ExecutionRepositoryError(
                "Hardware snapshot can only be stored while execution "
                "is RUNNING/PROCESSING; current state={}".format(
                    current["execution_state"]
                )
            )

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()

def touch_heartbeat(public_id, conn=None):
    """
    Actualiza heartbeat únicamente si la ejecución sigue activa.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE executions
                SET
                    last_heartbeat_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE public_id = %s::uuid
                  AND execution_state IN ('RUNNING', 'PROCESSING')
                RETURNING
                    public_id::text AS public_id,
                    execution_state,
                    last_heartbeat_at,
                    updated_at,
                    state_version;
                """,
                (str(public_id),),
            )
            row = cur.fetchone()

        if row is None:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT execution_state
                    FROM executions
                    WHERE public_id = %s::uuid;
                    """,
                    (str(public_id),),
                )
                current = cur.fetchone()

            if current is None:
                raise ExecutionNotFound(
                    "Execution with public_id={} was not found.".format(public_id)
                )

            raise ExecutionRepositoryError(
                "Heartbeat is only valid in RUNNING/PROCESSING; current state={}"
                .format(current["execution_state"])
            )

        if owns_connection:
            db.commit()

        return dict(row)

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


# ============================================================
# CORE-04F-1A — stale execution recovery
# ============================================================

def list_stale_executions(
    active_before,
    conn=None,
):
    """
    Lista executions activas con heartbeat stale sin modificarlas.

    Sólo RUNNING / PROCESSING son recuperables por timeout:
      COALESCE(last_heartbeat_at, updated_at) <= active_before

    QUEUED puede esperar indefinidamente en la cola FIFO persistente y no se
    considera stale por antigüedad.

    El orden por id hace el proceso determinista para tests/evidencia.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    id,
                    public_id::text AS public_id,
                    codename,
                    execution_state,
                    state_version,
                    updated_at,
                    last_heartbeat_at,
                    COALESCE(
                        last_heartbeat_at,
                        updated_at
                    ) AS last_activity_at
                FROM executions
                WHERE execution_state IN ('RUNNING', 'PROCESSING')
                  AND COALESCE(last_heartbeat_at, updated_at) <= %s
                ORDER BY id ASC;
                """,
                (active_before,),
            )
            rows = cur.fetchall()

        return [dict(row) for row in rows]

    finally:
        if owns_connection:
            db.close()


def fail_execution_if_stale(
    public_id,
    expected_state,
    expected_version,
    stale_before,
    failure_stage,
    error_code,
    error_message,
    conn=None,
):
    """
    FAILED atómico condicionado por estado, versión y última actividad.

    Retorna dict si recuperó la fila.
    Retorna None si hubo una carrera: transición/heartbeat posterior al scan.
    """
    if expected_state not in ('RUNNING', 'PROCESSING'):
        raise ExecutionRepositoryError(
            "State {!r} is not recoverable as stale.".format(
                expected_state
            )
        )

    owns_connection = conn is None
    db = conn or get_connection()

    try:
        query = """
            UPDATE executions
            SET
                execution_state = 'FAILED',
                failure_stage = %s,
                error_code = %s,
                error_message = %s,
                status = 'runtime_error',
                result_available = FALSE,
                finished_at = COALESCE(
                    finished_at,
                    CURRENT_TIMESTAMP
                ),
                updated_at = CURRENT_TIMESTAMP,
                state_version = state_version + 1
            WHERE public_id = %s::uuid
              AND execution_state = %s
              AND state_version = %s
              AND COALESCE(last_heartbeat_at, updated_at) <= %s
            RETURNING
                id,
                public_id::text AS public_id,
                codename,
                execution_state,
                failure_stage,
                error_code,
                error_message,
                result_available,
                finished_at,
                updated_at,
                last_heartbeat_at,
                state_version;
        """

        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                query,
                (
                    failure_stage,
                    error_code,
                    error_message,
                    str(public_id),
                    expected_state,
                    expected_version,
                    stale_before,
                ),
            )
            row = cur.fetchone()

        if owns_connection:
            db.commit()

        return dict(row) if row else None

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()


def summarize_submission_execution_states(
    submission_id,
    conn=None,
):
    """
    Resume estados canónicos de todas las executions de una Submission.

    Se usa para mantener `submissions.status` como compatibilidad legacy sin
    marcar una Submission como terminada mientras aún existan executions
    QUEUED/RUNNING/PROCESSING.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'QUEUED'
                    )::int AS queued,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'RUNNING'
                    )::int AS running,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'PROCESSING'
                    )::int AS processing,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'COMPLETED'
                    )::int AS completed,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'FAILED'
                    )::int AS failed,
                    COUNT(*) FILTER (
                        WHERE execution_state = 'CANCELLED'
                    )::int AS cancelled
                FROM executions
                WHERE submission_id = %s;
                """,
                (submission_id,),
            )
            row = cur.fetchone()

        return dict(row)

    finally:
        if owns_connection:
            db.close()
