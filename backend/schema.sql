CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT,
    tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
    usage_count INT DEFAULT 0,
    usage_limit INT DEFAULT 20,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'deleted')),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    CONSTRAINT users_admin_email_only CHECK (role <> 'admin' OR lower(email) = 'admin150905@gmail.com'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_role_idx ON users (role) WHERE role = 'admin';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_allowed;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE users ADD CONSTRAINT users_tier_allowed CHECK (tier IN ('free', 'pro', 'business', 'enterprise'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ;
UPDATE users SET status = 'active' WHERE status IN ('Hoạt động', 'Ho?t ??ng', 'hoat dong');
UPDATE users SET status = 'suspended' WHERE status IN ('Tạm khóa', 'T?m khóa', 'bị khóa', 'đã khóa');
UPDATE users SET status = 'pending' WHERE status IN ('Chờ xác minh', 'Ch? xác minh', 'cho xac minh');
UPDATE users SET status = 'inactive' WHERE status IN ('Không hoạt động', 'Không ho?t ??ng', 'khong hoat dong');
UPDATE users SET status = 'active' WHERE status NOT IN ('active', 'inactive', 'pending', 'suspended', 'deleted');
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'deleted'));

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    ip_address VARCHAR(80) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(120) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(80) DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(180) NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(40) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'member', 'viewer')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(30) DEFAULT 'active',
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'member', 'viewer'));
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    size VARCHAR(50),
    row_count INT,
    col_count INT,
    status VARCHAR(30) DEFAULT 'ready',
    error_message TEXT DEFAULT '',
    sha256 VARCHAR(64) DEFAULT '',
    mime_type VARCHAR(120) DEFAULT '',
    sheet_count INT DEFAULT 1,
    sheet_names JSONB DEFAULT '[]'::jsonb,
    columns_metadata JSONB DEFAULT '[]'::jsonb,
    duplicate_of_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    has_macros BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE files ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64) DEFAULT '';
ALTER TABLE files ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) DEFAULT '';
ALTER TABLE files ADD COLUMN IF NOT EXISTS sheet_count INT DEFAULT 1;
ALTER TABLE files ADD COLUMN IF NOT EXISTS sheet_names JSONB DEFAULT '[]'::jsonb;
ALTER TABLE files ADD COLUMN IF NOT EXISTS columns_metadata JSONB DEFAULT '[]'::jsonb;
ALTER TABLE files ADD COLUMN IF NOT EXISTS duplicate_of_file_id UUID REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS has_macros BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS data_label VARCHAR(80) DEFAULT 'File nguồn';
ALTER TABLE files ADD COLUMN IF NOT EXISTS category VARCHAR(60) DEFAULT 'source';
ALTER TABLE files ADD COLUMN IF NOT EXISTS version_number INT NOT NULL DEFAULT 1;
ALTER TABLE files ADD COLUMN IF NOT EXISTS parent_file_id UUID REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS files_user_sha_idx ON files(user_id, sha256);
CREATE INDEX IF NOT EXISTS files_workspace_idx ON files(workspace_id);
CREATE INDEX IF NOT EXISTS files_label_idx ON files(data_label);

CREATE TABLE IF NOT EXISTS output_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    output_type VARCHAR(30) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE output_files ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE output_files ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS output_files_user_idx ON output_files(user_id);
CREATE INDEX IF NOT EXISTS output_files_workspace_idx ON output_files(workspace_id);

CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL,
    action VARCHAR(255) NOT NULL,
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL,
    usage_date DATE NOT NULL,
    feature_name VARCHAR(50) NOT NULL,
    request_count INT NOT NULL DEFAULT 0,
    token_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, usage_date, feature_name)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tier VARCHAR(20) NOT NULL,
    feature_name VARCHAR(50) NOT NULL,
    model VARCHAR(80) NOT NULL DEFAULT '',
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'failed', 'blocked', 'quota_exceeded')),
    latency_ms INT NOT NULL DEFAULT 0,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_tier_audit (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    target_user_email_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    old_tier VARCHAR(20) NOT NULL,
    new_tier VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NOT NULL DEFAULT 'admin_update',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_code VARCHAR(30) NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
    note TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    tier VARCHAR(30) NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    entitlement JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    plan_id VARCHAR(40) REFERENCES plans(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount INT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'VND',
    status VARCHAR(30) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(40) NOT NULL DEFAULT 'manual',
    provider_transaction_id VARCHAR(180) DEFAULT '',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount INT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'VND',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    raw_webhook_payload_hash VARCHAR(64) DEFAULT '',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(40) NOT NULL,
    provider_event_id VARCHAR(180) NOT NULL,
    event_type VARCHAR(80) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'received',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    mapped_tier VARCHAR(20),
    raw_payload_hash VARCHAR(64) NOT NULL DEFAULT '',
    error_message TEXT DEFAULT '',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    old_value JSONB DEFAULT '{}'::jsonb,
    new_value JSONB DEFAULT '{}'::jsonb,
    reason VARCHAR(255) DEFAULT '',
    request_id VARCHAR(80) DEFAULT '',
    ip_address VARCHAR(80) DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(180) NOT NULL,
    dataset VARCHAR(180) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    total_cases INT NOT NULL DEFAULT 0,
    passed_cases INT NOT NULL DEFAULT 0,
    failed_cases INT NOT NULL DEFAULT 0,
    average_score NUMERIC(6, 3) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_quality_metrics (
    id BIGSERIAL PRIMARY KEY,
    eval_run_id UUID REFERENCES ai_eval_runs(id) ON DELETE CASCADE,
    feature_name VARCHAR(80) NOT NULL,
    case_name VARCHAR(180) NOT NULL,
    score NUMERIC(6, 3) NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    latency_ms INT NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_request_logs (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    method VARCHAR(12) NOT NULL,
    path VARCHAR(300) NOT NULL,
    status_code INT NOT NULL,
    latency_ms INT NOT NULL DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    dimensions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_date, metric_name, dimensions)
);

CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    type VARCHAR(60) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    payload JSONB DEFAULT '{}'::jsonb,
    error_message TEXT DEFAULT '',
    result_ref VARCHAR(255) DEFAULT '',
    output_id UUID REFERENCES output_files(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(180) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS job_queue_user_idx ON job_queue(user_id);
CREATE INDEX IF NOT EXISTS job_queue_workspace_idx ON job_queue(workspace_id);
CREATE INDEX IF NOT EXISTS job_queue_status_idx ON job_queue(status);
CREATE UNIQUE INDEX IF NOT EXISTS job_queue_idempotency_idx ON job_queue(idempotency_key) WHERE idempotency_key <> '';

CREATE TABLE IF NOT EXISTS saved_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT DEFAULT '',
    input_requirements JSONB DEFAULT '[]'::jsonb,
    steps JSONB DEFAULT '[]'::jsonb,
    outputs JSONB DEFAULT '[]'::jsonb,
    schedule JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_by_snapshot VARCHAR(150) DEFAULT '',
    last_run_at TIMESTAMPTZ,
    last_job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_workflows ADD COLUMN IF NOT EXISTS input_requirements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE saved_workflows ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '{}'::jsonb;
ALTER TABLE saved_workflows ADD COLUMN IF NOT EXISTS created_by_snapshot VARCHAR(150) DEFAULT '';
ALTER TABLE saved_workflows ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE saved_workflows ADD COLUMN IF NOT EXISTS last_job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS saved_workflows_user_idx ON saved_workflows(user_id);
CREATE INDEX IF NOT EXISTS saved_workflows_workspace_idx ON saved_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS saved_workflows_status_idx ON saved_workflows(status);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(40) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(120) NOT NULL,
    provider VARCHAR(50) DEFAULT 'excelai',
    key_hash TEXT,
    masked_key VARCHAR(80) NOT NULL,
    status VARCHAR(30) DEFAULT 'active',
    daily_usage INT DEFAULT 0,
    latency INT DEFAULT 0,
    error_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
    code VARCHAR(40) PRIMARY KEY,
    percent INT NOT NULL CHECK (percent BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(60) PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    owner VARCHAR(150),
    size VARCHAR(50),
    type VARCHAR(50),
    status VARCHAR(30),
    duration VARCHAR(30),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedbacks (
    id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(150),
    type VARCHAR(50),
    text TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'new',
    reply TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(60) PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(80),
    description TEXT,
    file VARCHAR(255),
    icon VARCHAR(20),
    color VARCHAR(40),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'warning',
    force_logout BOOLEAN DEFAULT true,
    countdown_seconds INT DEFAULT 60,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value)
VALUES ('chat_system_prompt', 'Bạn là ExcelAI — trợ lý AI chuyên gia về Microsoft Excel và Office tại Việt Nam.')
ON CONFLICT (key) DO NOTHING;
