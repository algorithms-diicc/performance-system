-- HANDOFF E / ITERACIÓN 5
-- Protocolos experimentales asociados a cursos.
-- PostgreSQL 12+
--
-- Orden de despliegue:
--   1. backup/snapshot;
--   2. aplicar esta migración con un rol con privilegios suficientes;
--   3. verificar schema_migrations y columnas/tablas;
--   4. iniciar/reiniciar backend.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experimental_protocols (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL
        REFERENCES courses (id)
        ON DELETE CASCADE,

    title VARCHAR(150) NOT NULL,
    objective TEXT NOT NULL,
    instructions TEXT,

    benchmark VARCHAR(16) NOT NULL,
    input_size INTEGER NOT NULL,
    execution_profile VARCHAR(20) NOT NULL,
    samples INTEGER NOT NULL,
    data_type VARCHAR(16),

    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by_user_id INT
        REFERENCES users (id)
        ON DELETE SET NULL,
    updated_by_user_id INT
        REFERENCES users (id)
        ON DELETE SET NULL,

    published_at TIMESTAMP,
    deactivated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_experimental_protocol_title
        CHECK (BTRIM(title) <> ''),

    CONSTRAINT chk_experimental_protocol_objective
        CHECK (BTRIM(objective) <> ''),

    CONSTRAINT chk_experimental_protocol_benchmark
        CHECK (benchmark IN ('LCS', 'CAMM', 'SIZE')),

    CONSTRAINT chk_experimental_protocol_input_size
        CHECK (input_size > 0),

    CONSTRAINT chk_experimental_protocol_profile
        CHECK (
            execution_profile IN (
                'QUICK',
                'BALANCED',
                'EXHAUSTIVE',
                'CUSTOM'
            )
        ),

    CONSTRAINT chk_experimental_protocol_samples
        CHECK (samples BETWEEN 1 AND 100),

    CONSTRAINT chk_experimental_protocol_profile_samples
        CHECK (
            (execution_profile = 'QUICK' AND samples = 10)
            OR (execution_profile = 'BALANCED' AND samples = 30)
            OR (execution_profile = 'EXHAUSTIVE' AND samples = 50)
            OR (execution_profile = 'CUSTOM')
        ),

    CONSTRAINT chk_experimental_protocol_data_type
        CHECK (
            (
                benchmark = 'CAMM'
                AND data_type IN ('CAMMR', 'CAMMSO', 'CAMMS')
            )
            OR (
                benchmark <> 'CAMM'
                AND data_type IS NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_experimental_protocols_course
    ON experimental_protocols (
        course_id,
        is_active,
        is_published,
        updated_at DESC
    );

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS protocol_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_submissions_protocol_id'
          AND conrelid = 'public.submissions'::regclass
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT fk_submissions_protocol_id
            FOREIGN KEY (protocol_id)
            REFERENCES experimental_protocols (id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_submissions_protocol_id
    ON submissions (protocol_id);

DO $$
DECLARE
    application_role name;
BEGIN
    SELECT tableowner
      INTO application_role
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = 'users';

    IF application_role IS NOT NULL THEN
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.experimental_protocols TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.experimental_protocols_id_seq TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT ON TABLE public.schema_migrations TO %I',
            application_role
        );
    END IF;
END
$$;

INSERT INTO schema_migrations (version, description)
VALUES (
    'handoff_e_006_experimental_protocols',
    'Protocolos experimentales por curso y procedencia opcional mediante submissions.protocol_id'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
