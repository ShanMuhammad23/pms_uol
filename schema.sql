-- =========================================================================
-- UNIVERSITY OF LAHORE (UOL) - PERFORMANCE MANAGEMENT SYSTEM (PMS) SCHEMA
-- Target Database: PostgreSQL 15+
-- Optimized for: Next.js (App Router), Prisma/Drizzle ORM, and Cursor AI Context
-- =========================================================================

-- 1. ENUMS (System-Wide Constraints & Strict Workflow State Machine)
CREATE TYPE user_role AS ENUM (
    'EMPLOYEE', 
    'HEAD', 
    'HR', 
    'BOARD', 
    'SUPER_ADMIN' -- Global access bypass role
);

CREATE TYPE employee_category AS ENUM (
    'ACADEMIC', 
    'SUPPORT_STAFF', 
    'BLUE_COLLAR', 
    'ADMINISTRATION' -- Category dedicated for Super Admins / System IT
);

CREATE TYPE sub_category AS ENUM (
    -- Academic Tiers
    'FACULTY_MEMBER', 'HOD', 'DEAN',                  
    -- Support Staff Tiers
    'PROFESSIONAL', 'SEMI_PROFESSIONAL', 'GENERAL',   
    -- Blue-Collar Tiers
    'SKILLED', 'SEMI_SKILLED', 'BLUE_COLLAR_GENERAL', 
    -- Super Admin Tiers
    'SYSTEM_ADMIN'                                    
);

CREATE TYPE appraisal_status AS ENUM (
    'PENDING_SELF_ASSESSMENT', -- Step 1: Self Assessment Form [cite: 6, 7]
    'PENDING_HEAD_REVIEW',     -- Step 2: Line Manager Review & Confirmation [cite: 9]
    'PENDING_HR_CALIBRATION',   -- Step 3: HR Rating Alignment Phase [cite: 10, 30]
    'PENDING_BOARD_APPROVAL',  -- Step 4: Final Committee/Board Review [cite: 12, 53]
    'APPROVED',                -- Step 5: Verified & Saved to DB (SAP Simulation Bypass) [cite: 13, 63]
    'COMPLETED'                -- Step 6: Feedback Discussion Completed with Employee [cite: 66, 67]
);

CREATE TYPE performance_rating AS ENUM (
    'UNSATISFACTORY', 
    'IMPROVEMENT_NEEDED', 
    'STRONG', 
    'EXCELLENT', 
    'OUTSTANDING'
);


-- 2. CORE ORGANIZATIONAL TABLES
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'Pharmacy', 'Engineering' [cite: 86]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 3. USER MANAGEMENT (Role-Aware Identity Engine)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(30) UNIQUE NOT NULL, -- UOL Unique Official ID
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    system_role user_role NOT NULL DEFAULT 'EMPLOYEE',
    emp_category employee_category NOT NULL,
    emp_sub_category sub_category NOT NULL,
    
    -- Nullable structural fields to accommodate Super Admin global flexibility
    department_id INT REFERENCES departments(id) ON DELETE RESTRICT,
    head_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Immediate Evaluation Supervisor
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 4. PERFORMANCE LIFECYCLE & HISTORICAL CYCLES
CREATE TABLE appraisal_cycles (
    id SERIAL PRIMARY KEY,
    fiscal_year INT NOT NULL UNIQUE, -- Multi-year tracking support (e.g., 2026)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE, -- Ensures only 1 review cycle accepts user input simultaneously
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 5. APPRAISALS MASTER DATA (Main Process Engine)
CREATE TABLE appraisals (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE RESTRICT,
    status appraisal_status NOT NULL DEFAULT 'PENDING_SELF_ASSESSMENT',
    
    -- Score Tracking Phase 1: Score & Rating (1) - System/Head Generated [cite: 17, 21]
    initial_score_numeric NUMERIC(5, 2), 
    initial_rating performance_rating,   
    
    -- Score Tracking Phase 2: Score & Rating (2) - Adjusted during HR Calibration [cite: 26, 30, 52]
    calibrated_score_numeric NUMERIC(5, 2), 
    calibrated_rating performance_rating,   
    
    -- Compensation Matrix Tracking (Local Persistent Storage) [cite: 8, 11]
    calculated_increment_percentage NUMERIC(5, 2), -- Output of System Quartile Logic [cite: 22, 61]
    approved_increment_percentage   NUMERIC(5, 2), -- Confirmed/Adjusted final figure approved by Board [cite: 31, 53]
    effective_date DATE,
    
    -- Employee Feedback Details [cite: 66]
    employee_strengths TEXT,       -- Identified Strengths [cite: 73]
    employee_weaknesses TEXT,      -- Identified Areas of Improvement [cite: 74]
    committee_feedback TEXT,       -- Review Committee Summary Text [cite: 75, 76]
    next_year_targets TEXT,        -- Forward looking Goals [cite: 77]
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Structural Rule: An employee can only have one appraisal record per fiscal cycle
    CONSTRAINT unique_employee_per_cycle UNIQUE (employee_id, cycle_id)
);


-- 6. DYNAMIC FORMS DATA STORAGE
CREATE TABLE appraisal_forms (
    id BIGSERIAL PRIMARY KEY,
    appraisal_id BIGINT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE UNIQUE,
    filled_by_id BIGINT NOT NULL REFERENCES users(id), -- Employee, or Head (For Blue-Collar entries)
    
    -- Text fields for textual comments
    self_assessment_comments TEXT,
    head_review_comments TEXT,
    
    -- JSONB Schema-less payload handling custom criteria variations between Academic & Support Staff
    form_data JSONB NOT NULL, 
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 7. CONFIGURABLE APPRAISAL MATRICES (HR Control Interface)
CREATE TABLE increment_matrices (
    id SERIAL PRIMARY KEY,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    rating performance_rating NOT NULL,
    quartile INT NOT NULL CHECK (quartile BETWEEN 1 AND 4),
    recommended_increment_percentage NUMERIC(5, 2) NOT NULL,
    
    CONSTRAINT unique_matrix_entry UNIQUE (cycle_id, rating, quartile)
);


-- 8. SYSTEM DATA SECURITY AUDITING (Super Admin & HR Activity Tracking)
CREATE TABLE appraisal_logs (
    id BIGSERIAL PRIMARY KEY,
    appraisal_id BIGINT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    changed_by_id BIGINT NOT NULL REFERENCES users(id), -- Relates directly to user making structural updates
    action_performed VARCHAR(100) NOT NULL, -- e.g., 'HR_CALIBRATION_OVERRIDE', 'BOARD_INCREMENT_APPROVAL'
    old_value JSONB, -- Previous state snapshot
    new_value JSONB, -- Updated state snapshot
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 9. PERFORMANCE CRITICAL DDL INDEXES
CREATE INDEX idx_users_role_dept ON users(system_role, department_id);
CREATE INDEX idx_appraisals_cycle_status ON appraisals(cycle_id, status);
CREATE INDEX idx_appraisal_forms_data ON appraisal_forms USING gin (form_data); -- Speeds up query processing of JSON structures