-- Free-text Role Category on employee master (not staff category)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_category VARCHAR(150);
