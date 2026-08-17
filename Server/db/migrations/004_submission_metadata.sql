-- PRE-EVAL-004
-- Performance System — metadata académica básica de submissions
-- PostgreSQL 12+
--
-- Agrega el nombre visible del ZIP, una nota opcional y el marcador de
-- referencia. Los campos nullable no se infieren para filas históricas y
-- is_pinned parte en FALSE para submissions existentes y nuevas.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(512),
    ADD COLUMN IF NOT EXISTS note VARCHAR(500),
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Hace segura una reanudación si una aplicación parcial anterior hubiese
-- dejado is_pinned nullable. No se inventan valores para los otros campos.
UPDATE submissions
SET is_pinned = FALSE
WHERE is_pinned IS NULL;

ALTER TABLE submissions
    ALTER COLUMN is_pinned SET DEFAULT FALSE,
    ALTER COLUMN is_pinned SET NOT NULL;

INSERT INTO schema_migrations (version, description)
VALUES (
    'pre_eval_004_submission_metadata',
    'Nombre original del ZIP, nota opcional y marcador de referencia en submissions'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
