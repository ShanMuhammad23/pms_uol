-- Per-user Manager 2 assignment (Manager 1 remains users.head_id)

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS manager_2_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_head_id ON users (head_id);
CREATE INDEX IF NOT EXISTS idx_users_manager_2_id ON users (manager_2_id);

COMMENT ON COLUMN users.head_id IS 'Manager 1 — direct reviewing manager for appraisals';
COMMENT ON COLUMN users.manager_2_id IS 'Manager 2 — second-level reviewing manager for appraisals';

-- 1) Prefer Manager 1's own head (person hierarchy), when present.
UPDATE users u
SET manager_2_id = m1.head_id
FROM users m1
WHERE u.head_id = m1.id
  AND u.manager_2_id IS NULL
  AND m1.head_id IS NOT NULL
  AND m1.head_id <> u.id
  AND m1.head_id <> u.head_id;

-- 2) Otherwise derive Manager 2 from Manager 1's eligible parent-entity head
--    (skip C0 nodes), matching the legacy level-2 review walk.
WITH RECURSIVE climb AS (
  SELECT
    u.id AS employee_id,
    u.head_id AS manager_1_id,
    e.parent_entity_id AS parent_id,
    pec.code AS parent_code,
    1 AS depth
  FROM users u
  INNER JOIN users m1 ON m1.id = u.head_id
  INNER JOIN entities e ON e.id = m1.entity_id
  LEFT JOIN entities pe ON pe.id = e.parent_entity_id
  LEFT JOIN entity_categories pec ON pec.id = pe.entity_category_id
  WHERE u.manager_2_id IS NULL
    AND u.head_id IS NOT NULL

  UNION ALL

  SELECT
    c.employee_id,
    c.manager_1_id,
    pe.parent_entity_id AS parent_id,
    pec.code AS parent_code,
    c.depth + 1
  FROM climb c
  INNER JOIN entities pe ON pe.id = c.parent_id
  LEFT JOIN entity_categories pec ON pec.id = pe.entity_category_id
  WHERE c.parent_id IS NOT NULL
    AND c.depth < 8
    AND COALESCE(c.parent_code, 'C0') = 'C0'
),
eligible_parent AS (
  SELECT DISTINCT ON (employee_id)
    employee_id,
    manager_1_id,
    parent_id AS parent_entity_id
  FROM climb
  WHERE parent_id IS NOT NULL
    AND COALESCE(parent_code, '') <> 'C0'
  ORDER BY employee_id, depth ASC
),
resolved AS (
  SELECT
    ep.employee_id,
    h.id AS manager_2_id
  FROM eligible_parent ep
  INNER JOIN LATERAL (
    SELECT hu.id
    FROM users hu
    WHERE hu.entity_id = ep.parent_entity_id
      AND hu.is_active = TRUE
      AND hu.system_role IN ('MANAGER', 'SUPER_ADMIN', 'HR')
      AND hu.id <> ep.manager_1_id
      AND hu.id <> ep.employee_id
    ORDER BY
      CASE hu.system_role
        WHEN 'MANAGER' THEN 0
        WHEN 'SUPER_ADMIN' THEN 1
        ELSE 2
      END,
      hu.id
    LIMIT 1
  ) h ON TRUE
)
UPDATE users u
SET manager_2_id = resolved.manager_2_id
FROM resolved
WHERE u.id = resolved.employee_id
  AND u.manager_2_id IS NULL;
