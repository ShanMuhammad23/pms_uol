-- =========================================================================
-- UNIVERSITY OF LAHORE (UOL) - PERFORMANCE MANAGEMENT SYSTEM (PMS) SCHEMA
-- Version: 2.0 (Fully Dynamic Form Engine & Point Weightage Mechanics)
-- Target Database: PostgreSQL 15+
-- =========================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'HEAD', 'HR', 'BOARD', 'SUPER_ADMIN');
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
    employee_id VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    system_role user_role NOT NULL DEFAULT 'EMPLOYEE',
    emp_category employee_category NOT NULL,
    emp_sub_category sub_category NOT NULL,
    department_id INT REFERENCES departments(id) ON DELETE RESTRICT,
    head_id BIGINT REFERENCES users(id) ON DELETE SET NULL, 
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
CREATE TABLE form_templates (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL, -- e.g., 'Annual Faculty Evaluation Form'
    description TEXT,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    
    -- Routing Matrix Filters (Ensures right form displays for the selected tiers)
    target_category employee_category NOT NULL, -- Academic | Supportive | Blue Collar
    target_sub_category sub_category NOT NULL,  -- General | Skilled | Professional
    
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_target_form_per_cycle UNIQUE (cycle_id, target_category, target_sub_category)
);

-- Individual Form Questions
CREATE TABLE form_questions (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
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

-- =========================================================================
-- CORE PROCESS ENGINE & RUNTIME DATA WORKSPACE
-- =========================================================================

CREATE TABLE appraisals (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INT NOT NULL REFERENCES appraisal_cycles(id) ON DELETE RESTRICT,
    template_id BIGINT REFERENCES form_templates(id) ON DELETE SET NULL, -- Form structure context
    status appraisal_status NOT NULL DEFAULT 'PENDING_SELF_ASSESSMENT',
    
    -- Automatic aggregate tracking calculated on submission runtime
    system_raw_score INT DEFAULT 0, 
    
    initial_score_numeric NUMERIC(5, 2), 
    initial_rating performance_rating,   
    calibrated_score_numeric NUMERIC(5, 2), 
    calibrated_rating performance_rating,   
    
    calculated_increment_percentage NUMERIC(5, 2), 
    approved_increment_percentage   NUMERIC(5, 2), 
    effective_date DATE,
    
    employee_strengths TEXT,       
    employee_weaknesses TEXT,      
    committee_feedback TEXT,       
    next_year_targets TEXT,        
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_per_cycle UNIQUE (employee_id, cycle_id)
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
    score_min INT NOT NULL,
    score_max INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_score_range CHECK (score_min < score_max),
    CONSTRAINT unique_quartile_per_level UNIQUE (performance_level_id, name)
);

CREATE INDEX idx_levels_financial_year ON performance_levels(financial_year_id);
CREATE INDEX idx_quartiles_level ON performance_quartiles(performance_level_id);