-- Assessment reminder tracking
-- Stores when the last reminder email was sent so the cron job can enforce
-- cooldowns (employees: 48h, managers: 3 days) without daily resends.

-- 1. Employee self-assessment reminders (per appraisal)
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS last_self_assessment_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN appraisals.last_self_assessment_reminder_at IS
  'When the last pending-self-assessment reminder email was sent for this appraisal. NULL if never reminded.';

-- 2. Manager digest reminders (per user — one digest covers all pending work)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_manager_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_manager_reminder_at IS
  'When the last manager pending-work reminder digest was sent. NULL if never reminded.';

CREATE INDEX IF NOT EXISTS idx_appraisals_self_assessment_reminder
    ON appraisals (status, last_self_assessment_reminder_at)
    WHERE status = 'PENDING_SELF_ASSESSMENT';

CREATE INDEX IF NOT EXISTS idx_users_manager_reminder
    ON users (last_manager_reminder_at)
    WHERE last_manager_reminder_at IS NOT NULL;
