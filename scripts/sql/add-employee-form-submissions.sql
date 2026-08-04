-- Allow appraisals tied directly to form templates (without appraisal cycle)
ALTER TABLE appraisals
    ALTER COLUMN cycle_id DROP NOT NULL;

ALTER TABLE appraisals
    DROP CONSTRAINT IF EXISTS unique_employee_per_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_per_cycle
    ON appraisals (employee_id, cycle_id)
    WHERE cycle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_template_appraisal
    ON appraisals (employee_id, template_id)
    WHERE template_id IS NOT NULL;
