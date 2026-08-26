-- PRE-EVAL-005
-- Organización reversible del historial personal de submissions.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL;

INSERT INTO schema_migrations (version, description)
VALUES (
    'pre_eval_005_submission_archiving',
    'Archivado reversible de submissions para organización del historial'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
