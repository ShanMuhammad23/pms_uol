-- Link form templates to dynamic staff categories (decoupled from appraisal cycles)
ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS staff_category_id INT REFERENCES staff_categories(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS staff_sub_category_id INT REFERENCES staff_sub_categories(id) ON DELETE RESTRICT;

ALTER TABLE form_templates
    ALTER COLUMN cycle_id DROP NOT NULL,
    ALTER COLUMN target_category DROP NOT NULL,
    ALTER COLUMN target_sub_category DROP NOT NULL;

ALTER TABLE form_templates
    DROP CONSTRAINT IF EXISTS unique_target_form_per_cycle;

ALTER TABLE form_templates
    DROP CONSTRAINT IF EXISTS unique_form_per_staff_sub_category;

ALTER TABLE form_templates
    ADD CONSTRAINT unique_form_per_staff_sub_category
    UNIQUE (staff_category_id, staff_sub_category_id);

CREATE INDEX IF NOT EXISTS idx_form_templates_staff_category_id
    ON form_templates(staff_category_id);

CREATE INDEX IF NOT EXISTS idx_form_templates_staff_sub_category_id
    ON form_templates(staff_sub_category_id);
