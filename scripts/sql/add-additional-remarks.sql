-- Add form-level "Additional Remarks" configuration and appraisal-level storage
-- for overall assessment remarks entered by reporting managers (Manager 1 / Manager 2).
--
-- Form-level config:
--   additional_remarks_enabled on form_templates controls whether the
--   "Additional Remarks" section appears at the bottom of the assessment form.
--
-- Appraisal-level storage:
--   manager1_overall_remarks and manager2_overall_remarks store independent
--   overall remarks per manager. They are completely separate from question-level
--   remarks, HR approval, evaluation remarks, calibration, and scoring.

ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS additional_remarks_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS manager1_overall_remarks TEXT,
    ADD COLUMN IF NOT EXISTS manager2_overall_remarks TEXT;
