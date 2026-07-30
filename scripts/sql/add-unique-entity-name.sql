-- Prevent duplicate entity names under the same category + parent.
-- COALESCE treats NULL parent as 0 so root entities are unique too.
-- Run only after cleaning existing duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_entities_category_parent_name
ON entities (
  entity_category_id,
  COALESCE(parent_entity_id, 0),
  LOWER(TRIM(name))
);
