-- PERFORMANCE SYSTEM
-- Gate 2 — hardware profiles, operational policies and measurement nodes
-- PostgreSQL 12+
--
-- This migration introduces the persistence model required for controlled
-- serial multi-node execution. It DOES NOT enable a second physical worker,
-- change the dispatcher, or backfill historical execution provenance.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    description VARCHAR(255),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- HARDWARE PROFILES
-- =====================================================================

ALTER TABLE hardware_profiles
    ADD COLUMN IF NOT EXISTS profile_key VARCHAR(64),
    ADD COLUMN IF NOT EXISTS cpu_vendor VARCHAR(64),
    ADD COLUMN IF NOT EXISTS architecture VARCHAR(64),
    ADD COLUMN IF NOT EXISTS logical_cpus INTEGER,
    ADD COLUMN IF NOT EXISTS capabilities JSONB
        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_hardware_profiles_profile_key'
          AND conrelid = 'hardware_profiles'::regclass
    ) THEN
        ALTER TABLE hardware_profiles
            ADD CONSTRAINT chk_hardware_profiles_profile_key
            CHECK (
                profile_key IS NULL
                OR (
                    BTRIM(profile_key) <> ''
                    AND profile_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_hardware_profiles_logical_cpus'
          AND conrelid = 'hardware_profiles'::regclass
    ) THEN
        ALTER TABLE hardware_profiles
            ADD CONSTRAINT chk_hardware_profiles_logical_cpus
            CHECK (
                logical_cpus IS NULL
                OR logical_cpus > 0
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_hardware_profiles_capabilities_object'
          AND conrelid = 'hardware_profiles'::regclass
    ) THEN
        ALTER TABLE hardware_profiles
            ADD CONSTRAINT chk_hardware_profiles_capabilities_object
            CHECK (
                jsonb_typeof(capabilities) = 'object'
            );
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_hardware_profiles_profile_key
ON hardware_profiles (profile_key)
WHERE profile_key IS NOT NULL;


-- =====================================================================
-- HARDWARE PROFILE OPERATIONAL POLICIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS hardware_profile_policies (
    id SERIAL PRIMARY KEY,

    hardware_profile_id INT NOT NULL
        REFERENCES hardware_profiles (id)
        ON DELETE RESTRICT,

    benchmark VARCHAR(16) NOT NULL,
    execution_profile VARCHAR(20) NOT NULL,

    minimum_input INTEGER NOT NULL,
    default_input INTEGER NOT NULL,
    recommended_max_input INTEGER NOT NULL,
    hard_max_input INTEGER NOT NULL,
    input_step INTEGER NOT NULL,

    operational_timeout_seconds INTEGER NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_hardware_profile_policy
        UNIQUE (
            hardware_profile_id,
            benchmark,
            execution_profile
        ),

    CONSTRAINT chk_hardware_profile_policy_benchmark
        CHECK (
            benchmark IN ('LCS', 'CAMM', 'SIZE')
        ),

    CONSTRAINT chk_hardware_profile_policy_execution_profile
        CHECK (
            execution_profile IN (
                'QUICK',
                'BALANCED',
                'EXHAUSTIVE',
                'CUSTOM'
            )
        ),

    CONSTRAINT chk_hardware_profile_policy_ranges
        CHECK (
            minimum_input > 0
            AND default_input >= minimum_input
            AND recommended_max_input >= default_input
            AND hard_max_input >= recommended_max_input
        ),

    CONSTRAINT chk_hardware_profile_policy_step
        CHECK (
            input_step > 0
        ),

    CONSTRAINT chk_hardware_profile_policy_timeout
        CHECK (
            operational_timeout_seconds > 0
        )
);

CREATE INDEX IF NOT EXISTS
    idx_hardware_profile_policies_lookup
ON hardware_profile_policies (
    hardware_profile_id,
    benchmark,
    execution_profile,
    is_active
);


-- =====================================================================
-- PHYSICAL MEASUREMENT NODES
-- =====================================================================

CREATE TABLE IF NOT EXISTS measurement_nodes (
    id SERIAL PRIMARY KEY,

    node_key VARCHAR(64) NOT NULL,
    display_name VARCHAR(100) NOT NULL,

    hardware_profile_id INT NOT NULL
        REFERENCES hardware_profiles (id)
        ON DELETE RESTRICT,

    institutional_priority INTEGER NOT NULL DEFAULT 0,

    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_validation_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_draining BOOLEAN NOT NULL DEFAULT FALSE,

    last_heartbeat_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_measurement_nodes_node_key
        UNIQUE (node_key),

    CONSTRAINT chk_measurement_nodes_node_key
        CHECK (
            BTRIM(node_key) <> ''
            AND node_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'
        ),

    CONSTRAINT chk_measurement_nodes_display_name
        CHECK (
            BTRIM(display_name) <> ''
        ),

    CONSTRAINT chk_measurement_nodes_priority
        CHECK (
            institutional_priority >= 0
        )
);

CREATE INDEX IF NOT EXISTS
    idx_measurement_nodes_selector
ON measurement_nodes (
    is_enabled,
    is_draining,
    is_validation_only,
    institutional_priority DESC,
    id
);

CREATE INDEX IF NOT EXISTS
    idx_measurement_nodes_last_heartbeat
ON measurement_nodes (last_heartbeat_at);


-- =====================================================================
-- EXPERIMENT / SUBMISSION NODE AFFINITY
-- =====================================================================

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS assigned_measurement_node_id INTEGER,
    ADD COLUMN IF NOT EXISTS measurement_node_mode VARCHAR(16);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_submissions_assigned_measurement_node'
          AND conrelid = 'submissions'::regclass
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT fk_submissions_assigned_measurement_node
            FOREIGN KEY (assigned_measurement_node_id)
            REFERENCES measurement_nodes (id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_submissions_measurement_node_assignment'
          AND conrelid = 'submissions'::regclass
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT chk_submissions_measurement_node_assignment
            CHECK (
                (
                    measurement_node_mode IS NULL
                    AND assigned_measurement_node_id IS NULL
                )
                OR measurement_node_mode = 'AUTO'
                OR (
                    measurement_node_mode = 'PINNED'
                    AND assigned_measurement_node_id IS NOT NULL
                )
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
    idx_submissions_assigned_measurement_node
ON submissions (assigned_measurement_node_id)
WHERE assigned_measurement_node_id IS NOT NULL;


-- =====================================================================
-- EXECUTION NODE PROVENANCE
-- =====================================================================

ALTER TABLE executions
    ADD COLUMN IF NOT EXISTS measurement_node_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_executions_measurement_node'
          AND conrelid = 'executions'::regclass
    ) THEN
        ALTER TABLE executions
            ADD CONSTRAINT fk_executions_measurement_node
            FOREIGN KEY (measurement_node_id)
            REFERENCES measurement_nodes (id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
    idx_executions_measurement_node_id
ON executions (measurement_node_id)
WHERE measurement_node_id IS NOT NULL;


-- =====================================================================
-- APPLICATION ROLE PRIVILEGES
-- =====================================================================

DO $$
DECLARE
    application_role name;
    target_schema name;
BEGIN
    /*
     * Resolve the same users relation that the migration sees through
     * search_path. In production this is normally public; in isolated
     * migration tests it can be a disposable schema.
     */
    SELECT
        n.nspname,
        pg_get_userbyid(c.relowner)
      INTO
        target_schema,
        application_role
      FROM pg_class c
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
     WHERE c.oid = 'users'::regclass;

    IF application_role IS NOT NULL
       AND target_schema IS NOT NULL THEN

        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE ON TABLE %I.hardware_profiles TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.hardware_profiles_id_seq TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE ON TABLE %I.hardware_profile_policies TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.hardware_profile_policies_id_seq TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE ON TABLE %I.measurement_nodes TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.measurement_nodes_id_seq TO %I',
            target_schema,
            application_role
        );

        EXECUTE format(
            'GRANT SELECT ON TABLE %I.schema_migrations TO %I',
            target_schema,
            application_role
        );
    END IF;
END
$$;


-- =====================================================================
-- SCHEMA VERSION
-- =====================================================================

INSERT INTO schema_migrations (
    version,
    description
)
VALUES (
    'multinode_008_measurement_nodes_hardware_policies',
    'Perfiles y políticas operacionales de hardware, nodos físicos y procedencia serial de ejecuciones'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
