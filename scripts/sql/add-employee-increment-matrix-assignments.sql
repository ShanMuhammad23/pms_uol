-- Employee-level increment matrix assignment + remove category/subcategory requirement

-- 1) Make target_category and target_sub_category nullable on sub_category_increment_matrices
ALTER TABLE sub_category_increment_matrices
    ALTER COLUMN target_category DROP NOT NULL,
    ALTER COLUMN target_sub_category DROP NOT NULL;

-- 2) Drop old unique constraint that includes category/subcategory and create new one without them
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_sub_category_matrix_quartile_increment'
    ) THEN
        ALTER TABLE sub_category_increment_matrices
            DROP CONSTRAINT unique_sub_category_matrix_quartile_increment;
    END IF;
END $$;

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
    ADD CONSTRAINT unique_increment_matrix_quartile
        UNIQUE (financial_year_id, matrix_label, performance_quartile_id);

-- 3) Employee-level increment matrix assignment (one assigned increment matrix label per FY per employee)
CREATE TABLE IF NOT EXISTS employee_increment_matrix_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    matrix_label VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_increment_matrix_per_year
        UNIQUE (employee_id, financial_year_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_increment_matrix_assignments_year
    ON employee_increment_matrix_assignments(financial_year_id);

CREATE INDEX IF NOT EXISTS idx_employee_increment_matrix_assignments_employee
    ON employee_increment_matrix_assignments(employee_id);
