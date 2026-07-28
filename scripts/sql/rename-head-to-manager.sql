-- Rename user_role enum value 'HEAD' to 'MANAGER'
-- Run this migration against existing databases.

ALTER TYPE user_role RENAME VALUE 'HEAD' TO 'MANAGER';
