-- =====================================================
-- POSTGRESQL EXPORT SCRIPTS FOR MS ACCESS IMPORT
-- =====================================================
-- Purpose: Generate INSERT statements from your current PostgreSQL data
-- Output: MS Access-compatible INSERT statements
-- Usage: Run these queries in your PostgreSQL database (Supabase SQL Editor)
--        Copy the results and paste into MS Access SQL View
-- =====================================================

-- =====================================================
-- SCRIPT 1: EXPORT TRAINING LOCATIONS
-- =====================================================
-- Generates INSERT statements for all training locations in your current project
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

SELECT
    'INSERT INTO training_locations (id, name, display_order, active, project_id, created_at, updated_at) VALUES (' ||
    COALESCE(id::TEXT, 'NULL') || ', ' ||
    '''' || REPLACE(name, '''', '''''') || ''', ' ||
    COALESCE(display_order::TEXT, 'NULL') || ', ' ||
    CASE WHEN active THEN 'True' ELSE 'False' END || ', ' ||
    '''00000000-0000-0000-0000-000000000001'', ' ||
    '''' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') || ''', ' ||
    '''' || TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') || '''' ||
    ');' AS insert_statement
FROM training_locations
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
ORDER BY display_order, name;

-- Expected Output Example:
-- INSERT INTO training_locations (id, name, display_order, active, project_id, created_at, updated_at) VALUES (1, 'Manchester', 1, True, '00000000-0000-0000-0000-000000000001', '2025-01-29 10:00:00', '2025-01-29 10:00:00');


-- =====================================================
-- SCRIPT 2: EXPORT COURSES
-- =====================================================
-- Generates INSERT statements for all courses in your current project
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

SELECT
    'INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id, created_at, updated_at) VALUES (' ||
    '''' || REPLACE(course_id, '''', '''''') || ''', ' ||
    '''' || REPLACE(course_name, '''', '''''') || ''', ' ||
    '''' || REPLACE(functional_area, '''', '''''') || ''', ' ||
    COALESCE(duration_hrs::TEXT, 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(application, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE(priority::TEXT, 'NULL') || ', ' ||
    '''00000000-0000-0000-0000-000000000001'', ' ||
    '''' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') || ''', ' ||
    '''' || TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') || '''' ||
    ');' AS insert_statement
FROM courses
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
ORDER BY course_id;

-- Expected Output Example:
-- INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id, created_at, updated_at) VALUES ('C001', 'Safety Training', 'Health & Safety', 2.5, 'General', 1, '00000000-0000-0000-0000-000000000001', '2025-01-29 10:00:00', '2025-01-29 10:00:00');


-- =====================================================
-- SCRIPT 3: EXPORT END USERS
-- =====================================================
-- Generates INSERT statements for all end users in your current project
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

SELECT
    'INSERT INTO end_users (id, name, email, job_title, country, division, sub_division, location_name, training_location, project_role, organisation, project_id, created_at, updated_at) VALUES (' ||
    id::TEXT || ', ' ||
    '''' || REPLACE(name, '''', '''''') || ''', ' ||
    COALESCE('''' || REPLACE(email, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(job_title, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(country, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(division, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(sub_division, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(location_name, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(training_location, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(project_role, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(organisation, '''', '''''') || '''', 'NULL') || ', ' ||
    '''00000000-0000-0000-0000-000000000001'', ' ||
    '''' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') || ''', ' ||
    '''' || TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') || '''' ||
    ');' AS insert_statement
FROM end_users
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
ORDER BY id;

-- Expected Output Example:
-- INSERT INTO end_users (id, name, email, job_title, country, division, sub_division, location_name, training_location, project_role, organisation, project_id, created_at, updated_at) VALUES (1, 'John Doe', 'john@example.com', 'Store Manager', 'UK', 'Retail', 'North', 'Manchester Office', 'Manchester', 'Manager', 'Retail Division', '00000000-0000-0000-0000-000000000001', '2025-01-29 10:00:00', '2025-01-29 10:00:00');


-- =====================================================
-- SCRIPT 4: EXPORT EXISTING USER-COURSE MAPPINGS (if any)
-- =====================================================
-- If you already have some user-course mappings in PostgreSQL, this exports them
-- If this is a fresh start, skip this script
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

SELECT
    'INSERT INTO user_course_mappings (id, project_id, end_user_id, course_id, assigned_by, assigned_date, notes, created_at, updated_at) VALUES (' ||
    id::TEXT || ', ' ||
    '''00000000-0000-0000-0000-000000000001'', ' ||
    end_user_id::TEXT || ', ' ||
    '''' || REPLACE(course_id, '''', '''''') || ''', ' ||
    COALESCE('''' || REPLACE(assigned_by, '''', '''''') || '''', '''admin''') || ', ' ||
    '''' || TO_CHAR(assigned_date, 'YYYY-MM-DD HH24:MI:SS') || ''', ' ||
    COALESCE('''' || REPLACE(notes, '''', '''''') || '''', 'NULL') || ', ' ||
    '''' || TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') || ''', ' ||
    '''' || TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') || '''' ||
    ');' AS insert_statement
FROM user_course_mappings
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
ORDER BY end_user_id, course_id;

-- Expected Output Example:
-- INSERT INTO user_course_mappings (id, project_id, end_user_id, course_id, assigned_by, assigned_date, notes, created_at, updated_at) VALUES (1, '00000000-0000-0000-0000-000000000001', 1, 'C001', 'admin', '2025-01-29 10:00:00', 'Mandatory safety training', '2025-01-29 10:00:00', '2025-01-29 10:00:00');


-- =====================================================
-- COMBINED EXPORT (ALL DATA AT ONCE)
-- =====================================================
-- Run this if you want all INSERT statements in order
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

-- Step 1: Training Locations
SELECT
    1 AS export_order,
    'training_locations' AS table_name,
    'INSERT INTO training_locations (id, name, display_order, active, project_id) VALUES (' ||
    id::TEXT || ', ' ||
    '''' || REPLACE(name, '''', '''''') || ''', ' ||
    COALESCE(display_order::TEXT, 'NULL') || ', ' ||
    CASE WHEN active THEN 'True' ELSE 'False' END || ', ' ||
    '''00000000-0000-0000-0000-000000000001''' ||
    ');' AS insert_statement
FROM training_locations
WHERE project_id = 'YOUR_PROJECT_ID_HERE'

UNION ALL

-- Step 2: Courses
SELECT
    2 AS export_order,
    'courses' AS table_name,
    'INSERT INTO courses (course_id, course_name, functional_area, duration_hrs, application, priority, project_id) VALUES (' ||
    '''' || REPLACE(course_id, '''', '''''') || ''', ' ||
    '''' || REPLACE(course_name, '''', '''''') || ''', ' ||
    '''' || REPLACE(functional_area, '''', '''''') || ''', ' ||
    COALESCE(duration_hrs::TEXT, 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(application, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE(priority::TEXT, 'NULL') || ', ' ||
    '''00000000-0000-0000-0000-000000000001''' ||
    ');' AS insert_statement
FROM courses
WHERE project_id = 'YOUR_PROJECT_ID_HERE'

UNION ALL

-- Step 3: End Users
SELECT
    3 AS export_order,
    'end_users' AS table_name,
    'INSERT INTO end_users (id, name, email, job_title, training_location, project_role, organisation, project_id) VALUES (' ||
    id::TEXT || ', ' ||
    '''' || REPLACE(name, '''', '''''') || ''', ' ||
    COALESCE('''' || REPLACE(email, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(job_title, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(training_location, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(project_role, '''', '''''') || '''', 'NULL') || ', ' ||
    COALESCE('''' || REPLACE(organisation, '''', '''''') || '''', 'NULL') || ', ' ||
    '''00000000-0000-0000-0000-000000000001''' ||
    ');' AS insert_statement
FROM end_users
WHERE project_id = 'YOUR_PROJECT_ID_HERE'

ORDER BY export_order, insert_statement;


-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================
--
-- 1. FIND YOUR PROJECT ID:
--    SELECT id, name FROM projects WHERE name LIKE '%your_project_name%';
--
-- 2. REPLACE PLACEHOLDER:
--    In all scripts above, replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID
--    Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--
-- 3. RUN SCRIPTS IN SUPABASE:
--    - Open Supabase Dashboard → SQL Editor
--    - Copy/paste one of the export scripts above
--    - Execute the query
--    - Copy the results (INSERT statements)
--
-- 4. IMPORT TO MS ACCESS:
--    - Open your Access database
--    - Create → Query Design → SQL View
--    - Paste the INSERT statements
--    - Run the query (or run statements individually)
--
-- 5. VERIFY DATA:
--    In MS Access, open each table and verify records imported correctly
--
-- 6. ORDER OF IMPORT:
--    1. training_locations (no dependencies)
--    2. courses (no dependencies)
--    3. lines_of_business (if not using sample data)
--    4. end_users (depends on training_locations)
--    5. end_user_lob_assignments (depends on end_users + lines_of_business)
--    6. course_lob_assignments (depends on courses + lines_of_business)
--    7. user_course_mappings (depends on end_users + courses)
--
-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
--
-- Issue: "String too long" error in MS Access
-- Solution: MS Access TEXT fields limited to 255 characters by default
--           Use MEMO type for longer text (notes, descriptions)
--           Or truncate long values in export:
--           SUBSTRING(notes, 1, 255)
--
-- Issue: "Duplicate key" error in MS Access
-- Solution: Check for existing records with same ID
--           Delete existing data or use UPDATE instead of INSERT
--
-- Issue: Foreign key constraint violation
-- Solution: Import tables in correct order (see step 6 above)
--           Ensure parent records exist before child records
--
-- Issue: Date format error
-- Solution: MS Access may require different date format
--           Try: #MM/DD/YYYY HH:MM:SS# instead of 'YYYY-MM-DD HH24:MI:SS'
--
-- Issue: NULL handling
-- Solution: Replace NULL with empty string for TEXT fields:
--           COALESCE(field_name, '') instead of COALESCE(field_name, 'NULL')
--
-- =====================================================
-- ALTERNATIVE: CSV EXPORT
-- =====================================================
--
-- If SQL INSERT statements don't work well, use CSV export instead:
--
-- 1. In PostgreSQL/Supabase:
--    COPY (SELECT * FROM end_users WHERE project_id = 'YOUR_PROJECT_ID_HERE')
--    TO '/path/to/end_users.csv' WITH CSV HEADER;
--
-- 2. In MS Access:
--    External Data → Import → Text File → Select CSV
--    Map columns to your table
--
-- 3. Advantages:
--    - Simpler for large datasets
--    - Handles special characters better
--    - Less prone to SQL syntax issues
--
-- 4. Disadvantages:
--    - Need to map columns manually
--    - Harder to customize data during import
--    - May lose data types (dates, booleans)
--
-- =====================================================
