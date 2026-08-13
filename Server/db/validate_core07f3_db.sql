\set ON_ERROR_STOP on

DO $$
DECLARE
    migration_count integer;
    delete_rule text;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'submissions'
          AND column_name = 'course_id'
    ) THEN
        RAISE EXCEPTION 'Falta submissions.course_id';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'submissions'
          AND indexname = 'idx_submissions_course_id'
    ) THEN
        RAISE EXCEPTION 'Falta idx_submissions_course_id';
    END IF;

    SELECT rc.delete_rule
      INTO delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = rc.constraint_name
       AND tc.constraint_schema = rc.constraint_schema
     WHERE tc.constraint_schema = 'public'
       AND tc.table_name = 'submissions'
       AND tc.constraint_name = 'fk_submissions_course_id';

    IF delete_rule IS NULL THEN
        RAISE EXCEPTION 'Falta FK fk_submissions_course_id';
    END IF;

    IF delete_rule <> 'SET NULL' THEN
        RAISE EXCEPTION
            'FK submissions.course_id debe usar SET NULL; actual=%',
            delete_rule;
    END IF;

    SELECT COUNT(*)
      INTO migration_count
      FROM schema_migrations
     WHERE version = 'core07f_003_submission_course_context';

    IF migration_count <> 1 THEN
        RAISE EXCEPTION
            'Falta registro core07f_003_submission_course_context';
    END IF;
END
$$;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'submissions'
  AND column_name = 'course_id';

SELECT
    COUNT(*) AS total_submissions,
    COUNT(*) FILTER (WHERE course_id IS NULL) AS without_course,
    COUNT(*) FILTER (WHERE course_id IS NOT NULL) AS with_course
FROM submissions;

SELECT
    version,
    description,
    applied_at
FROM schema_migrations
WHERE version = 'core07f_003_submission_course_context';

\echo 'CORE-07F-3 DB: PASS'
