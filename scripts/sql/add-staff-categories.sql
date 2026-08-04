-- Create dynamic staff category tables
CREATE TABLE IF NOT EXISTS staff_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_sub_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    staff_category_id INT NOT NULL REFERENCES staff_categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_staff_sub_category_per_parent UNIQUE (staff_category_id, name)
);

-- Link users with dynamic staff category/sub-category
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS staff_category_id INT REFERENCES staff_categories(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS staff_sub_category_id INT REFERENCES staff_sub_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_users_staff_category_id ON users(staff_category_id);
CREATE INDEX IF NOT EXISTS idx_users_staff_sub_category_id ON users(staff_sub_category_id);
