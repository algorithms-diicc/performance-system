"""Lecturas operacionales mínimas para el diagnóstico administrativo.

Este repository no adquiere advisory locks ni modifica estado persistido. La
consulta principal y la observación puntual de ``pg_locks`` se mantienen
separadas para que un fallo del segundo diagnóstico no degrade PostgreSQL.
"""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


class SystemStatusRepositoryError(Exception):
    """Error base del repository de estado del sistema."""


class DatabaseUnavailable(SystemStatusRepositoryError):
    """No fue posible establecer una conexión PostgreSQL."""


class DiagnosticQueryUnavailable(SystemStatusRepositoryError):
    """La conexión existe, pero la consulta principal no es confiable."""


SYSTEM_STATUS_SQL = """
    WITH operational AS (
        SELECT
            (COUNT(*) FILTER (
                WHERE e.execution_state = 'QUEUED'
            ))::integer AS queued,
            (COUNT(*) FILTER (
                WHERE e.execution_state = 'RUNNING'
            ))::integer AS running,
            (COUNT(*) FILTER (
                WHERE e.execution_state = 'PROCESSING'
            ))::integer AS processing,
            MIN(e.queued_at) FILTER (
                WHERE e.execution_state = 'QUEUED'
            ) AS oldest_queued_at,
            (COUNT(*) FILTER (
                WHERE e.execution_state IN ('RUNNING', 'PROCESSING')
                  AND COALESCE(e.last_heartbeat_at, e.updated_at) <= %s
            ))::integer AS stale_active,
            MAX(e.finished_at) FILTER (
                WHERE e.execution_state = 'COMPLETED'
            ) AS latest_completed_at,
            MAX(e.finished_at) FILTER (
                WHERE e.execution_state = 'FAILED'
            ) AS latest_failed_at
        FROM executions e
    ),
    latest_environment AS (
        SELECT
            COALESCE(
                e.finished_at,
                e.updated_at,
                e.created_at
            ) AS observed_at,
            e.hardware_snapshot ->> 'schema_version'
                AS snapshot_schema_version,
            e.hardware_snapshot #>> '{node,cpu_model}' AS cpu_model,
            e.hardware_snapshot #>> '{node,architecture}' AS architecture,
            e.hardware_snapshot #> '{node,logical_cpus}' AS logical_cpus,
            e.hardware_snapshot #>> '{measurement,perf_version}'
                AS perf_version,
            e.hardware_snapshot #>> '{measurement,perf_event_paranoid}'
                AS perf_event_paranoid,
            e.hardware_snapshot #> '{energy,EnergyPkg,event_exposed}'
                AS package_event_exposed,
            e.hardware_snapshot #>> '{energy,EnergyPkg,probe_state}'
                AS package_probe_state,
            e.hardware_snapshot #> '{energy,EnergyPkg,measurement_available}'
                AS package_measurement_available,
            e.hardware_snapshot #> '{energy,EnergyCores,event_exposed}'
                AS cores_event_exposed,
            e.hardware_snapshot #>> '{energy,EnergyCores,probe_state}'
                AS cores_probe_state,
            e.hardware_snapshot #> '{energy,EnergyCores,measurement_available}'
                AS cores_measurement_available,
            e.hardware_snapshot #> '{energy,EnergyRAM,event_exposed}'
                AS ram_event_exposed,
            e.hardware_snapshot #>> '{energy,EnergyRAM,probe_state}'
                AS ram_probe_state,
            e.hardware_snapshot #> '{energy,EnergyRAM,measurement_available}'
                AS ram_measurement_available
        FROM executions e
        WHERE jsonb_typeof(e.hardware_snapshot) = 'object'
          AND e.hardware_snapshot ->> 'schema_version' = '1.0'
          AND jsonb_typeof(e.hardware_snapshot -> 'node') = 'object'
          AND jsonb_typeof(e.hardware_snapshot -> 'measurement') = 'object'
          AND jsonb_typeof(e.hardware_snapshot -> 'energy') = 'object'
          AND jsonb_typeof(
              e.hardware_snapshot #> '{node,cpu_model}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{node,architecture}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{node,logical_cpus}'
          ) IN ('number', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{measurement,perf_version}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{measurement,perf_event_paranoid}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyPkg}'
          ) = 'object'
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyCores}'
          ) = 'object'
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyRAM}'
          ) = 'object'
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyPkg,event_exposed}'
          ) IN ('boolean', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyPkg,probe_state}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot
                  #> '{energy,EnergyPkg,measurement_available}'
          ) IN ('boolean', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyCores,event_exposed}'
          ) IN ('boolean', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyCores,probe_state}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot
                  #> '{energy,EnergyCores,measurement_available}'
          ) IN ('boolean', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyRAM,event_exposed}'
          ) IN ('boolean', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot #> '{energy,EnergyRAM,probe_state}'
          ) IN ('string', 'null')
          AND jsonb_typeof(
              e.hardware_snapshot
                  #> '{energy,EnergyRAM,measurement_available}'
          ) IN ('boolean', 'null')
        ORDER BY
            COALESCE(
                e.finished_at,
                e.updated_at,
                e.created_at
            ) DESC,
            e.id DESC
        LIMIT 1
    )
    SELECT
        operational.queued,
        operational.running,
        operational.processing,
        operational.oldest_queued_at,
        operational.stale_active,
        operational.latest_completed_at,
        operational.latest_failed_at,
        latest_environment.observed_at,
        latest_environment.snapshot_schema_version,
        latest_environment.cpu_model,
        latest_environment.architecture,
        latest_environment.logical_cpus,
        latest_environment.perf_version,
        latest_environment.perf_event_paranoid,
        latest_environment.package_event_exposed,
        latest_environment.package_probe_state,
        latest_environment.package_measurement_available,
        latest_environment.cores_event_exposed,
        latest_environment.cores_probe_state,
        latest_environment.cores_measurement_available,
        latest_environment.ram_event_exposed,
        latest_environment.ram_probe_state,
        latest_environment.ram_measurement_available
    FROM operational
    LEFT JOIN latest_environment ON TRUE;
"""


