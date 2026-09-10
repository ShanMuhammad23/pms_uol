-- Persist FY-scoped eligibility status on appraisals (idempotent)

ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS applicable_duration_factor NUMERIC(8, 6);

-- Widen existing installs that still use NUMERIC(3, 1) (1-decimal rounding).
ALTER TABLE appraisals
    ALTER COLUMN applicable_duration_factor TYPE NUMERIC(8, 6);

COMMENT ON COLUMN appraisals.eligibility_status IS
  'Fully Eligible | Partially Eligible | Not Eligible — computed for the appraisal cycle financial year';

COMMENT ON COLUMN appraisals.applicable_duration_factor IS
  '1 = full year, 0 = not eligible, otherwise inclusive days DOJ to FY-end / 365 (exact, not rounded)';
