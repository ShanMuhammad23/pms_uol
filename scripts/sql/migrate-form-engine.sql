-- Form Engine v2 migration (idempotent)
-- Aligns an existing PMS database with schema.sql form builder requirements.

-- ---------------------------------------------------------------------------
-- Form sections hierarchy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_sections (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    parent_section_id BIGINT REFERENCES form_sections(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_sections_template
    ON form_sections(template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Form question assessment + layout columns
-- ---------------------------------------------------------------------------
ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS section_id BIGINT
    REFERENCES form_sections(id) ON DELETE CASCADE;

ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS self_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS hod_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS total_marks INT NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE form_questions
        ADD CONSTRAINT form_questions_total_marks_check
        CHECK (total_marks >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Appraisal runtime linkage
-- ---------------------------------------------------------------------------
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS template_id BIGINT
    REFERENCES form_templates(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Lookup indexes used by the form engine
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_lookup
    ON form_questions(template_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_options_lookup
    ON question_options(question_id);
