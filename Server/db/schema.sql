-- Performance System
-- Esquema base actualizado después de PRE-EVAL-004
-- PostgreSQL 12+
--
-- Este archivo representa el estado objetivo actual para una instalación NUEVA.
-- Para actualizar una BD existente se deben usar Server/db/migrations/*.sql.
--
-- IMPORTANTE:
-- - `executions.status` se conserva temporalmente como compatibilidad legacy.
-- - `executions.execution_state` es el estado canónico nuevo.
-- - `metrics` y `hardware_profiles` se conservan por ahora con su diseño existente;
--   su integración funcional se realizará en checkpoints posteriores.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- VERSIONADO DEL ESQUEMA
-- =========================================================================

CREATE TABLE schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ROLES Y USUARIOS
-- =========================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(150)
);

-- Roles canónicos para una instalación nueva.
-- El backend debe autorizar por rol/permiso, no por IDs numéricos fijos.
INSERT INTO roles (name, description)
VALUES
    ('Student', 'Rol estudiante por defecto'),
    ('Admin', 'Administración global de la plataforma'),
    ('Teacher', 'Supervisión académica de cursos')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role_id INT NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- =========================================================================
-- AUTENTICACIÓN Y SESIONES
-- =========================================================================

CREATE TABLE auth_identities (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_auth_provider_subject ON auth_identities (provider, provider_subject);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- =========================================================================
-- SOLICITUDES DE ACCESO
-- =========================================================================

CREATE TABLE access_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_role_id INT REFERENCES roles (id) ON DELETE RESTRICT,
    professor_email VARCHAR(100),
    course_code VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INT REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_access_requests_status ON access_requests (status);


-- =========================================================================
-- CURSOS Y SUPERVISIÓN DOCENTE
-- =========================================================================
--
-- Un course representa una instancia académica concreta:
-- código + año + semestre + profesor.
--
-- course_memberships mantiene la pertenencia histórica del estudiante.
-- Retirar a un estudiante NO elimina su usuario, submissions ni executions.

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    academic_year INTEGER NOT NULL,
    academic_term SMALLINT NOT NULL,
    teacher_user_id INT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_courses_code_not_blank
        CHECK (BTRIM(code) <> ''),

    CONSTRAINT chk_courses_name_not_blank
        CHECK (BTRIM(name) <> ''),

    CONSTRAINT chk_courses_academic_year
        CHECK (academic_year BETWEEN 2000 AND 9999),

    CONSTRAINT chk_courses_academic_term
        CHECK (academic_term IN (1, 2)),

    CONSTRAINT uq_courses_instance
        UNIQUE (
            code,
            academic_year,
            academic_term,
            teacher_user_id
        )
);

CREATE INDEX idx_courses_teacher_active
    ON courses (teacher_user_id, is_active, academic_year DESC, academic_term DESC);

CREATE INDEX idx_courses_code_period
    ON courses (code, academic_year DESC, academic_term DESC);

CREATE TABLE course_memberships (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    membership_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    source_access_request_id INT REFERENCES access_requests (id) ON DELETE SET NULL,
    added_by_user_id INT REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP,

    CONSTRAINT uq_course_memberships_course_user
        UNIQUE (course_id, user_id),

    CONSTRAINT chk_course_memberships_source
        CHECK (
            membership_source IN (
                'MANUAL',
                'ACCESS_REQUEST',
                'BULK_IMPORT'
            )
        ),

    CONSTRAINT chk_course_memberships_removed_inactive
        CHECK (
            removed_at IS NULL
            OR is_active = FALSE
        )
);

CREATE INDEX idx_course_memberships_course_active
    ON course_memberships (course_id, is_active, user_id);

CREATE INDEX idx_course_memberships_user_active
    ON course_memberships (user_id, is_active, course_id);


-- =========================================================================
-- HARDWARE
-- =========================================================================

CREATE TABLE hardware_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    cpu_model VARCHAR(100),
    ram_gb INT,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- SUBMISSIONS
-- =========================================================================

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    course_id INT REFERENCES courses (id) ON DELETE SET NULL,
    title VARCHAR(100),
    language VARCHAR(50),
    file_path VARCHAR(255),
    original_filename VARCHAR(512),
    code_hash VARCHAR(64),
    note VARCHAR(500),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50)
);

CREATE INDEX idx_submissions_user_id ON submissions (user_id);

CREATE INDEX idx_submissions_course_id ON submissions (course_id);

CREATE INDEX idx_submissions_status ON submissions (status);

-- =========================================================================
-- EXECUTIONS
-- =========================================================================

CREATE TABLE executions (
    -- Identidad interna/pública
    id                  SERIAL PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid(),
    codename            VARCHAR(128),

-- Relaciones
submission_id INT NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
hardware_profile_id INT REFERENCES hardware_profiles (id) ON DELETE SET NULL,

-- Compatibilidad legacy temporal
status VARCHAR(50),
slave_id VARCHAR(50),
duration_ms INT,
log_path VARCHAR(255),

-- Estado canónico
execution_state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
failure_stage VARCHAR(32),
error_code VARCHAR(64),
error_message TEXT,

-- Ciclo de vida
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
queued_at TIMESTAMP,
started_at TIMESTAMP,
processing_at TIMESTAMP,
finished_at TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
last_heartbeat_at TIMESTAMP,

-- Configuración experimental
benchmark           VARCHAR(32),
    input_size          INTEGER,
    samples             INTEGER,
    execution_profile   VARCHAR(20),
    execution_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
    hardware_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,

-- Resultados
result_available BOOLEAN NOT NULL DEFAULT FALSE,
result_path VARCHAR(512),

-- Idempotencia / concurrencia
idempotency_key     UUID,
    state_version       INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT chk_executions_execution_state
        CHECK (
            execution_state IN (
                'QUEUED',
                'RUNNING',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_executions_failed_has_error_code
        CHECK (
            execution_state <> 'FAILED'
            OR error_code IS NOT NULL
        ),

    CONSTRAINT chk_executions_input_size_positive
        CHECK (
            input_size IS NULL
            OR input_size > 0
        ),

    CONSTRAINT chk_executions_samples_positive
        CHECK (
            samples IS NULL
            OR samples > 0
        ),

    CONSTRAINT chk_executions_execution_profile
        CHECK (
            execution_profile IS NULL
            OR execution_profile IN (
                'QUICK',
                'BALANCED',
                'EXHAUSTIVE',
                'CUSTOM'
            )
        ),

    CONSTRAINT chk_executions_state_version_nonnegative
        CHECK (state_version >= 0),

    CONSTRAINT chk_executions_result_requires_completed
        CHECK (
            result_available = FALSE
            OR execution_state = 'COMPLETED'
        )
);

CREATE UNIQUE INDEX idx_executions_public_id ON executions (public_id);

CREATE UNIQUE INDEX idx_executions_codename ON executions (codename)
WHERE
    codename IS NOT NULL;

CREATE UNIQUE INDEX idx_executions_idempotency_key ON executions (idempotency_key)
WHERE
    idempotency_key IS NOT NULL;

CREATE INDEX idx_executions_submission_id ON executions (submission_id);

CREATE INDEX idx_executions_hardware_profile_id ON executions (hardware_profile_id);

CREATE INDEX idx_executions_state_created_at ON executions (
    execution_state,
    created_at DESC
);

CREATE INDEX idx_executions_submission_created_at ON executions (
    submission_id,
    created_at DESC
);

CREATE INDEX idx_executions_benchmark_created_at ON executions (benchmark, created_at DESC)
WHERE
    benchmark IS NOT NULL;

CREATE INDEX idx_executions_active_heartbeat ON executions (last_heartbeat_at)
WHERE
    execution_state IN ('RUNNING', 'PROCESSING');

-- =========================================================================
-- MÉTRICAS
-- =========================================================================

CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    execution_id INT NOT NULL REFERENCES executions (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION,
    unit VARCHAR(20)
);

CREATE INDEX idx_metrics_execution_id ON metrics (execution_id);

CREATE INDEX idx_metrics_name ON metrics (name);

-- =========================================================================
-- AUDITORÍA
-- =========================================================================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_id ON audit_log (user_id);

CREATE INDEX idx_audit_created_at ON audit_log (created_at);

-- =========================================================================
-- BASELINE DE MIGRACIONES INCLUIDAS EN ESTE SNAPSHOT
-- =========================================================================

INSERT INTO
    schema_migrations (version, description)
VALUES
    (
        'core04a_001_execution_persistence',
        'Persistencia, estado canónico, configuración, resultados e identidad pública de executions'
    ),
    (
        'core07f_002_teacher_courses',
        'Rol Teacher y modelo mínimo de cursos/membresías para supervisión docente'
    ),
    (
        'core07f_003_submission_course_context',
        'Contexto académico opcional de submissions mediante course_id'
    ),
    (
        'pre_eval_004_submission_metadata',
        'Nombre original del ZIP, nota opcional y marcador de referencia en submissions'
    )
ON CONFLICT (version) DO NOTHING;
