-- =====================================================
-- MS ACCESS DATABASE SCHEMA
-- Training Needs Database - Individual Course Mapping Test Environment
-- =====================================================
-- Purpose: Create MS Access version for testing individual course assignments
-- Date Created: 2025-01-29
-- Import Strategy: Data can be imported back to PostgreSQL after testing
-- =====================================================

-- =====================================================
-- TABLE 1: TRAINING_LOCATIONS
-- =====================================================
-- Purpose: Reference data for training venue locations
-- Relationship: Referenced by end_users.training_location
-- =====================================================

CREATE TABLE training_locations (
    id AUTOINCREMENT PRIMARY KEY,
    name TEXT(255) NOT NULL,
    display_order INTEGER,
    active YESNO DEFAULT True,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Create unique index on name within project
CREATE UNIQUE INDEX idx_training_locations_unique_name
ON training_locations (name, project_id);

-- =====================================================
-- TABLE 2: COURSES
-- =====================================================
-- Purpose: Training course catalog
-- Relationship: Referenced by user_course_mappings.course_id
-- =====================================================

CREATE TABLE courses (
    course_id TEXT(50) PRIMARY KEY,
    course_name TEXT(255) NOT NULL,
    functional_area TEXT(255) NOT NULL,
    duration_hrs DOUBLE,
    application TEXT(255),
    priority INTEGER,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Index for lookups
CREATE INDEX idx_courses_project_id ON courses (project_id);
CREATE INDEX idx_courses_functional_area ON courses (functional_area);

-- =====================================================
-- TABLE 3: LINES_OF_BUSINESS (LoB)
-- =====================================================
-- Purpose: Reference data for business lines (Prime, Parts, Services)
-- Relationship: Many-to-many with end_users and courses via junction tables
-- =====================================================

CREATE TABLE lines_of_business (
    id AUTOINCREMENT PRIMARY KEY,
    lob_code TEXT(50) NOT NULL,
    lob_name TEXT(255) NOT NULL,
    description MEMO,
    display_order INTEGER,
    active YESNO DEFAULT True,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Create unique index on lob_code within project
CREATE UNIQUE INDEX idx_lob_unique_code
ON lines_of_business (lob_code, project_id);

-- =====================================================
-- TABLE 4: END_USERS
-- =====================================================
-- Purpose: Employees/end users who need training
-- Relationship: References training_locations.name
-- Relationship: Many-to-many with lines_of_business via end_user_lob_assignments
-- Relationship: Many-to-many with courses via user_course_mappings
-- =====================================================

CREATE TABLE end_users (
    id AUTOINCREMENT PRIMARY KEY,
    name TEXT(255) NOT NULL,
    email TEXT(255),
    job_title TEXT(255),
    country TEXT(100),
    division TEXT(255),
    sub_division TEXT(255),
    location_name TEXT(255),
    training_location TEXT(255),
    project_role TEXT(255),
    organisation TEXT(255),
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Indexes for performance
CREATE INDEX idx_end_users_project_id ON end_users (project_id);
CREATE INDEX idx_end_users_training_location ON end_users (training_location);
CREATE INDEX idx_end_users_name ON end_users (name);
CREATE INDEX idx_end_users_email ON end_users (email);

-- =====================================================
-- TABLE 5: END_USER_LOB_ASSIGNMENTS
-- =====================================================
-- Purpose: Many-to-many junction table (employees can work across multiple LoB)
-- Relationship: Links end_users to lines_of_business
-- =====================================================

CREATE TABLE end_user_lob_assignments (
    id AUTOINCREMENT PRIMARY KEY,
    end_user_id INTEGER NOT NULL,
    lob_code TEXT(50) NOT NULL,
    is_primary YESNO DEFAULT False,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Prevent duplicate assignments
CREATE UNIQUE INDEX idx_user_lob_unique
ON end_user_lob_assignments (end_user_id, lob_code);

-- Indexes for lookups
CREATE INDEX idx_user_lob_end_user ON end_user_lob_assignments (end_user_id);
CREATE INDEX idx_user_lob_code ON end_user_lob_assignments (lob_code);

-- =====================================================
-- TABLE 6: COURSE_LOB_ASSIGNMENTS
-- =====================================================
-- Purpose: Many-to-many junction table (courses can apply to multiple LoB)
-- Relationship: Links courses to lines_of_business
-- Example: "Safety Training" applies to Prime, Parts, and Services
-- =====================================================

CREATE TABLE course_lob_assignments (
    id AUTOINCREMENT PRIMARY KEY,
    course_id TEXT(50) NOT NULL,
    lob_code TEXT(50) NOT NULL,
    is_mandatory YESNO DEFAULT False,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Prevent duplicate assignments
CREATE UNIQUE INDEX idx_course_lob_unique
ON course_lob_assignments (course_id, lob_code);

-- Indexes for lookups
CREATE INDEX idx_course_lob_course ON course_lob_assignments (course_id);
CREATE INDEX idx_course_lob_code ON course_lob_assignments (lob_code);

-- =====================================================
-- TABLE 7: USER_COURSE_MAPPINGS
-- =====================================================
-- Purpose: Individual course assignments (the new system being tested)
-- Relationship: Links end_users to courses (individual-based, not role-based)
-- This is the primary table for testing individual course mapping approach
-- =====================================================

CREATE TABLE user_course_mappings (
    id AUTOINCREMENT PRIMARY KEY,
    project_id TEXT(36) NOT NULL,
    end_user_id INTEGER NOT NULL,
    course_id TEXT(50) NOT NULL,
    assigned_by TEXT(50) DEFAULT 'admin',
    assigned_date DATETIME DEFAULT Now(),
    notes MEMO,
    created_at DATETIME DEFAULT Now(),
    updated_at DATETIME DEFAULT Now()
);

-- Prevent duplicate course assignments per user
-- NOTE: In MS Access, create this as a multi-field unique index via GUI or:
CREATE UNIQUE INDEX idx_user_course_unique
ON user_course_mappings (end_user_id, course_id);

-- Indexes for performance
CREATE INDEX idx_user_course_project ON user_course_mappings (project_id);
CREATE INDEX idx_user_course_user ON user_course_mappings (end_user_id);
CREATE INDEX idx_user_course_course ON user_course_mappings (course_id);

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================
-- Insert sample data to verify schema and test functionality
-- Use dummy project_id: '00000000-0000-0000-0000-000000000001'
-- =====================================================

-- Sample Lines of Business
INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('PRIME', 'Prime', 'Prime retail operations and sales', 1, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('PARTS', 'Parts', 'Parts inventory and distribution', 2, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('SERVICES', 'Services', 'Customer services and support', 3, True, '00000000-0000-0000-0000-000000000001');

-- Sample Training Locations
INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('Manchester', 1, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('London', 2, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('Birmingham', 3, True, '00000000-0000-0000-0000-000000000001');

-- Sample Courses
INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C001', 'Safety Training', 'Health & Safety', 2.5, 'General', 1, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C002', 'Customer Service Excellence', 'Customer Relations', 4.0, 'Retail & Services', 2, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C003', 'Inventory Management', 'Operations', 3.0, 'Parts & Logistics', 3, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C004', 'Leadership Development', 'Management', 8.0, 'All Lines of Business', 4, '00000000-0000-0000-0000-000000000001');

-- Course-to-LoB Assignments (courses can apply to multiple LoB)
-- Safety Training applies to ALL lines of business
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'PARTS', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Customer Service applies to Prime and Services
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C002', 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C002', 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Inventory Management applies to Parts only
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C003', 'PARTS', True, '00000000-0000-0000-0000-000000000001');

-- Leadership applies to all LoB
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'PRIME', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'PARTS', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'SERVICES', False, '00000000-0000-0000-0000-000000000001');

-- Sample End Users
INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('John Doe', 'john.doe@example.com', 'Store Manager', 'Manchester', 'Manager', 'Retail Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Mary Smith', 'mary.smith@example.com', 'Parts Specialist', 'London', 'Specialist', 'Parts Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Steve Johnson', 'steve.johnson@example.com', 'Service Advisor', 'Birmingham', 'Advisor', 'Services Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Lisa Brown', 'lisa.brown@example.com', 'Regional Manager', 'Manchester', 'Senior Manager', 'Corporate', '00000000-0000-0000-0000-000000000001');

-- User-to-LoB Assignments (users can work across multiple LoB)
-- John works in Prime only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (1, 'PRIME', True, '00000000-0000-0000-0000-000000000001');

-- Mary works in Parts only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (2, 'PARTS', True, '00000000-0000-0000-0000-000000000001');

-- Steve works in Services only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (3, 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Lisa works across ALL lines of business (regional manager)
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'PARTS', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'SERVICES', False, '00000000-0000-0000-0000-000000000001');

-- Sample Individual Course Assignments
-- John (Prime) gets Safety + Customer Service
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 'C002', 'admin', 'Customer service for retail managers');

-- Mary (Parts) gets Safety + Inventory
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 2, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 2, 'C003', 'admin', 'Inventory management for parts specialists');

-- Steve (Services) gets Safety + Customer Service
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 3, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 3, 'C002', 'admin', 'Customer service for service advisors');

-- Lisa (Regional Manager - all LoB) gets Safety + Leadership
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 4, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 4, 'C004', 'admin', 'Leadership development for regional managers');

-- =====================================================
-- USEFUL QUERIES FOR TESTING
-- =====================================================

-- Query 1: View all users with their Lines of Business
-- SELECT
--     eu.id,
--     eu.name,
--     eu.email,
--     eu.job_title,
--     lob.lob_name,
--     ela.is_primary
-- FROM end_users eu
-- INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
-- INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
-- ORDER BY eu.name, ela.is_primary DESC;

-- Query 2: View all users with their assigned courses
-- SELECT
--     eu.id,
--     eu.name,
--     eu.email,
--     c.course_id,
--     c.course_name,
--     c.duration_hrs,
--     ucm.assigned_date,
--     ucm.notes
-- FROM end_users eu
-- INNER JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
-- INNER JOIN courses c ON ucm.course_id = c.course_id
-- ORDER BY eu.name, c.course_id;

-- Query 3: View courses by Line of Business
-- SELECT
--     lob.lob_name,
--     c.course_id,
--     c.course_name,
--     c.functional_area,
--     cla.is_mandatory
-- FROM lines_of_business lob
-- INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
-- INNER JOIN courses c ON cla.course_id = c.course_id
-- ORDER BY lob.lob_name, c.course_id;

-- Query 4: Find users who need courses based on their LoB (not yet assigned)
-- SELECT DISTINCT
--     eu.id,
--     eu.name,
--     lob.lob_name,
--     c.course_id,
--     c.course_name,
--     cla.is_mandatory
-- FROM end_users eu
-- INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
-- INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
-- INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
-- INNER JOIN courses c ON cla.course_id = c.course_id
-- LEFT JOIN user_course_mappings ucm ON (eu.id = ucm.end_user_id AND c.course_id = ucm.course_id)
-- WHERE ucm.id IS NULL
-- ORDER BY eu.name, c.course_id;

-- =====================================================
-- NOTES FOR MS ACCESS IMPLEMENTATION
-- =====================================================
--
-- 1. FOREIGN KEY RELATIONSHIPS (Create via GUI):
--    - Database Tools → Relationships
--    - Drag lines between tables:
--      * end_users.training_location → training_locations.name
--      * user_course_mappings.end_user_id → end_users.id (CASCADE DELETE)
--      * user_course_mappings.course_id → courses.course_id (CASCADE DELETE)
--      * end_user_lob_assignments.end_user_id → end_users.id (CASCADE DELETE)
--      * end_user_lob_assignments.lob_code → lines_of_business.lob_code
--      * course_lob_assignments.course_id → courses.course_id (CASCADE DELETE)
--      * course_lob_assignments.lob_code → lines_of_business.lob_code
--
-- 2. UNIQUE CONSTRAINTS:
--    - If CREATE UNIQUE INDEX fails, create via Table Design → Indexes
--    - Multi-field unique indexes:
--      * user_course_mappings: (end_user_id, course_id)
--      * end_user_lob_assignments: (end_user_id, lob_code)
--      * course_lob_assignments: (course_id, lob_code)
--
-- 3. AUTOINCREMENT vs SERIAL:
--    - MS Access AUTOINCREMENT = PostgreSQL SERIAL
--    - Starts at 1, increments by 1
--
-- 4. TEXT vs VARCHAR:
--    - MS Access TEXT(n) = PostgreSQL VARCHAR(n)
--    - MS Access MEMO = PostgreSQL TEXT (unlimited length)
--
-- 5. YESNO vs BOOLEAN:
--    - MS Access YESNO = PostgreSQL BOOLEAN
--    - Values: True/False, Yes/No, -1/0
--
-- 6. DATETIME vs TIMESTAMP:
--    - MS Access DATETIME = PostgreSQL TIMESTAMP
--    - Default Now() = current date/time
--
-- 7. PROJECT_ID:
--    - Use dummy GUID: '00000000-0000-0000-0000-000000000001'
--    - All records should use same project_id for simplicity
--    - When importing back to PostgreSQL, replace with actual project UUID
--
-- 8. RUNNING THIS SCRIPT:
--    - Open MS Access
--    - Create new blank database
--    - Go to Database Tools → SQL View (or Create → Query Design → SQL View)
--    - Copy and paste sections of this script
--    - Run each CREATE TABLE statement individually
--    - Run each INSERT statement individually or in batches
--    - Some syntax may need adjustment for your Access version
--
-- 9. COMPATIBILITY:
--    - Tested syntax for MS Access 2016+
--    - Older versions may require GUI-based table creation
--    - If SQL fails, use Table Design View to create tables manually
--
-- =====================================================
-- END OF SCHEMA
-- =====================================================
