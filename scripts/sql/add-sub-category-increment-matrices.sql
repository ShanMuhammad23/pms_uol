-- Sub-category increment matrices (idempotent)
-- Links employee category/sub-category to performance quartiles with increment %.

CREATE TABLE IF NOT EXISTS sub_category_increment_matrices (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    target_category employee_category NOT NULL,
    target_sub_category sub_category NOT NULL,
    performance_quartile_id BIGINT NOT NULL REFERENCES performance_quartiles(id) ON DELETE CASCADE,
    increment_percentage NUMERIC(5, 2) NOT NULL
        CHECK (increment_percentage BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_sub_category_quartile_increment
        UNIQUE (financial_year_id, target_category, target_sub_category, performance_quartile_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_category_increment_matrices_financial_year
    ON sub_category_increment_matrices(financial_year_id);

CREATE INDEX IF NOT EXISTS idx_sub_category_increment_matrices_quartile
    ON sub_category_increment_matrices(performance_quartile_id);
