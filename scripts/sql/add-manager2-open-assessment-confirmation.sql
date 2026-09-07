-- Manager 2 open/free assessment confirmation tracking.
-- When Manager 2 confirms they have reviewed the open/free assessment
-- sections authored by Manager 1 and/or the employee, this timestamp is set.
-- NULL = not yet confirmed.

ALTER TABLE appraisals
  ADD COLUMN IF NOT EXISTS manager2_open_assessment_confirmed_at TIMESTAMPTZ;
