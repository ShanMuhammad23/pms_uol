-- Cleanup: Remove remarks that were incorrectly copied from the previous
-- stage into the next reviewer's answers.
--
-- Problem: When self-assessment was completed, self remarks were copied
-- into Manager 1's draft. When Manager 1 approved, Manager 1's remarks
-- were copied into Manager 2's draft. Each reviewer should write their
-- own remarks, so these copied remarks need to be cleared.
--
-- Scope:
--   1. Submissions in Manager 1 review (status = PENDING_HEAD_REVIEW,
--      manager_level = 1): clear Manager 1's question-level remarks.
--   2. Submissions in Manager 2 review (status = PENDING_HEAD_REVIEW,
--      manager_level >= 2): clear Manager 2's question-level remarks.
--
-- Notes:
--   - Only question-level remarks (appraisal_answers.remarks) are cleared.
--   - Overall remarks (manager1_overall_remarks / manager2_overall_remarks)
--     are NOT touched — those are entered independently.
--   - Scores, ratings, and all other data are preserved.
--   - Self-assessment remarks are NOT touched.

-- 1. Clear Manager 1's remarks for submissions currently in Manager 1 review.
UPDATE appraisal_answers
SET remarks = NULL,
    updated_at = CURRENT_TIMESTAMP
FROM appraisals ap
JOIN users u ON u.id = ap.employee_id
WHERE appraisal_answers.appraisal_id = ap.id
  AND ap.status = 'PENDING_HEAD_REVIEW'
  AND ap.manager_level = 1
  AND appraisal_answers.filled_by_id = u.head_id
  AND appraisal_answers.remarks IS NOT NULL
  AND appraisal_answers.remarks != '';

-- 2. Clear Manager 2's remarks for submissions currently in Manager 2 review.
UPDATE appraisal_answers
SET remarks = NULL,
    updated_at = CURRENT_TIMESTAMP
FROM appraisals ap
JOIN users u ON u.id = ap.employee_id
WHERE appraisal_answers.appraisal_id = ap.id
  AND ap.status = 'PENDING_HEAD_REVIEW'
  AND ap.manager_level >= 2
  AND appraisal_answers.filled_by_id = u.manager_2_id
  AND appraisal_answers.remarks IS NOT NULL
  AND appraisal_answers.remarks != '';
