-- Add a "code" column to form_templates.
-- The code is a user-defined short identifier for the form (e.g. "FAC-2026").
-- It is required (NOT NULL) and unique within the table.
ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS code VARCHAR(50) NOT NULL DEFAULT '';

-- Backfill any existing rows with an empty string (already the DEFAULT).
-- Enforce uniqueness after backfill.
CREATE UNIQUE INDEX IF NOT EXISTS form_templates_code_key
  ON form_templates (code)
  WHERE code <> '';
