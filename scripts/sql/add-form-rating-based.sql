-- Rating-based forms: score = (selected rating / scale max) × question weight.
-- Absolute-score forms are unchanged (points entered directly, max = total_marks).

ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS rating_based BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS form_rating_scales (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    max_value NUMERIC(8, 2) NOT NULL DEFAULT 5 CHECK (max_value > 0),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_rating_scales_template
    ON form_rating_scales(template_id);

CREATE TABLE IF NOT EXISTS form_rating_scale_options (
    id BIGSERIAL PRIMARY KEY,
    scale_id BIGINT NOT NULL REFERENCES form_rating_scales(id) ON DELETE CASCADE,
    option_label VARCHAR(255) NOT NULL,
    rating_value NUMERIC(8, 2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_form_rating_scale_options_scale
    ON form_rating_scale_options(scale_id);

ALTER TABLE form_questions
    ADD COLUMN IF NOT EXISTS rating_scale_id BIGINT REFERENCES form_rating_scales(id) ON DELETE SET NULL;

ALTER TABLE appraisal_answers
    ADD COLUMN IF NOT EXISTS rating_value NUMERIC(8, 2);

ALTER TABLE appraisal_answers
    ALTER COLUMN points_earned TYPE NUMERIC(12, 2)
    USING points_earned::numeric;
