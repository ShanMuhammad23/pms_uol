-- Increase text length limits for form/section titles.
-- Previously VARCHAR(150), which caused 500 errors when admins entered
-- longer section or form titles. Safe to re-run (idempotent).

ALTER TABLE form_sections
  ALTER COLUMN title TYPE VARCHAR(500);

ALTER TABLE form_templates
  ALTER COLUMN title TYPE VARCHAR(500);
