-- =====================================================
-- MS ACCESS DATABASE SCHEMA - FIXED VERSION
-- Training Needs Database - Individual Course Mapping Test Environment
-- =====================================================
-- IMPORTANT: MS Access has SQL syntax limitations
-- 1. DEFAULT constraints don't work in CREATE TABLE - set defaults in Table Design View
-- 2. Some versions don't support NOT NULL in CREATE TABLE
-- 3. Create indexes separately after table creation
-- 4. Recommended: Use Table Design View GUI for best compatibility
-- =====================================================

-- =====================================================
-- METHOD 1: SIMPLIFIED SQL (Most Compatible)
-- =====================================================
-- Use these simplified CREATE TABLE statements
-- Then set defaults, required fields, and indexes in Table Design View

-- TABLE 1: TRAINING_LOCATIONS
CREATE TABLE training_locations (
    id AUTOINCREMENT,
    name TEXT(255),
    display_order INTEGER,
    active YESNO,
    project_id TEXT(36),
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_training_locations PRIMARY KEY (id)
);

-- TABLE 2: COURSES
CREATE TABLE courses (
    course_id TEXT(50),
    course_name TEXT(255),
    functional_area TEXT(255),
    duration_hrs DOUBLE,
    application TEXT(255),
    priority INTEGER,
    project_id TEXT(36),
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_courses PRIMARY KEY (course_id)
);

-- TABLE 3: LINES_OF_BUSINESS
CREATE TABLE lines_of_business (
    id AUTOINCREMENT,
    lob_code TEXT(50),
    lob_name TEXT(255),
    description MEMO,
    display_order INTEGER,
    active YESNO,
    project_id TEXT(36),
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_lines_of_business PRIMARY KEY (id)
);

-- TABLE 4: END_USERS
CREATE TABLE end_users (
    id AUTOINCREMENT,
    name TEXT(255),
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
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_end_users PRIMARY KEY (id)
);

-- TABLE 5: END_USER_LOB_ASSIGNMENTS
CREATE TABLE end_user_lob_assignments (
    id AUTOINCREMENT,
    end_user_id INTEGER,
    lob_code TEXT(50),
    is_primary YESNO,
    project_id TEXT(36),
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_end_user_lob_assignments PRIMARY KEY (id)
);

-- TABLE 6: COURSE_LOB_ASSIGNMENTS
CREATE TABLE course_lob_assignments (
    id AUTOINCREMENT,
    course_id TEXT(50),
    lob_code TEXT(50),
    is_mandatory YESNO,
    project_id TEXT(36),
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_course_lob_assignments PRIMARY KEY (id)
);

-- TABLE 7: USER_COURSE_MAPPINGS
CREATE TABLE user_course_mappings (
    id AUTOINCREMENT,
    project_id TEXT(36),
    end_user_id INTEGER,
    course_id TEXT(50),
    assigned_by TEXT(50),
    assigned_date DATETIME,
    notes MEMO,
    created_at DATETIME,
    updated_at DATETIME,
    CONSTRAINT pk_user_course_mappings PRIMARY KEY (id)
);

-- =====================================================
-- INDEXES - Create these AFTER tables are created
-- =====================================================

-- Training Locations indexes
CREATE INDEX idx_training_locations_project ON training_locations (project_id);
CREATE INDEX idx_training_locations_name ON training_locations (name);

-- Courses indexes
CREATE INDEX idx_courses_project_id ON courses (project_id);
CREATE INDEX idx_courses_functional_area ON courses (functional_area);

-- Lines of Business indexes
CREATE INDEX idx_lob_code ON lines_of_business (lob_code);
CREATE INDEX idx_lob_project ON lines_of_business (project_id);

-- End Users indexes
CREATE INDEX idx_end_users_project_id ON end_users (project_id);
CREATE INDEX idx_end_users_training_location ON end_users (training_location);
CREATE INDEX idx_end_users_name ON end_users (name);
CREATE INDEX idx_end_users_email ON end_users (email);

