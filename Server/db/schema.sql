CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(150)
);

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    role_id     INT          NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_login  TIMESTAMP
);

CREATE TABLE auth_identities (
    id               SERIAL PRIMARY KEY,
    user_id          INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email_verified   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    last_used_at     TIMESTAMP
);

CREATE UNIQUE INDEX idx_auth_provider_subject
    ON auth_identities (provider, provider_subject);


CREATE TABLE sessions (
    id          UUID PRIMARY KEY,
    user_id     INT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP NOT NULL,
    ip_address  VARCHAR(45),
    user_agent  VARCHAR(255),
    is_active   BOOLEAN   NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);


CREATE TABLE hardware_profiles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL,
    cpu_model   VARCHAR(100),
    ram_gb      INT,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE submissions (
    id          SERIAL PRIMARY KEY,
    user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(100),
    language    VARCHAR(50),
    file_path   VARCHAR(255),
    code_hash   VARCHAR(64),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    status      VARCHAR(50)
);

CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_status  ON submissions(status);


CREATE TABLE executions (
    id                  SERIAL PRIMARY KEY,
    submission_id       INT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    hardware_profile_id INT REFERENCES hardware_profiles(id) ON DELETE SET NULL,
    started_at          TIMESTAMP,
    finished_at         TIMESTAMP,
    duration_ms         INT,
    status              VARCHAR(50),
    slave_id            VARCHAR(50),
    log_path            VARCHAR(255)
);

CREATE INDEX idx_executions_submission_id        ON executions(submission_id);
CREATE INDEX idx_executions_hardware_profile_id  ON executions(hardware_profile_id);


CREATE TABLE metrics (
    id           SERIAL PRIMARY KEY,
    execution_id INT          NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    value        DOUBLE PRECISION,
    unit         VARCHAR(20)
);

CREATE INDEX idx_metrics_execution_id ON metrics(execution_id);
CREATE INDEX idx_metrics_name         ON metrics(name);


CREATE TABLE audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);





