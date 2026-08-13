\set ON_ERROR_STOP on

DO $$
DECLARE
    teacher_count integer;
    migration_count integer;
    max_role_id bigint;
    sequence_value bigint;
BEGIN
    SELECT COUNT(*)
      INTO teacher_count
      FROM roles
     WHERE name = 'Teacher';

    IF teacher_count <> 1 THEN
        RAISE EXCEPTION
            'Teacher role esperado exactamente una vez; encontrado %',
            teacher_count;
    END IF;

    IF to_regclass('public.courses') IS NULL THEN
        RAISE EXCEPTION 'Falta tabla public.courses';
    END IF;

    IF to_regclass('public.course_memberships') IS NULL THEN
        RAISE EXCEPTION 'Falta tabla public.course_memberships';
    END IF;

    SELECT COUNT(*)
      INTO migration_count
      FROM schema_migrations
     WHERE version = 'core07f_002_teacher_courses';

    IF migration_count <> 1 THEN
        RAISE EXCEPTION
            'Falta registro core07f_002_teacher_courses';
    END IF;

    SELECT MAX(id)
      INTO max_role_id
      FROM roles;

    SELECT last_value
      INTO sequence_value
      FROM roles_id_seq;

    IF sequence_value < max_role_id THEN
        RAISE EXCEPTION
            'roles_id_seq desincronizada: last_value %, max(id) %',
            sequence_value,
            max_role_id;
    END IF;
END
$$;

SELECT
    id,
    name,
    description
FROM roles
ORDER BY id;

SELECT
    last_value,
    is_called
FROM roles_id_seq;

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'courses',
      'course_memberships'
  )
ORDER BY table_name;

SELECT
    version,
    description,
    applied_at
FROM schema_migrations
WHERE version = 'core07f_002_teacher_courses';

SELECT
    COUNT(*) AS courses,
    (SELECT COUNT(*) FROM course_memberships)
        AS memberships
FROM courses;

\echo 'CORE-07F-2 DB: PASS'
