-- Header rows for performance and increment matrices (title + label per FY).

CREATE TABLE IF NOT EXISTS performance_matrix_defs (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    matrix_label VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_performance_matrix_def
        UNIQUE (financial_year_id, matrix_label)
);

CREATE INDEX IF NOT EXISTS idx_performance_matrix_defs_year
    ON performance_matrix_defs (financial_year_id);

INSERT INTO performance_matrix_defs (financial_year_id, matrix_label, title)
SELECT DISTINCT pl.financial_year_id, pl.matrix_label, pl.matrix_label
FROM performance_levels pl
ON CONFLICT (financial_year_id, matrix_label) DO NOTHING;

CREATE TABLE IF NOT EXISTS increment_matrix_defs (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    matrix_label VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_increment_matrix_def
        UNIQUE (financial_year_id, matrix_label)
);

CREATE INDEX IF NOT EXISTS idx_increment_matrix_defs_year
    ON increment_matrix_defs (financial_year_id);

INSERT INTO increment_matrix_defs (financial_year_id, matrix_label, title)
SELECT DISTINCT sim.financial_year_id, sim.matrix_label, sim.matrix_label
FROM sub_category_increment_matrices sim
ON CONFLICT (financial_year_id, matrix_label) DO NOTHING;