PROCESS_LOCKS_SQL = """
    WITH requested(name, lock_key) AS (
        VALUES
            ('dispatcher'::text, %s::bigint),
            ('watchdog'::text, %s::bigint)
    )
    SELECT
        r.name,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_catalog.pg_locks l
                WHERE l.locktype = 'advisory'
                  AND l.database = (
                      SELECT d.oid
                      FROM pg_catalog.pg_database d
                      WHERE d.datname = current_database()
                  )
                  AND l.objsubid = 1
                  AND l.granted IS TRUE
                  AND l.mode = 'ExclusiveLock'
                  AND l.classid::bigint =
                      ((r.lock_key >> 32) & 4294967295::bigint)
                  AND l.objid::bigint =
                      (r.lock_key & 4294967295::bigint)
            )
            THEN 'LOCK_OBSERVED'
            ELSE 'LOCK_NOT_OBSERVED'
        END AS signal
    FROM requested r
    ORDER BY r.name;
"""


UNKNOWN_LOCK_SIGNALS = {
    "dispatcher": "UNKNOWN",
    "watchdog": "UNKNOWN",
}


def _close_owned_connection(connection):
    try:
        connection.close()
    except Exception:
        # El cierre no debe convertir un diagnóstico ya obtenido en un 500.
        pass


def fetch_system_status(
    *,
    active_before,
    dispatcher_lock_key,
    watchdog_lock_key,
    conn=None,
    connection_factory=None,
):
    """Obtiene señales persistidas y observa locks sin modificar PostgreSQL."""
    owns_connection = conn is None
    factory = connection_factory or get_connection

    try:
        db = conn or factory()
    except Exception:
        raise DatabaseUnavailable() from None

    try:
        try:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(SYSTEM_STATUS_SQL, (active_before,))
                row = cur.fetchone()
        except Exception:
            raise DiagnosticQueryUnavailable() from None

        if row is None:
            raise DiagnosticQueryUnavailable()

        lock_signals = dict(UNKNOWN_LOCK_SIGNALS)
        try:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    PROCESS_LOCKS_SQL,
                    (dispatcher_lock_key, watchdog_lock_key),
                )
                lock_rows = cur.fetchall()

            for lock_row in lock_rows:
                name = lock_row.get("name")
                signal = lock_row.get("signal")
                if (
                    name in lock_signals
                    and signal in {"LOCK_OBSERVED", "LOCK_NOT_OBSERVED"}
                ):
                    lock_signals[name] = signal
        except Exception:
            # La consulta operacional ya fue exitosa. pg_locks es una señal
            # auxiliar y su indisponibilidad no cambia el estado de la DB.
            lock_signals = dict(UNKNOWN_LOCK_SIGNALS)

        return {
            "operational": dict(row),
            "lock_signals": lock_signals,
        }
    finally:
        if owns_connection:
            _close_owned_connection(db)
