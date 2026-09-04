-- Remove text length limits on form/section titles.
-- Previously VARCHAR(150) then VARCHAR(500); now free text (no limit).
-- Safe to re-run (idempotent).

ALTER TABLE form_sections
  ALTER COLUMN title TYPE TEXT;

ALTER TABLE form_templates
  ALTER COLUMN title TYPE TEXT;
