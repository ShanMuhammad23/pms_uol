-- Return Submission workflow
-- Adds the two fields used to track that a submission was returned to a
-- lower workflow level (Manager 2, Manager 1, or Employee) by HR / Board /
-- Super Admin, along with the reason provided.
--
-- The return destination itself is NOT stored as a separate field — it is
-- represented by the existing appraisal status (PENDING_HEAD_REVIEW for a
-- manager return, PENDING_SELF_ASSESSMENT for an employee return).

-- 1. Add the new columns (idempotent)
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS is_returned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS return_reason TEXT;

COMMENT ON COLUMN appraisals.is_returned IS
  'TRUE when the submission was returned to a lower workflow level by HR/Board/Super Admin. Reset to FALSE when the submission advances normally again.';
COMMENT ON COLUMN appraisals.return_reason IS
  'Reason provided when returning the submission to a lower workflow level. NULL when the submission has not been returned.';
