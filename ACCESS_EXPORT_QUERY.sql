-- =====================================================
-- MS ACCESS EXPORT QUERY FOR TRAINING SCHEDULE CREATOR
-- UPDATED FOR YOUR ACTUAL DATABASE STRUCTURE
-- =====================================================
-- This query creates a flat table with all data needed for the TSC Wizard
-- Each row represents one user-course assignment
--
-- YOUR STRUCTURE:
-- - functional_area.ID = course identifier
-- - sub_functional_area = course name
-- - est_duration_hrs = course duration
-- - Users mapped via user_course_mappings to functional_area.ID
--
-- INSTRUCTIONS:
-- 1. Copy this SQL into MS Access Query Design (SQL View)
-- 2. Run the query to preview data
-- 3. Export results to CSV: External Data → Export → Text File
-- 4. Save as: training_data_export.csv
-- =====================================================

SELECT
    -- Course Information (from functional_area table)
    fa.ID AS ID,  -- This is the course identifier
    fa.functional_area AS functional_area,  -- Category (e.g., "Procurement")
    fa.sub_functional_area AS sub_functional_area,  -- Course name (e.g., "Purchasing")
    fa.est_duration_hrs AS est_duration_hrs,  -- Course duration in hours

    -- User Information (from end_users table)
    eu.emp_id AS emp_id,  -- User identifier
    eu.name AS name,  -- User full name
    eu.[business-unit] AS [business-unit],  -- Note: Keep hyphen as-is from Access
    eu.org AS org,  -- Organization
    eu.country AS country,  -- User country
    eu.department AS department,  -- User department
    eu.job_title AS job_title,  -- User job title
    eu.email AS email,  -- User email
    eu.location AS location,  -- User physical location
    eu.training_location AS training_location,  -- CRITICAL: Used for grouping sessions
    eu.project_role AS project_role,  -- User project role

    -- Metadata (from user_course_mappings table)
    ucm.assigned_by AS assigned_by,  -- Who assigned this course
    ucm.assigned_date AS assigned_date,  -- When it was assigned
    ucm.notes AS notes  -- Any assignment notes

FROM
    (user_course_mappings ucm
    INNER JOIN end_users eu ON ucm.end_user_id = eu.emp_id)
    INNER JOIN functional_area fa ON ucm.functional_id = fa.ID

WHERE
    -- Optional: Filter by project_id if you have multiple projects
    -- ucm.project_id = 'your-project-id-here'
    -- AND

    -- Only include active assignments
    eu.emp_id IS NOT NULL
    AND fa.ID IS NOT NULL

ORDER BY
    eu.training_location,  -- Group by location for easier review
    eu.name,               -- Then by user name
    fa.ID;                 -- Then by course ID


-- =====================================================
-- EXPECTED OUTPUT COLUMNS (in this order):
-- =====================================================
-- ID, functional_area, sub_functional_area, est_duration_hrs,
-- emp_id, name, business-unit, org, country, department,
-- job_title, email, location, training_location, project_role,
-- assigned_by, assigned_date, notes

-- =====================================================
-- EXPECTED ROW COUNT:
-- =====================================================
-- Based on your data:
-- - ~1000 users
-- - Each user assigned to functional areas
-- - Result: Multiple rows per user (one per course assignment)

-- =====================================================
-- EXPORT INSTRUCTIONS:
-- =====================================================
-- After running query successfully:
-- 1. Click "External Data" tab in Access
-- 2. Click "Text File" in Export section
-- 3. Choose location and filename: training_data_export.csv
-- 4. Click OK
-- 5. Choose "Delimited" format
-- 6. Choose "Comma" delimiter
-- 7. ✅ CHECK "Include Field Names on First Row" (IMPORTANT!)
-- 8. Click Finish
-- 9. Do NOT save export steps (unless you want to repeat regularly)

-- =====================================================
-- VALIDATION QUERIES (Run these to verify data):
-- =====================================================

-- Check user count:
-- SELECT COUNT(DISTINCT emp_id) AS total_users FROM end_users;

-- Check functional areas (courses):
-- SELECT ID, functional_area, sub_functional_area, est_duration_hrs
-- FROM functional_area
-- ORDER BY functional_area, sub_functional_area;

-- Check mapping count:
-- SELECT COUNT(*) AS total_mappings FROM user_course_mappings;

-- Preview first 10 rows of export:
-- SELECT TOP 10 * FROM [paste the main query here]

-- =====================================================
-- TROUBLESHOOTING:
-- =====================================================
-- If you get no results:
-- 1. Check that user_course_mappings table has data
-- 2. Verify foreign keys match (emp_id, functional_id)
-- 3. Remove WHERE clause filters temporarily
-- 4. Run individual table queries to verify data exists

-- If you get unexpected duplicates:
-- 1. This is EXPECTED if users have multiple course assignments
-- 2. Each row = one user-course assignment
-- 3. TSC Wizard deduplicates courses by ID automatically

-- If training_location is blank:
-- 1. This field is CRITICAL for session grouping
-- 2. Update end_users table to populate training_location
-- 3. Use a default value if needed (e.g., "Default Location")

-- =====================================================
-- ALTERNATIVE: IF YOU ALREADY HAVE THIS QUERY
-- =====================================================
-- Based on your sample data, it looks like you may already have
-- a query that produces exactly this output!
--
-- If so, you can simply:
-- 1. Open your existing query in Access
-- 2. Export it to CSV following the export instructions above
-- 3. Skip creating a new query
--
-- The import component will handle the column name mapping automatically!
