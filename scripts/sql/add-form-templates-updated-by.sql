-- Track who last updated a form template (user id → users.id).
-- Also applied automatically via ensureFormTemplateUpdatedByColumn() in lib/queries/forms.ts.

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id);
