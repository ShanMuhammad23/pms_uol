-- Per-user Manager 2 assignment (Manager 1 remains users.head_id)

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS manager_2_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_head_id ON users (head_id);
CREATE INDEX IF NOT EXISTS idx_users_manager_2_id ON users (manager_2_id);

COMMENT ON COLUMN users.head_id IS 'Manager 1 — direct reviewing manager for appraisals';
COMMENT ON COLUMN users.manager_2_id IS 'Manager 2 — second-level reviewing manager for appraisals';

-- Seed Manager 2 from Manager 1's head where still unset (legacy hierarchy).
UPDATE users u
SET manager_2_id = m1.head_id
FROM users m1
WHERE u.head_id = m1.id
  AND u.manager_2_id IS NULL
  AND m1.head_id IS NOT NULL
  AND m1.head_id <> u.id
  AND m1.head_id <> u.head_id;
