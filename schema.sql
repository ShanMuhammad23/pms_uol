-- =========================================================================
-- UNIVERSITY OF LAHORE (UOL) - PERFORMANCE MANAGEMENT SYSTEM (PMS) SCHEMA
-- Version: 2.0 (Fully Dynamic Form Engine & Point Weightage Mechanics)
-- Target Database: PostgreSQL 15+
-- =========================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'HR', 'BOARD', 'SUPER_ADMIN');
CREATE TYPE employee_category AS ENUM ('ACADEMIC', 'SUPPORT_STAFF', 'BLUE_COLLAR', 'ADMINISTRATION');

CREATE TYPE sub_category AS ENUM (
    'FACULTY_MEMBER', 'HOD', 'DEAN',                  
    'PROFESSIONAL', 'SEMI_PROFESSIONAL', 'GENERAL',   
    'SKILLED', 'SEMI_SKILLED', 'BLUE_COLLAR_GENERAL', 
    'SYSTEM_ADMIN'                                    
);

CREATE TYPE appraisal_status AS ENUM (
    'PENDING_SELF_ASSESSMENT', 
    'PENDING_HEAD_REVIEW',     
    'PENDING_HR_CALIBRATION',   
    'PENDING_BOARD_APPROVAL',  
    'APPROVED',                
    'COMPLETED'                
);

CREATE TYPE performance_rating AS ENUM ('UNSATISFACTORY', 'IMPROVEMENT_NEEDED', 'STRONG', 'EXCELLENT', 'OUTSTANDING');

-- Supported Input Fields for the Form Builder
CREATE TYPE field_type AS ENUM ('TEXT', 'NUMBER', 'RADIO', 'CHECKBOX', 'SELECT', 'TEXTAREA');

