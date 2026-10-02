-- =====================================================
-- MS ACCESS TO POSTGRESQL IMPORT SCRIPTS
-- =====================================================
-- Purpose: Import individual course assignments from MS Access back to PostgreSQL
-- Target: user_course_mappings table in your main application database
-- Usage: After testing individual mappings in Access, use these scripts to import
--        the assignment data back into your production PostgreSQL database
-- =====================================================

-- =====================================================
-- PREPARATION STEP 1: EXPORT FROM MS ACCESS
-- =====================================================
-- In MS Access, run this query to export user_course_mappings to CSV:

-- SELECT
--     end_user_id,
--     course_id,
--     assigned_by,
--     assigned_date,
--     notes
-- FROM user_course_mappings
-- ORDER BY end_user_id, course_id;

-- Save as CSV file: user_course_mappings_from_access.csv
-- Column headers: end_user_id, course_id, assigned_by, assigned_date, notes


-- =====================================================
-- PREPARATION STEP 2: VALIDATE ACCESS DATA
-- =====================================================
-- Before importing, validate the data in MS Access to ensure data quality

-- Check for duplicate assignments (should return no records):
-- SELECT end_user_id, course_id, COUNT(*) as count
-- FROM user_course_mappings
-- GROUP BY end_user_id, course_id
-- HAVING COUNT(*) > 1;

-- Check for invalid user IDs (should return no records):
-- SELECT DISTINCT ucm.end_user_id
-- FROM user_course_mappings ucm
-- LEFT JOIN end_users eu ON ucm.end_user_id = eu.id
-- WHERE eu.id IS NULL;

-- Check for invalid course IDs (should return no records):
-- SELECT DISTINCT ucm.course_id
-- FROM user_course_mappings ucm
-- LEFT JOIN courses c ON ucm.course_id = c.course_id
-- WHERE c.course_id IS NULL;


-- =====================================================
-- IMPORT METHOD 1: DIRECT SQL INSERT (MANUAL)
-- =====================================================
-- Use this if you have a small number of assignments to import
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID

-- Example: Import single assignment
INSERT INTO user_course_mappings (
    project_id,
    end_user_id,
    course_id,
    assigned_by,
    assigned_date,
    notes
)
VALUES (
    'YOUR_PROJECT_ID_HERE',  -- Your actual project UUID
    1,                        -- end_user_id from Access
    'C001',                   -- course_id from Access
    'admin',                  -- assigned_by from Access
    NOW(),                    -- or specific date from Access
    'Tested in MS Access'     -- notes from Access
)
ON CONFLICT (end_user_id, course_id) DO NOTHING;  -- Prevent duplicates

-- Repeat for each assignment, or batch multiple INSERTs


-- =====================================================
-- IMPORT METHOD 2: CSV IMPORT (RECOMMENDED FOR BULK)
-- =====================================================
-- Use this for importing many assignments at once

-- Step 1: Create temporary staging table
CREATE TEMP TABLE user_course_mappings_staging (
    end_user_id INTEGER,
    course_id TEXT,
    assigned_by TEXT,
    assigned_date TIMESTAMP,
    notes TEXT
);

-- Step 2: Import CSV data into staging table
-- In Supabase Dashboard: Storage → Upload CSV → Import to staging table
-- Or use psql command:
-- \copy user_course_mappings_staging FROM '/path/to/user_course_mappings_from_access.csv' WITH CSV HEADER;

-- Step 3: Validate staging data before import
-- Check for users that don't exist in your project
SELECT DISTINCT s.end_user_id
FROM user_course_mappings_staging s
LEFT JOIN end_users eu ON s.end_user_id = eu.id
WHERE eu.id IS NULL;
-- If this returns records, you need to fix user IDs or import users first

-- Check for courses that don't exist in your project
SELECT DISTINCT s.course_id
FROM user_course_mappings_staging s
LEFT JOIN courses c ON s.course_id = c.course_id
WHERE c.course_id IS NULL;
-- If this returns records, you need to fix course IDs or import courses first

