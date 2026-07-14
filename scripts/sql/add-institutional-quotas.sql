-- Institutional quota targets per financial year (percent share by rating).
-- Used by the dashboard Calibration vs Quota chart.

CREATE TABLE IF NOT EXISTS institutional_quotas (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    rating performance_rating NOT NULL,
    quota_percent NUMERIC(5, 2) NOT NULL
        CHECK (quota_percent >= 0 AND quota_percent <= 100),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_institutional_quota_per_year_rating
        UNIQUE (financial_year_id, rating)
);

CREATE INDEX IF NOT EXISTS idx_institutional_quotas_financial_year
    ON institutional_quotas (financial_year_id);
