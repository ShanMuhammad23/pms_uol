-- Dual manager review: track which manager level is currently reviewing.
ALTER TABLE appraisals
    ADD COLUMN IF NOT EXISTS manager_level INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_appraisals_manager_level
    ON appraisals (status, manager_level);
