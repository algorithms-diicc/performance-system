-- HANDOFF F / FEEDBACK DOCENTE + NOTIFICACIONES INTERNAS
-- PostgreSQL 12+
--
-- Orden de despliegue:
--   1. backup/snapshot;
--   2. aplicar esta migración con un rol con privilegios suficientes;
--   3. verificar schema_migrations y tablas;
--   4. iniciar/reiniciar backend.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher_feedback (
    id SERIAL PRIMARY KEY,
    submission_id INT NOT NULL
        REFERENCES submissions (id)
        ON DELETE CASCADE,
    author_user_id INT
        REFERENCES users (id)
        ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_teacher_feedback_message
        CHECK (
            BTRIM(message) <> ''
            AND CHAR_LENGTH(message) <= 2000
        )
);

CREATE INDEX IF NOT EXISTS idx_teacher_feedback_submission_created
    ON teacher_feedback (
        submission_id,
        created_at ASC,
        id ASC
    );

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL
        REFERENCES users (id)
        ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    event_key VARCHAR(160) NOT NULL,

    submission_id INT
        REFERENCES submissions (id)
        ON DELETE CASCADE,
    execution_id INT
        REFERENCES executions (id)
        ON DELETE CASCADE,
    feedback_id INT
        REFERENCES teacher_feedback (id)
        ON DELETE CASCADE,
    protocol_id INT
        REFERENCES experimental_protocols (id)
        ON DELETE CASCADE,
    actor_user_id INT
        REFERENCES users (id)
        ON DELETE SET NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notifications_user_event
        UNIQUE (user_id, kind, event_key),

    CONSTRAINT chk_notifications_kind
        CHECK (
            kind IN (
                'EXECUTION_FAILED',
                'TEACHER_FEEDBACK',
                'PROTOCOL_PUBLISHED'
            )
        ),

    CONSTRAINT chk_notifications_read_state
        CHECK (
            (is_read = FALSE AND read_at IS NULL)
            OR (is_read = TRUE AND read_at IS NOT NULL)
        ),

    CONSTRAINT chk_notifications_source
        CHECK (
            (
                kind = 'EXECUTION_FAILED'
                AND execution_id IS NOT NULL
                AND submission_id IS NOT NULL
                AND feedback_id IS NULL
                AND protocol_id IS NULL
            )
            OR (
                kind = 'TEACHER_FEEDBACK'
                AND feedback_id IS NOT NULL
                AND submission_id IS NOT NULL
                AND execution_id IS NULL
                AND protocol_id IS NULL
            )
            OR (
                kind = 'PROTOCOL_PUBLISHED'
                AND protocol_id IS NOT NULL
                AND submission_id IS NULL
                AND execution_id IS NULL
                AND feedback_id IS NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
    ON notifications (
        user_id,
        is_read,
        created_at DESC,
        id DESC
    );

CREATE INDEX IF NOT EXISTS idx_notifications_submission
    ON notifications (submission_id)
    WHERE submission_id IS NOT NULL;

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
            'GRANT SELECT, INSERT ON TABLE public.teacher_feedback TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.teacher_feedback_id_seq TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE ON TABLE public.notifications TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.notifications_id_seq TO %I',
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
    'handoff_f_007_feedback_notifications',
    'Feedback docente por experimento y bandeja interna de notificaciones'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
