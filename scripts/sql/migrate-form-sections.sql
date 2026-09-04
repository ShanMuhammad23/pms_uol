-- Form sections hierarchy for the Form Builder
-- Safe to re-run (idempotent)

CREATE TABLE IF NOT EXISTS form_sections (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    parent_section_id BIGINT REFERENCES form_sections(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_sections_template
    ON form_sections(template_id, sort_order);

ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS section_id BIGINT
    REFERENCES form_sections(id) ON DELETE CASCADE;
