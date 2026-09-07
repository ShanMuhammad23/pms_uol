-- Track how many reminder emails were successfully sent (for Super Admin listing).

ALTER TABLE employee_form_assignments
    ADD COLUMN IF NOT EXISTS self_assessment_reminder_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN employee_form_assignments.self_assessment_reminder_count IS
  'Number of self-assessment reminder emails successfully sent for this assignment.';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS manager_reminder_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.manager_reminder_count IS
  'Number of manager pending-work reminder digests successfully sent to this user.';

-- Backfill: anyone already marked as reminded at least once.
UPDATE employee_form_assignments
SET self_assessment_reminder_count = 1
WHERE last_self_assessment_reminder_at IS NOT NULL
  AND self_assessment_reminder_count = 0;

UPDATE users
SET manager_reminder_count = 1
WHERE last_manager_reminder_at IS NOT NULL
  AND manager_reminder_count = 0;
