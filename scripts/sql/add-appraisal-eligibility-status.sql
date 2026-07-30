-- Persist FY-scoped eligibility status on appraisals (idempotent)

ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS applicable_duration_factor NUMERIC(3, 1);

COMMENT ON COLUMN appraisals.eligibility_status IS
  'Fully Eligible | Partially Eligible | Not Eligible — computed for the appraisal cycle financial year';

COMMENT ON COLUMN appraisals.applicable_duration_factor IS
  '1 = full year, 0 = not eligible, otherwise months-to-FY-end / 12';
