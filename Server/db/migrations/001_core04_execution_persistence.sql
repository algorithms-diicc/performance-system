-- CORE-04A-2
-- Performance System — Persistencia profesional de ejecuciones
-- PostgreSQL 12+
--
-- Objetivo:
--   Evolucionar `executions` sin destruir los 50 registros existentes.
--   `status` se mantiene temporalmente como campo legacy para no romper
--   profile/admin/submissions_routes durante la migración por etapas.
--
-- Ejecutar como un rol con permisos ALTER sobre public.executions
-- (en desarrollo puede usarse postgres).
--
-- Recomendación:
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -d performance_system \
--     -f Server/db/migrations/001_core04_execution_persistence.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permiso mínimo de lectura para el rol propietario del esquema de aplicación.
-- Evita acoplar la migración al nombre fijo "perf_user".
DO $$
DECLARE
    application_role name;
BEGIN
    SELECT tableowner
      INTO application_role
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = 'executions';

    IF application_role IS NOT NULL THEN
        EXECUTE format(
            'GRANT SELECT ON TABLE public.schema_migrations TO %I',
            application_role
        );
    END IF;
END
$$;

-- -------------------------------------------------------------------------
-- 1. Identidad pública y vínculo con artefactos legacy
-- -------------------------------------------------------------------------

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS public_id UUID,
ADD COLUMN IF NOT EXISTS codename VARCHAR(128);

UPDATE executions
SET
    public_id = gen_random_uuid ()
WHERE
    public_id IS NULL;