-- Check for duplicates with existing assignments
SELECT s.end_user_id, s.course_id, eu.name, c.course_name
FROM user_course_mappings_staging s
INNER JOIN user_course_mappings ucm ON (s.end_user_id = ucm.end_user_id AND s.course_id = ucm.course_id)
INNER JOIN end_users eu ON s.end_user_id = eu.id
INNER JOIN courses c ON s.course_id = c.course_id
WHERE ucm.project_id = 'YOUR_PROJECT_ID_HERE';
-- If this returns records, decide whether to skip or update existing assignments

-- Step 4: Import validated data from staging to production table
-- Replace 'YOUR_PROJECT_ID_HERE' with your actual project UUID
INSERT INTO user_course_mappings (
    project_id,
    end_user_id,
    course_id,
    assigned_by,
    assigned_date,
    notes,
    created_at,
    updated_at
)
SELECT
    'YOUR_PROJECT_ID_HERE'::UUID,  -- Your actual project UUID
    s.end_user_id,
    s.course_id,
    COALESCE(s.assigned_by, 'admin'),
    COALESCE(s.assigned_date, NOW()),
    s.notes,
    NOW(),
    NOW()
FROM user_course_mappings_staging s
INNER JOIN end_users eu ON s.end_user_id = eu.id  -- Only import if user exists
INNER JOIN courses c ON s.course_id = c.course_id  -- Only import if course exists
WHERE eu.project_id = 'YOUR_PROJECT_ID_HERE'  -- Ensure user belongs to project
ON CONFLICT (end_user_id, course_id) DO NOTHING;  -- Skip duplicates

-- Step 5: Verify import results
SELECT COUNT(*) AS imported_count FROM user_course_mappings WHERE project_id = 'YOUR_PROJECT_ID_HERE';

-- Step 6: Clean up staging table
DROP TABLE user_course_mappings_staging;


-- =====================================================
-- IMPORT METHOD 3: UPSERT (UPDATE EXISTING, INSERT NEW)
-- =====================================================
-- Use this if you want to update existing assignments with new data from Access

-- Assumes staging table exists (see Method 2 above)

INSERT INTO user_course_mappings (
    project_id,
    end_user_id,
    course_id,
    assigned_by,
    assigned_date,
    notes,
    created_at,
    updated_at
)
SELECT
    'YOUR_PROJECT_ID_HERE'::UUID,
    s.end_user_id,
    s.course_id,
    COALESCE(s.assigned_by, 'admin'),
    COALESCE(s.assigned_date, NOW()),
    s.notes,
    NOW(),
    NOW()
FROM user_course_mappings_staging s
INNER JOIN end_users eu ON s.end_user_id = eu.id
INNER JOIN courses c ON s.course_id = c.course_id
WHERE eu.project_id = 'YOUR_PROJECT_ID_HERE'
ON CONFLICT (end_user_id, course_id) DO UPDATE SET
    assigned_by = EXCLUDED.assigned_by,
    assigned_date = EXCLUDED.assigned_date,
    notes = EXCLUDED.notes,
    updated_at = NOW();


-- =====================================================
-- ID MAPPING STRATEGY (IF USER IDs CHANGED)
-- =====================================================
-- If end_user IDs in Access don't match PostgreSQL IDs, create a mapping table

-- Step 1: Create ID mapping table (one-time setup)
CREATE TEMP TABLE user_id_mapping (
    access_user_id INTEGER,
    postgres_user_id INTEGER,
    user_email TEXT,
    user_name TEXT
);

-- Step 2: Populate mapping by matching on email or name
INSERT INTO user_id_mapping (access_user_id, postgres_user_id, user_email, user_name)
SELECT
    -- This assumes you exported end_users.id from Access alongside the mappings
    access_eu.id AS access_user_id,
    pg_eu.id AS postgres_user_id,
    pg_eu.email,
    pg_eu.name
FROM end_users_from_access access_eu  -- Your Access export
INNER JOIN end_users pg_eu ON LOWER(access_eu.email) = LOWER(pg_eu.email)  -- Match on email
WHERE pg_eu.project_id = 'YOUR_PROJECT_ID_HERE';

-- Step 3: Import using ID mapping
INSERT INTO user_course_mappings (
    project_id,
    end_user_id,
    course_id,
    assigned_by,
    assigned_date,
    notes
)
SELECT
    'YOUR_PROJECT_ID_HERE'::UUID,
    mapping.postgres_user_id,  -- Use mapped PostgreSQL user ID
    s.course_id,
    COALESCE(s.assigned_by, 'admin'),
    COALESCE(s.assigned_date, NOW()),
    s.notes
