-- Align DB with UoL annual performance Excel sheet columns (idempotent)

-- Employee master fields
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS designation VARCHAR(150),
    ADD COLUMN IF NOT EXISTS grade_group VARCHAR(50),
    ADD COLUMN IF NOT EXISTS date_of_joining DATE;

-- Cycle / appraisal scoring, eligibility, remarks, compensation
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS initial_score_numeric NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS credit_hrs_erp_score_adj NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS pub_oric_score_adj NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS calibration_factor NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS normalized_score NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS performance_quartile_id BIGINT REFERENCES performance_quartiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS uol_experience_years NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS is_eligible BOOLEAN,
    ADD COLUMN IF NOT EXISTS applicable_duration VARCHAR(100),
    ADD COLUMN IF NOT EXISTS remarks_evaluation TEXT,
    ADD COLUMN IF NOT EXISTS current_salary NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS previous_salary NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS applicable_salary_for_increment NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS applicable_matrix VARCHAR(150),
    ADD COLUMN IF NOT EXISTS increment_per_matrix NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS revised_salary NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS revised_salary_ro NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS hod_review_comments TEXT,
    ADD COLUMN IF NOT EXISTS remarks_compensation TEXT;

-- Ensure calibrated score column exists for Rating (N) / Normalized Score fallback
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS calibrated_score_numeric NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_appraisals_performance_quartile
    ON appraisals (performance_quartile_id);

-- Employee qualifications (1:N)
CREATE TABLE IF NOT EXISTS employee_qualifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(255) NOT NULL,
    year INT,
    subject VARCHAR(255),
    institute VARCHAR(255),
    country VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_qualifications_user
    ON employee_qualifications (user_id);
