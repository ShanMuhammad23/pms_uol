-- =========================================================================
-- Additional Access: granular module-level permissions for individual users.
-- Supplements existing RBAC (system_role) without replacing it.
-- Only Super Admin can assign/modify these permissions.
-- =========================================================================

CREATE TABLE IF NOT EXISTS user_additional_access (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    access_level VARCHAR(20) NOT NULL,
    granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_module UNIQUE (user_id, module),
    CONSTRAINT chk_access_level CHECK (access_level IN ('VIEW_ONLY', 'EDIT'))
);

CREATE INDEX IF NOT EXISTS idx_user_additional_access_user
    ON user_additional_access(user_id);
