-- CORE-07F-3
-- Performance System — contexto académico de submissions
-- PostgreSQL 12+
--
-- Permite asociar cada submission a una instancia concreta de course.
-- Es nullable para preservar submissions históricos sin atribución inventada.
--
-- Ejecución:
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -d performance_system \
--     -f Server/db/migrations/003_core07_submission_course_context.sql

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS course_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_submissions_course_id'
          AND conrelid = 'public.submissions'::regclass
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT fk_submissions_course_id
            FOREIGN KEY (course_id)
            REFERENCES courses (id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_submissions_course_id
    ON submissions (course_id);

INSERT INTO schema_migrations (version, description)
VALUES (
    'core07f_003_submission_course_context',
    'Contexto académico opcional de submissions mediante course_id'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