ALTER TABLE executions
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid (),
ALTER COLUMN public_id
SET
    NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_public_id ON executions (public_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_codename ON executions (codename)
WHERE
    codename IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. Estado canónico del job
--
-- `status` NO se elimina todavía:
--   status='ok'             -> execution_state='COMPLETED'
--   status='timeout'        -> execution_state='FAILED'
--   status='runtime_error'  -> execution_state='FAILED'
--
-- Los endpoints legacy pueden seguir leyendo `status` mientras migramos.
-- -------------------------------------------------------------------------

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS execution_state VARCHAR(20),
ADD COLUMN IF NOT EXISTS failure_stage VARCHAR(32),
ADD COLUMN IF NOT EXISTS error_code VARCHAR(64),
ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE executions
SET
    execution_state = CASE
        WHEN LOWER(COALESCE(status, '')) = 'ok' THEN 'COMPLETED'
        WHEN LOWER(COALESCE(status, '')) IN ('timeout', 'runtime_error') THEN 'FAILED'
        WHEN LOWER(COALESCE(status, '')) IN (
            'queued',
            'in queue',
            'pending'
        ) THEN 'QUEUED'
        WHEN LOWER(COALESCE(status, '')) = 'running' THEN 'RUNNING'
        WHEN LOWER(COALESCE(status, '')) = 'processing' THEN 'PROCESSING'
        WHEN LOWER(COALESCE(status, '')) IN ('cancelled', 'canceled') THEN 'CANCELLED'
        ELSE 'FAILED'
    END
WHERE
    execution_state IS NULL;

UPDATE executions
SET
    failure_stage = COALESCE(failure_stage, 'EXECUTION'),
    error_code = COALESCE(
        error_code,
        CASE
            WHEN LOWER(COALESCE(status, '')) = 'timeout' THEN 'TIMEOUT'
            WHEN LOWER(COALESCE(status, '')) = 'runtime_error' THEN 'RUNTIME_ERROR'
            ELSE 'LEGACY_STATUS_UNKNOWN'
        END
    ),
    error_message = COALESCE(
        error_message,
        CASE
            WHEN LOWER(COALESCE(status, '')) NOT IN('timeout', 'runtime_error') THEN 'Registro legacy migrado desde un status no reconocido.'
            ELSE NULL
        END
    )
WHERE
    execution_state = 'FAILED';

ALTER TABLE executions
ALTER COLUMN execution_state
SET DEFAULT 'QUEUED',
ALTER COLUMN execution_state
SET
    NOT NULL;

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_execution_state;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_execution_state CHECK (
    execution_state IN (
        'QUEUED',
        'RUNNING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    )
);

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_failed_has_error_code;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_failed_has_error_code CHECK (
    execution_state <> 'FAILED'
    OR error_code IS NOT NULL
);

-- -------------------------------------------------------------------------
-- 3. Ciclo de vida temporal
-- -------------------------------------------------------------------------

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processing_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP;

-- Para registros legacy usamos submission.created_at como mejor dato histórico
-- disponible. No inventamos started_at/finished_at.
UPDATE executions e
SET
    created_at = s.created_at
FROM submissions s
WHERE
    e.submission_id = s.id
    AND e.created_at IS NULL;

UPDATE executions
SET
    created_at = CURRENT_TIMESTAMP
WHERE
    created_at IS NULL;

UPDATE executions
SET
    updated_at = COALESCE(
        finished_at,
        processing_at,
        started_at,
        created_at,
        CURRENT_TIMESTAMP
    )
WHERE
    updated_at IS NULL;

ALTER TABLE executions
ALTER COLUMN created_at
SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN created_at
SET
    NOT NULL,
ALTER COLUMN updated_at
SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at
SET
    NOT NULL;

-- -------------------------------------------------------------------------
-- 4. Configuración experimental consultable + snapshots reproducibles
-- -------------------------------------------------------------------------

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS benchmark VARCHAR(32),
ADD COLUMN IF NOT EXISTS input_size INTEGER,
ADD COLUMN IF NOT EXISTS samples INTEGER,
ADD COLUMN IF NOT EXISTS execution_profile VARCHAR(20),
ADD COLUMN IF NOT EXISTS execution_config JSONB,
ADD COLUMN IF NOT EXISTS hardware_snapshot JSONB;

UPDATE executions
SET execution_config = '{}'::jsonb
WHERE execution_config IS NULL;

UPDATE executions
SET hardware_snapshot = '{}'::jsonb
WHERE hardware_snapshot IS NULL;

ALTER TABLE executions
    ALTER COLUMN execution_config SET DEFAULT '{}'::jsonb,
    ALTER COLUMN execution_config SET NOT NULL,
    ALTER COLUMN hardware_snapshot SET DEFAULT '{}'::jsonb,
    ALTER COLUMN hardware_snapshot SET NOT NULL;

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_input_size_positive;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_input_size_positive CHECK (
    input_size IS NULL
    OR input_size > 0
);

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_samples_positive;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_samples_positive CHECK (
    samples IS NULL
    OR samples > 0
);

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_execution_profile;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_execution_profile CHECK (
    execution_profile IS NULL
    OR execution_profile IN (
        'QUICK',
        'BALANCED',
        'EXHAUSTIVE',
        'CUSTOM'
    )
);

-- -------------------------------------------------------------------------
-- 5. Resultados, idempotencia y concurrencia
-- -------------------------------------------------------------------------

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS result_available BOOLEAN,
ADD COLUMN IF NOT EXISTS result_path VARCHAR(512),
ADD COLUMN IF NOT EXISTS idempotency_key UUID,
ADD COLUMN IF NOT EXISTS state_version INTEGER;

UPDATE executions
SET
    result_available = FALSE
WHERE
    result_available IS NULL;

UPDATE executions SET state_version = 0 WHERE state_version IS NULL;

ALTER TABLE executions
ALTER COLUMN result_available
SET DEFAULT FALSE,
ALTER COLUMN result_available
SET
    NOT NULL,
ALTER COLUMN state_version
SET DEFAULT 0,
ALTER COLUMN state_version
SET
    NOT NULL;

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_state_version_nonnegative;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_state_version_nonnegative CHECK (state_version >= 0);

ALTER TABLE executions
DROP CONSTRAINT IF EXISTS chk_executions_result_requires_completed;

ALTER TABLE executions
ADD CONSTRAINT chk_executions_result_requires_completed CHECK (
    result_available = FALSE
    OR execution_state = 'COMPLETED'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_idempotency_key ON executions (idempotency_key)
WHERE
    idempotency_key IS NOT NULL;

-- -------------------------------------------------------------------------
-- 6. Índices de operación e historial
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_executions_state_created_at ON executions (
    execution_state,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_executions_submission_created_at ON executions (
    submission_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_executions_benchmark_created_at ON executions (benchmark, created_at DESC)
WHERE
    benchmark IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_executions_active_heartbeat ON executions (last_heartbeat_at)
WHERE
    execution_state IN ('RUNNING', 'PROCESSING');

-- -------------------------------------------------------------------------
-- 7. Registro de migración
-- -------------------------------------------------------------------------

INSERT INTO
    schema_migrations (version, description)
VALUES (
        'core04a_001_execution_persistence',
        'Persistencia, estado canónico, configuración, resultados e identidad pública de executions'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
