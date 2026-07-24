-- Add form-level self assessment setting to form_templates
-- When FALSE, the form skips the self-assessment stage and goes directly
-- to the reporting head / manager for review.

ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS self_assessment_enabled BOOLEAN NOT NULL DEFAULT TRUE;