-- 2. CORE ORGANIZATIONAL STRUCTURE
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(30) UNIQUE NOT NULL, -- SAP Code
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    designation VARCHAR(150), -- Designation
    role_category VARCHAR(150), -- Role Category (free text; not staff category)
    grade_group VARCHAR(50), -- Gp
    date_of_joining DATE, -- DOJ
    system_role user_role NOT NULL DEFAULT 'EMPLOYEE',
    emp_category employee_category NOT NULL, -- Legacy enum (forms routing)
    emp_sub_category sub_category NOT NULL,
    department_id INT REFERENCES departments(id) ON DELETE RESTRICT,
    head_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Manager 1
    manager_2_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Manager 2
    is_manager_eligible BOOLEAN NOT NULL DEFAULT FALSE, -- Designates eligibility for Manager 1/2 assignment
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appraisal_cycles (
    id SERIAL PRIMARY KEY,
    fiscal_year INT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- NEW MODULE: DYNAMIC GOOGLE-FORMS STYLE TEMPLATE BUILDER
-- =========================================================================

-- Form Layout Definition Map
-- Forms are assigned to employees via employee_form_assignments (not by category).
-- target_category / target_sub_category remain for legacy compatibility.
CREATE TABLE form_templates (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL, -- e.g., 'Annual Faculty Evaluation Form'
    description TEXT,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    
    -- Legacy fields (forms are no longer routed by category)
    target_category employee_category NOT NULL, -- Academic | Supportive | Blue Collar
    target_sub_category sub_category NOT NULL,  -- General | Skilled | Professional
    
    -- When FALSE, the form skips self-assessment and goes directly to manager review
    self_assessment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_target_form_per_cycle UNIQUE (cycle_id, target_category, target_sub_category)
);

-- Form sections and subsections (parent_section_id NULL = top-level section)
CREATE TABLE form_sections (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    parent_section_id BIGINT REFERENCES form_sections(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual Form Questions
CREATE TABLE form_questions (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES form_sections(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    input_type field_type NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0, -- Controls UI sequence layout on frontend
    self_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    hod_assessment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    total_marks INT NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Point Weightage Matrix Options (For Radio, Checkbox, Select selections)
CREATE TABLE question_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
    option_label VARCHAR(255) NOT NULL, -- e.g., 'Exceeds Expectations', '10+', 'Yes'
    points_assigned INT NOT NULL DEFAULT 0, -- The point engine score weight
    sort_order INT NOT NULL DEFAULT 0
);

-- Employee-level form assignment (many templates can be assigned per employee).
CREATE TABLE employee_form_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    self_assessment_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_template_assignment UNIQUE (employee_id, template_id)
);

CREATE INDEX idx_employee_form_assignments_employee
    ON employee_form_assignments(employee_id);

CREATE INDEX idx_employee_form_assignments_template
    ON employee_form_assignments(template_id);

-- Direct Score Entry assignments — employees marked for direct score entry
-- without any form assignment, self-assessment, or manager review workflow.
-- Authorised users (HR, Board, Super Admin) can enter scores directly in the dashboard.
CREATE TABLE direct_score_entry_assignments (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_direct_score_entry_assignment UNIQUE (employee_id, cycle_id)
);

CREATE INDEX idx_direct_score_entry_assignments_employee
    ON direct_score_entry_assignments(employee_id);

CREATE INDEX idx_direct_score_entry_assignments_cycle
    ON direct_score_entry_assignments(cycle_id);

-- =========================================================================
-- CORE PROCESS ENGINE & RUNTIME DATA WORKSPACE
-- =========================================================================

CREATE TABLE appraisals (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE RESTRICT,
    template_id BIGINT REFERENCES form_templates(id) ON DELETE SET NULL, -- Form structure context
    status appraisal_status NOT NULL DEFAULT 'PENDING_SELF_ASSESSMENT',
    manager_level INT NOT NULL DEFAULT 1,
    
    -- Automatic aggregate tracking calculated on submission runtime
    system_raw_score INT DEFAULT 0, 
    
    -- Score (O) / Rating (O)
    initial_score_numeric NUMERIC(10, 2), 
    initial_rating performance_rating,
    -- Adjustments + normalization pipeline
    credit_hrs_erp_score_adj NUMERIC(10, 2),
    pub_oric_score_adj NUMERIC(10, 2),
    qec_score_adj NUMERIC(10, 2),
    calibration_factor NUMERIC(10, 4),
    normalized_score NUMERIC(10, 2),
    calibrated_score_numeric NUMERIC(10, 2), 
    calibrated_rating performance_rating, -- Rating (N)
    performance_quartile_id BIGINT, -- FK added after performance_quartiles exists

    -- Eligibility / evaluation remarks (scoped to appraisal cycle financial year)
    uol_experience_years NUMERIC(6, 2),
    is_eligible BOOLEAN,
    eligibility_status VARCHAR(30), -- Fully Eligible | Partially Eligible | Not Eligible
    applicable_duration VARCHAR(100),
    applicable_duration_factor NUMERIC(3, 1), -- 1 = full, 0 = none, else months/12
    remarks_evaluation TEXT,
    hr_approval_status VARCHAR(20) DEFAULT 'pending', -- pending | approved | review_required (independent of remarks_evaluation)

    -- Compensation worksheet
    current_salary NUMERIC(14, 2),
    previous_salary NUMERIC(14, 2),
    applicable_salary_for_increment NUMERIC(14, 2),
    applicable_matrix VARCHAR(150),
    calculated_increment_percentage NUMERIC(5, 2), -- Applicable Incr %
    increment_per_matrix NUMERIC(5, 2),
    approved_increment_percentage   NUMERIC(5, 2), -- Increment Adjusted
    revised_salary NUMERIC(14, 2),
    revised_salary_ro NUMERIC(14, 2),
    hod_review_comments TEXT,
    remarks_compensation TEXT,
    effective_date DATE,
    
    employee_strengths TEXT,       
    employee_weaknesses TEXT,      
    committee_feedback TEXT,       
    next_year_targets TEXT,        
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_per_cycle UNIQUE (employee_id, cycle_id)
);

-- Primary qualification snapshot fields used by staff listing (1:N source of truth)
CREATE TABLE employee_qualifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(255) NOT NULL,
    year INT,
    subject VARCHAR(255),
    institute VARCHAR(255),
    country VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Actual Stored Answers Filled Out By Employees / Line Managers
CREATE TABLE appraisal_answers (
    id BIGSERIAL PRIMARY KEY,
    appraisal_id BIGINT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES form_questions(id) ON DELETE RESTRICT,
    filled_by_id BIGINT NOT NULL REFERENCES users(id),
    
    -- Open-ended capture data
    text_response TEXT, 
    
    -- Relational selection linkages to score engine options
    selected_option_id BIGINT REFERENCES question_options(id) ON DELETE SET NULL,
    
    -- Captured point weight at execution snapshot (protects historical records if point tables change later)
    points_earned INT NOT NULL DEFAULT 0, 
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_answer_per_question UNIQUE (appraisal_id, question_id, filled_by_id)
);

-- CONFIGURABLE APPRAISAL MATRICES
CREATE TABLE increment_matrices (
    id SERIAL PRIMARY KEY,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    rating performance_rating NOT NULL,
    quartile INT NOT NULL CHECK (quartile BETWEEN 1 AND 4),
    recommended_increment_percentage NUMERIC(5, 2) NOT NULL,
    CONSTRAINT unique_matrix_entry UNIQUE (cycle_id, rating, quartile)
);

-- SECURITY SYSTEM AUDITING
CREATE TABLE appraisal_logs (
    id BIGSERIAL PRIMARY KEY,
    appraisal_id BIGINT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    changed_by_id BIGINT NOT NULL REFERENCES users(id), 
    action_performed VARCHAR(100) NOT NULL, 
    old_value JSONB, 
    new_value JSONB, 
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE DDX INDEXES
CREATE INDEX idx_users_role_dept ON users(system_role, department_id);
CREATE INDEX idx_appraisals_cycle_status ON appraisals(cycle_id, status);
CREATE INDEX idx_form_sections_template ON form_sections(template_id, sort_order);
CREATE INDEX idx_questions_lookup ON form_questions(template_id, sort_order);
CREATE INDEX idx_options_lookup ON question_options(question_id);
CREATE INDEX idx_answers_lookup ON appraisal_answers(appraisal_id, question_id);
CREATE TABLE entity_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE CHECK (code IN ('C1', 'C2', 'C3')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE entities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    entity_category_id INT NOT NULL REFERENCES entity_categories(id) ON DELETE RESTRICT,
    parent_entity_id BIGINT REFERENCES entities(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entities_parent ON entities(parent_entity_id);
CREATE TABLE financial_years (
    id SERIAL PRIMARY KEY,
    year INT NOT NULL UNIQUE,
    label VARCHAR(20) NOT NULL UNIQUE,       -- e.g. 'FY 2024-25'
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE performance_levels (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,              -- e.g. 'Excellent', 'Satisfactory'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_level_per_year UNIQUE (financial_year_id, name)
);

CREATE TABLE performance_quartiles (
    id BIGSERIAL PRIMARY KEY,
    performance_level_id BIGINT NOT NULL REFERENCES performance_levels(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,              -- e.g. 'Q1', 'Upper Quartile'
    score_min NUMERIC(10, 2) NOT NULL,
    score_max NUMERIC(10, 2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_score_range CHECK (score_min < score_max),
    CONSTRAINT unique_quartile_per_level UNIQUE (performance_level_id, name)
);

CREATE INDEX idx_levels_financial_year ON performance_levels(financial_year_id);
CREATE INDEX idx_quartiles_level ON performance_quartiles(performance_level_id);

ALTER TABLE appraisals
    ADD CONSTRAINT appraisals_performance_quartile_id_fkey
    FOREIGN KEY (performance_quartile_id) REFERENCES performance_quartiles(id) ON DELETE SET NULL;

CREATE INDEX idx_appraisals_performance_quartile ON appraisals (performance_quartile_id);
CREATE INDEX idx_employee_qualifications_user ON employee_qualifications (user_id);

-- Institutional quota targets (Calibration vs Quota chart)
CREATE TABLE institutional_quotas (
    id BIGSERIAL PRIMARY KEY,
    financial_year_id INT NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
    rating performance_rating NOT NULL,
    quota_percent NUMERIC(5, 2) NOT NULL
        CHECK (quota_percent >= 0 AND quota_percent <= 100),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_institutional_quota_per_year_rating
        UNIQUE (financial_year_id, rating)
);

CREATE INDEX idx_institutional_quotas_financial_year
    ON institutional_quotas (financial_year_id);
