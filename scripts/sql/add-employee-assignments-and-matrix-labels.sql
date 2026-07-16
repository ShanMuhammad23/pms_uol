-- Employee-specific form and matrix assignments + matrix labels per FY

-- 1) Allow multiple increment matrix sets per financial year by label.
ALTER TABLE performance_levels
    ADD COLUMN IF NOT EXISTS matrix_label VARCHAR(120) NOT NULL DEFAULT 'Default';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_level_per_year'
    ) THEN
        ALTER TABLE performance_levels
            DROP CONSTRAINT unique_level_per_year;
    END IF;
END $$;

ALTER TABLE performance_levels
    ADD CONSTRAINT unique_level_per_year_matrix
        UNIQUE (financial_year_id, matrix_label, name);

ALTER TABLE sub_category_increment_matrices
    ADD COLUMN IF NOT EXISTS matrix_label VARCHAR(120) NOT NULL DEFAULT 'Default';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_sub_category_quartile_increment'
    ) THEN
        ALTER TABLE sub_category_increment_matrices
            DROP CONSTRAINT unique_sub_category_quartile_increment;
    END IF;
END $$;

ALTER TABLE sub_category_increment_matrices
    ADD CONSTRAINT unique_sub_category_matrix_quartile_increment
        UNIQUE (
            financial_year_id,
            matrix_label,
            target_category,
            target_sub_category,
            performance_quartile_id
        );

-- 2) Employee-level performance matrix assignment (one assigned matrix label per FY).
CREATE TABLE IF NOT EXISTS employee_performance_matrix_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    matrix_label VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_matrix_assignment_per_year
        UNIQUE (employee_id, financial_year_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_performance_matrix_assignments_year
    ON employee_performance_matrix_assignments(financial_year_id);

CREATE INDEX IF NOT EXISTS idx_employee_performance_matrix_assignments_employee
    ON employee_performance_matrix_assignments(employee_id);

-- 3) Employee-level form assignment (many templates can be assigned per employee).
CREATE TABLE IF NOT EXISTS employee_form_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_template_assignment UNIQUE (employee_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_form_assignments_employee
    ON employee_form_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_form_assignments_template
    ON employee_form_assignments(template_id);
