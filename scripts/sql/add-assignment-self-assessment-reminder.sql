-- Track employee self-assessment reminders on the form assignment
-- (source of truth: form assigned → remind until self-assessment is done).

ALTER TABLE employee_form_assignments
    ADD COLUMN IF NOT EXISTS last_self_assessment_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN employee_form_assignments.last_self_assessment_reminder_at IS
  'When the last pending-self-assessment reminder was sent for this assignment. NULL if never reminded.';

-- Backfill from appraisals when a matching cycle appraisal already recorded a send.
UPDATE employee_form_assignments efa
SET last_self_assessment_reminder_at = ap.last_self_assessment_reminder_at
FROM appraisals ap
INNER JOIN form_templates ft ON ft.id = ap.template_id
WHERE efa.employee_id = ap.employee_id
  AND efa.template_id = ap.template_id
  AND ap.cycle_id = ft.cycle_id
  AND ap.last_self_assessment_reminder_at IS NOT NULL
  AND (
    efa.last_self_assessment_reminder_at IS NULL
    OR efa.last_self_assessment_reminder_at < ap.last_self_assessment_reminder_at
  );

CREATE INDEX IF NOT EXISTS idx_efa_self_assessment_reminder
    ON employee_form_assignments (last_self_assessment_reminder_at)
    WHERE last_self_assessment_reminder_at IS NOT NULL;
