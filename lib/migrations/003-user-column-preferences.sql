-- User-specific column width preferences for resizable table columns
CREATE TABLE IF NOT EXISTS user_column_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_key VARCHAR(100) NOT NULL,
    column_widths JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_table_key UNIQUE (user_id, table_key)
);

CREATE INDEX IF NOT EXISTS idx_user_column_prefs_user
    ON user_column_preferences (user_id);