-- End User LoB Assignments indexes
CREATE INDEX idx_user_lob_end_user ON end_user_lob_assignments (end_user_id);
CREATE INDEX idx_user_lob_code ON end_user_lob_assignments (lob_code);

-- Course LoB Assignments indexes
CREATE INDEX idx_course_lob_course ON course_lob_assignments (course_id);
CREATE INDEX idx_course_lob_code ON course_lob_assignments (lob_code);

-- User Course Mappings indexes
CREATE INDEX idx_user_course_project ON user_course_mappings (project_id);
CREATE INDEX idx_user_course_user ON user_course_mappings (end_user_id);
CREATE INDEX idx_user_course_course ON user_course_mappings (course_id);

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert Lines of Business
INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('PRIME', 'Prime', 'Prime retail operations and sales', 1, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('PARTS', 'Parts', 'Parts inventory and distribution', 2, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO lines_of_business (lob_code, lob_name, description, display_order, active, project_id)
VALUES ('SERVICES', 'Services', 'Customer services and support', 3, True, '00000000-0000-0000-0000-000000000001');

-- Insert Training Locations
INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('Manchester', 1, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('London', 2, True, '00000000-0000-0000-0000-000000000001');

INSERT INTO training_locations (name, display_order, active, project_id)
VALUES ('Birmingham', 3, True, '00000000-0000-0000-0000-000000000001');

-- Insert Courses
INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C001', 'Safety Training', 'Health & Safety', 2.5, 'General', 1, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C002', 'Customer Service Excellence', 'Customer Relations', 4.0, 'Retail & Services', 2, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C003', 'Inventory Management', 'Operations', 3.0, 'Parts & Logistics', 3, '00000000-0000-0000-0000-000000000001');

INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id)
VALUES ('C004', 'Leadership Development', 'Management', 8.0, 'All Lines of Business', 4, '00000000-0000-0000-0000-000000000001');

-- Insert Course-LoB Assignments (which courses apply to which lines of business)
-- Safety Training - applies to ALL LoB
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'PARTS', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C001', 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Customer Service - applies to PRIME and SERVICES
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C002', 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C002', 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Inventory Management - applies to PARTS only
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C003', 'PARTS', True, '00000000-0000-0000-0000-000000000001');

-- Leadership Development - applies to ALL LoB (but not mandatory)
INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'PRIME', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'PARTS', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO course_lob_assignments (course_id, lob_code, is_mandatory, project_id)
VALUES ('C004', 'SERVICES', False, '00000000-0000-0000-0000-000000000001');

-- Insert End Users (sample employees)
INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('John Doe', 'john.doe@example.com', 'Store Manager', 'Manchester', 'Manager', 'Retail Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Mary Smith', 'mary.smith@example.com', 'Parts Specialist', 'London', 'Specialist', 'Parts Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Steve Johnson', 'steve.johnson@example.com', 'Service Advisor', 'Birmingham', 'Advisor', 'Services Division', '00000000-0000-0000-0000-000000000001');

INSERT INTO end_users (name, email, job_title, training_location, project_role, organisation, project_id)
VALUES ('Lisa Brown', 'lisa.brown@example.com', 'Regional Manager', 'Manchester', 'Senior Manager', 'Corporate', '00000000-0000-0000-0000-000000000001');

-- Insert End User-LoB Assignments (which employees work in which lines of business)
-- John works in PRIME only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (1, 'PRIME', True, '00000000-0000-0000-0000-000000000001');

-- Mary works in PARTS only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (2, 'PARTS', True, '00000000-0000-0000-0000-000000000001');

-- Steve works in SERVICES only
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (3, 'SERVICES', True, '00000000-0000-0000-0000-000000000001');

-- Lisa works across ALL lines of business (regional manager)
INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'PRIME', True, '00000000-0000-0000-0000-000000000001');

INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'PARTS', False, '00000000-0000-0000-0000-000000000001');

INSERT INTO end_user_lob_assignments (end_user_id, lob_code, is_primary, project_id)
VALUES (4, 'SERVICES', False, '00000000-0000-0000-0000-000000000001');

