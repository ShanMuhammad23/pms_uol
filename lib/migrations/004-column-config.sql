-- Replace column_widths with full column_config JSONB
ALTER TABLE user_column_preferences
  DROP COLUMN IF EXISTS column_widths,
  ADD COLUMN IF NOT EXISTS column_config JSONB NOT NULL DEFAULT '{}'::jsonb;
