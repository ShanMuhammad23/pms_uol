-- Add appraisal-cycle window dates to financial_years (idempotent).
-- cycle_start_date: start of the FY appraisal window (historically 1 Jul).
-- ineligibility_date: DOJ after this date → Not Eligible.

ALTER TABLE financial_years
    ADD COLUMN IF NOT EXISTS cycle_start_date DATE,
    ADD COLUMN IF NOT EXISTS ineligibility_date DATE;

-- Backfill existing rows from historical UoL defaults (1 Jul prior year → 1 Apr of FY end year).
UPDATE financial_years
SET
    cycle_start_date = COALESCE(
        cycle_start_date,
        make_date(year - 1, 7, 1)
    ),
    ineligibility_date = COALESCE(
        ineligibility_date,
        make_date(year, 4, 1)
    )
WHERE cycle_start_date IS NULL
   OR ineligibility_date IS NULL;

ALTER TABLE financial_years
    ALTER COLUMN cycle_start_date SET NOT NULL,
    ALTER COLUMN ineligibility_date SET NOT NULL;

COMMENT ON COLUMN financial_years.cycle_start_date IS
  'Start of the appraisal cycle window for this financial year';
COMMENT ON COLUMN financial_years.ineligibility_date IS
  'Employees with date of joining after this date are Not Eligible';
