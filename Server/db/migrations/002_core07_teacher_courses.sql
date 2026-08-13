-- CORE-07F-2A
-- Corrección de robustez para 002_core07_teacher_courses.sql
--
-- Problema cubierto:
-- una BD histórica puede tener roles.id con valores mayores que
-- roles_id_seq.last_value (por inserts antiguos con IDs explícitos).
-- Los cambios de secuencia tampoco se revierten con ROLLBACK.
--
-- Esta corrección sincroniza la secuencia ANTES de insertar Teacher.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 0. Sincronizar secuencia de roles de forma idempotente
-- -------------------------------------------------------------------------

SELECT setval(
    pg_get_serial_sequence('public.roles', 'id'),
    COALESCE(
        (SELECT MAX(id) FROM public.roles),
        1
    ),
    EXISTS(
        SELECT 1
        FROM public.roles
    )
);

-- -------------------------------------------------------------------------
-- 1. Rol docente
-- -------------------------------------------------------------------------

INSERT INTO roles (name, description)
VALUES (
    'Teacher',
    'Supervisión académica de cursos'
)
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- 2. Cursos
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
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

CREATE INDEX IF NOT EXISTS idx_courses_teacher_active
    ON courses (
        teacher_user_id,
        is_active,
        academic_year DESC,
        academic_term DESC
    );

CREATE INDEX IF NOT EXISTS idx_courses_code_period
    ON courses (
        code,
        academic_year DESC,
        academic_term DESC
    );

-- -------------------------------------------------------------------------
-- 3. Membresías
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_memberships (
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

CREATE INDEX IF NOT EXISTS idx_course_memberships_course_active
    ON course_memberships (
        course_id,
        is_active,
        user_id
    );

CREATE INDEX IF NOT EXISTS idx_course_memberships_user_active
    ON course_memberships (
        user_id,
        is_active,
        course_id
    );

-- -------------------------------------------------------------------------
-- 4. Permisos para el rol propietario de la aplicación
-- -------------------------------------------------------------------------

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
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_memberships TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.courses_id_seq TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.course_memberships_id_seq TO %I',
            application_role
        );
        EXECUTE format(
            'GRANT SELECT ON TABLE public.schema_migrations TO %I',
            application_role
        );
    END IF;
END
$$;

-- -------------------------------------------------------------------------
-- 5. Registro de migración
-- -------------------------------------------------------------------------

INSERT INTO schema_migrations (version, description)
VALUES (
    'core07f_002_teacher_courses',
    'Rol Teacher y modelo mínimo de cursos/membresías para supervisión docente'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
