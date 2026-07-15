-- Entity-based org structure for users (idempotent)

CREATE TABLE IF NOT EXISTS entity_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE CHECK (code IN ('C1', 'C2', 'C3')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    entity_category_id INT NOT NULL REFERENCES entity_categories(id) ON DELETE RESTRICT,
    parent_entity_id BIGINT REFERENCES entities(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_entity_id);

INSERT INTO entity_categories (code)
VALUES ('C1'), ('C2'), ('C3')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS entity_id BIGINT REFERENCES entities(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);
