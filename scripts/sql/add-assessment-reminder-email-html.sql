-- Persist the last reminder email HTML for Super Admin hover preview.

ALTER TABLE employee_form_assignments
    ADD COLUMN IF NOT EXISTS last_self_assessment_reminder_html TEXT;

COMMENT ON COLUMN employee_form_assignments.last_self_assessment_reminder_html IS
  'HTML body of the last self-assessment reminder email sent for this assignment.';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_manager_reminder_html TEXT;

COMMENT ON COLUMN users.last_manager_reminder_html IS
  'HTML body of the last manager pending-work reminder digest sent to this user.';
