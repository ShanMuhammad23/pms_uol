-- Create direct_score_entry_assignments table
-- Marks employees for direct score entry without any form assignment,
-- self-assessment, or manager review workflow.
-- Authorised users (HR, Board, Super Admin) can enter scores directly in the dashboard.

CREATE TABLE IF NOT EXISTS direct_score_entry_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_direct_score_entry_assignment UNIQUE (employee_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_score_entry_assignments_employee
    ON direct_score_entry_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_direct_score_entry_assignments_cycle
    ON direct_score_entry_assignments(cycle_id);
