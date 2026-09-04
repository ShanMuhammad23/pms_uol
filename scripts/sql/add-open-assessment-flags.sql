-- Add per-section self/HOD assessment flags for open-assessment sections.
-- These mirror the per-question self_assessment_enabled / hod_assessment_enabled
-- columns, allowing HR to control who authors questions in an open-assessment
-- section. Safe to re-run (idempotent).

ALTER TABLE form_sections
  ADD COLUMN IF NOT EXISTS self_assessment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS hod_assessment_enabled BOOLEAN NOT NULL DEFAULT TRUE;
