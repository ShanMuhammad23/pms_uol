-- Add per-employee self assessment disabled flag to employee_form_assignments
-- When TRUE, self assessment is disabled for that employee (direct assessment).
-- When FALSE (default), the employee can self-assess the form.

ALTER TABLE employee_form_assignments
    ADD COLUMN IF NOT EXISTS self_assessment_disabled BOOLEAN NOT NULL DEFAULT FALSE;