-- Insert Individual Course Assignments
-- John (PRIME) - gets Safety + Customer Service
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 'C002', 'admin', 'Customer service for retail managers');

-- Mary (PARTS) - gets Safety + Inventory
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 2, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 2, 'C003', 'admin', 'Inventory management for parts specialists');

-- Steve (SERVICES) - gets Safety + Customer Service
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 3, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 3, 'C002', 'admin', 'Customer service for service advisors');

-- Lisa (Regional Manager - ALL LoB) - gets Safety + Leadership
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 4, 'C001', 'admin', 'Mandatory safety training');

INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 4, 'C004', 'admin', 'Leadership development for regional managers');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- View all users with their assigned courses
-- SELECT
--     eu.name,
--     eu.job_title,
--     c.course_id,
--     c.course_name,
--     c.duration_hrs
-- FROM end_users eu
-- INNER JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
-- INNER JOIN courses c ON ucm.course_id = c.course_id
-- ORDER BY eu.name, c.course_id;

-- View all users with their Lines of Business
-- SELECT
--     eu.name,
--     eu.job_title,
--     lob.lob_name,
--     ela.is_primary
-- FROM end_users eu
-- INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
-- INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
-- ORDER BY eu.name, ela.is_primary DESC;

-- View which courses apply to which Lines of Business
-- SELECT
--     lob.lob_name,
--     c.course_name,
--     cla.is_mandatory
-- FROM lines_of_business lob
-- INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
-- INNER JOIN courses c ON cla.course_id = c.course_id
-- ORDER BY lob.lob_name, c.course_id;

-- =====================================================
-- INSTRUCTIONS FOR MS ACCESS
-- =====================================================
--
-- STEP 1: CREATE TABLES
-- - Open MS Access, create new blank database
-- - Create → Query Design → SQL View
-- - Copy/paste each CREATE TABLE statement ONE AT A TIME
-- - Click Run (!) button for each table
-- - If you get errors, use Table Design View instead (GUI method)
--
-- STEP 2: CREATE INDEXES (OPTIONAL BUT RECOMMENDED)
-- - After all tables created, run CREATE INDEX statements
-- - Run each one separately
-- - If errors occur, you can skip indexes (not critical for testing)
--
-- STEP 3: INSERT SAMPLE DATA
-- - Copy/paste each INSERT statement
-- - Run them individually or in small batches
-- - Check each table to verify data loaded
-- - Order matters: Insert parent tables before child tables
--   1. lines_of_business
--   2. training_locations
--   3. courses
--   4. course_lob_assignments
--   5. end_users
--   6. end_user_lob_assignments
--   7. user_course_mappings
--
-- STEP 4: SET FIELD PROPERTIES IN TABLE DESIGN VIEW
-- For each table, open in Design View and set:
-- - Required fields: name, course_name, functional_area, etc.
-- - Default values: created_at = Now(), active = True, etc.
-- - Field sizes already set in CREATE TABLE
--
-- STEP 5: CREATE RELATIONSHIPS (RECOMMENDED)
-- - Database Tools → Relationships
-- - Drag lines between related fields:
--   * end_users.training_location → training_locations.name
--   * user_course_mappings.end_user_id → end_users.id
--   * user_course_mappings.course_id → courses.course_id
--   * end_user_lob_assignments.end_user_id → end_users.id
--   * end_user_lob_assignments.lob_code → lines_of_business.lob_code
--   * course_lob_assignments.course_id → courses.course_id
--   * course_lob_assignments.lob_code → lines_of_business.lob_code
-- - Check "Enforce Referential Integrity"
--
-- TROUBLESHOOTING:
-- - If CREATE TABLE fails → Use Table Design View (GUI) instead
-- - If INSERT fails → Check insert order (parents before children)
-- - If index fails → Skip it, not critical for testing
-- - If DEFAULT/NOT NULL fails → Set in Table Design View instead
--
-- =====================================================
