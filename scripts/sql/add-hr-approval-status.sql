-- Decouple HR Approval Status from Remarks Evaluation
-- Adds a dedicated hr_approval_status column, backfills from existing markers,
-- and cleans the markers out of remarks_evaluation.

-- 1. Add the new column (idempotent)
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS hr_approval_status VARCHAR(20) DEFAULT 'pending';

COMMENT ON COLUMN appraisals.hr_approval_status IS
  'pending | approved | review_required — independent of remarks_evaluation';

-- 2. Backfill from existing text markers in remarks_evaluation
UPDATE appraisals
SET hr_approval_status = CASE
    WHEN remarks_evaluation IS NOT NULL AND remarks_evaluation LIKE '%[REVIEW REQUIRED]%' THEN 'review_required'
    WHEN remarks_evaluation IS NOT NULL AND remarks_evaluation LIKE '%[HR APPROVED]%' THEN 'approved'
    WHEN status IN ('PENDING_BOARD_APPROVAL', 'APPROVED', 'COMPLETED') THEN 'approved'
    ELSE 'pending'
END
WHERE hr_approval_status = 'pending'
   OR hr_approval_status IS NULL;

-- 3. Clean the markers out of remarks_evaluation (preserve all other text)
UPDATE appraisals
SET remarks_evaluation = BTRIM(
    REPLACE(
        REPLACE(remarks_evaluation, '[HR APPROVED]', ''),
        '[REVIEW REQUIRED]', ''
    )
)
WHERE remarks_evaluation IS NOT NULL
  AND (remarks_evaluation LIKE '%[HR APPROVED]%' OR remarks_evaluation LIKE '%[REVIEW REQUIRED]%');