FROM user_course_mappings_staging s
INNER JOIN user_id_mapping mapping ON s.end_user_id = mapping.access_user_id
INNER JOIN courses c ON s.course_id = c.course_id
ON CONFLICT (end_user_id, course_id) DO NOTHING;


-- =====================================================
-- POST-IMPORT VALIDATION QUERIES
-- =====================================================

-- Query 1: Count assignments per user
SELECT
    eu.id,
    eu.name,
    eu.email,
    COUNT(ucm.id) AS course_count
FROM end_users eu
LEFT JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
WHERE eu.project_id = 'YOUR_PROJECT_ID_HERE'
GROUP BY eu.id, eu.name, eu.email
ORDER BY course_count DESC, eu.name;

-- Query 2: List all imported assignments
SELECT
    eu.id AS user_id,
    eu.name AS user_name,
    c.course_id,
    c.course_name,
    ucm.assigned_by,
    ucm.assigned_date,
    ucm.notes
FROM user_course_mappings ucm
INNER JOIN end_users eu ON ucm.end_user_id = eu.id
INNER JOIN courses c ON ucm.course_id = c.course_id
WHERE ucm.project_id = 'YOUR_PROJECT_ID_HERE'
ORDER BY eu.name, c.course_id;

-- Query 3: Find users with no course assignments
SELECT
    eu.id,
    eu.name,
    eu.email,
    eu.project_role
FROM end_users eu
LEFT JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
WHERE eu.project_id = 'YOUR_PROJECT_ID_HERE'
  AND ucm.id IS NULL
ORDER BY eu.name;

-- Query 4: Course assignment summary
SELECT
    c.course_id,
    c.course_name,
    c.functional_area,
    COUNT(ucm.id) AS assigned_count
FROM courses c
LEFT JOIN user_course_mappings ucm ON c.course_id = ucm.course_id
WHERE c.project_id = 'YOUR_PROJECT_ID_HERE'
GROUP BY c.course_id, c.course_name, c.functional_area
ORDER BY assigned_count DESC, c.course_id;

-- Query 5: Verify no duplicates exist
SELECT end_user_id, course_id, COUNT(*) AS duplicate_count
FROM user_course_mappings
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
GROUP BY end_user_id, course_id
HAVING COUNT(*) > 1;
-- Should return no records


-- =====================================================
-- LINES OF BUSINESS (LoB) IMPORT (OPTIONAL)
-- =====================================================
-- If you created LoB assignments in Access, import them too

-- Step 1: Import end_user_lob_assignments
CREATE TEMP TABLE end_user_lob_assignments_staging (
    end_user_id INTEGER,
    lob_code TEXT,
    is_primary BOOLEAN
);

-- Import CSV or manual inserts here

-- Step 2: Validate and import LoB assignments
INSERT INTO end_user_lob_assignments (
    end_user_id,
    lob_code,
    is_primary,
    project_id
)
SELECT
    s.end_user_id,
    s.lob_code,
    s.is_primary,
    'YOUR_PROJECT_ID_HERE'::UUID
FROM end_user_lob_assignments_staging s
INNER JOIN end_users eu ON s.end_user_id = eu.id
INNER JOIN lines_of_business lob ON s.lob_code = lob.lob_code
WHERE eu.project_id = 'YOUR_PROJECT_ID_HERE'
ON CONFLICT (end_user_id, lob_code) DO NOTHING;

-- Step 3: Import course_lob_assignments
CREATE TEMP TABLE course_lob_assignments_staging (
    course_id TEXT,
    lob_code TEXT,
    is_mandatory BOOLEAN
);

-- Import CSV or manual inserts here

INSERT INTO course_lob_assignments (
    course_id,
    lob_code,
    is_mandatory,
    project_id
)
SELECT
    s.course_id,
    s.lob_code,
    s.is_mandatory,
    'YOUR_PROJECT_ID_HERE'::UUID
FROM course_lob_assignments_staging s
INNER JOIN courses c ON s.course_id = c.course_id
INNER JOIN lines_of_business lob ON s.lob_code = lob.lob_code
WHERE c.project_id = 'YOUR_PROJECT_ID_HERE'
ON CONFLICT (course_id, lob_code) DO NOTHING;


-- =====================================================
-- ROLLBACK PROCEDURE (IF IMPORT GOES WRONG)
-- =====================================================

-- If you need to undo the import, use these queries:

-- Step 1: Backup current data before rollback
CREATE TABLE user_course_mappings_backup_20250129 AS
SELECT * FROM user_course_mappings WHERE project_id = 'YOUR_PROJECT_ID_HERE';

-- Step 2: Delete imported assignments (be VERY careful with this!)
-- Option A: Delete all assignments for project (nuclear option)
-- DELETE FROM user_course_mappings WHERE project_id = 'YOUR_PROJECT_ID_HERE';

-- Option B: Delete only recent imports (safer)
DELETE FROM user_course_mappings
WHERE project_id = 'YOUR_PROJECT_ID_HERE'
  AND created_at > '2025-01-29 00:00:00'  -- Adjust to import start time
  AND assigned_by = 'admin';  -- Or whatever assigned_by value you used

-- Step 3: Verify deletion
SELECT COUNT(*) FROM user_course_mappings WHERE project_id = 'YOUR_PROJECT_ID_HERE';

-- Step 4: Restore from backup if needed
-- INSERT INTO user_course_mappings SELECT * FROM user_course_mappings_backup_20250129;


-- =====================================================
-- USAGE WORKFLOW SUMMARY
-- =====================================================
--
-- 1. TEST IN MS ACCESS
--    - Create Access database using access_database_schema.sql
--    - Import your end_users and courses from PostgreSQL
--    - Assign courses to individual users in Access
--    - Test the individual mapping approach
--    - Validate assignments meet your needs
--
-- 2. EXPORT FROM ACCESS
--    - Export user_course_mappings to CSV
--    - Validate data quality in Access before exporting
--    - Check for duplicates, missing users, invalid courses
--
-- 3. PREPARE POSTGRESQL
--    - Backup current user_course_mappings table (if data exists)
--    - Ensure user_course_mappings table exists in PostgreSQL
--    - Identify your project UUID
--
-- 4. IMPORT TO POSTGRESQL
--    - Create staging table
--    - Import CSV to staging
--    - Validate staging data
--    - Import to production table
--    - Verify results
--
-- 5. TEST IN MAIN APPLICATION
--    - Open TSC Wizard in your main app
--    - Verify individual course assignments appear correctly
--    - Generate training schedules
--    - Confirm calendar events created properly
--
-- 6. CLEAN UP
--    - Drop staging tables
--    - Update documentation
--    - Archive Access database for reference
--
-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
--
-- 1. ALWAYS BACKUP BEFORE IMPORT
--    - Create backup of user_course_mappings table
--    - Export current data to CSV
--    - Keep Access database as reference
--
-- 2. PROJECT ID MAPPING
--    - Access uses dummy project_id: '00000000-0000-0000-0000-000000000001'
--    - PostgreSQL uses real project UUID
--    - Always replace with actual project_id during import
--
-- 3. USER ID CONSISTENCY
--    - If possible, keep same user IDs in Access and PostgreSQL
--    - If IDs differ, use ID mapping strategy (see above)
--    - Match on email address or unique identifier
--
-- 4. COURSE ID CONSISTENCY
--    - Course IDs (course_id) should match exactly between systems
--    - Validate course_id exists in PostgreSQL before importing
--
-- 5. UNIQUE CONSTRAINT
--    - PostgreSQL enforces UNIQUE(end_user_id, course_id)
--    - Duplicate assignments will be rejected
--    - Use ON CONFLICT DO NOTHING or DO UPDATE strategy
--
-- 6. RLS POLICIES
--    - Row Level Security may affect import permissions
--    - Run imports as authenticated user with project access
--    - Or temporarily disable RLS for bulk import (then re-enable)
--
-- 7. PERFORMANCE
--    - For large imports (1000+ assignments), use COPY command
--    - Batch inserts in transactions (BEGIN; ... COMMIT;)
--    - Drop indexes during import, rebuild after
--
-- =====================================================
