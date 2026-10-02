-- =====================================================
-- SUPABASE FLAT TABLE SCHEMA FOR TRAINING DATA
-- Single Table Approach - All Training Schedule Data
-- =====================================================
-- This table contains all data needed for TSC Wizard in a denormalized format
-- Each row = one user-course assignment
-- Expected size: ~10,000 rows (1000 users × avg 10 courses each)
-- =====================================================

-- Drop existing table if recreating
DROP TABLE IF EXISTS training_data CASCADE;

-- Create the flat table
CREATE TABLE training_data (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User Information (for grouping and identification)
  user_id TEXT NOT NULL,  -- emp_id from Access
  user_name TEXT NOT NULL,
  user_email TEXT,
  business_unit TEXT,
  organization TEXT,
  user_country TEXT,
  user_department TEXT,
  user_job_title TEXT,
  user_location TEXT,
  training_location TEXT NOT NULL,  -- CRITICAL: Used for session grouping
  user_project_role TEXT,

  -- Course Information (for scheduling)
  course_id TEXT NOT NULL,  -- CRITICAL: Used to match users to courses
  course_name TEXT NOT NULL,  -- CRITICAL: Used in session titles
  duration_hrs NUMERIC NOT NULL,  -- CRITICAL: Used for scheduling calculations
  course_topic TEXT,
  course_sub_topic TEXT,
  course_application TEXT,
  course_priority INTEGER DEFAULT 1,

  -- Functional Area Information (for filtering/organization)
  functional_area TEXT NOT NULL,  -- CRITICAL: Used for wizard filtering
  sub_functional_area TEXT,
  functional_area_short TEXT,

  -- Metadata
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_by TEXT DEFAULT 'import',
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  assignment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent exact duplicates (same user, same course, same project)
  CONSTRAINT unique_user_course_project UNIQUE(user_id, course_id, project_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Most common query: fetch all training data for a project
CREATE INDEX idx_training_data_project_id
  ON training_data(project_id);

-- TSC Wizard groups by training_location
CREATE INDEX idx_training_data_training_location
  ON training_data(training_location);

-- Filter by functional_area in wizard
CREATE INDEX idx_training_data_functional_area
  ON training_data(functional_area);

-- Lookup by user
CREATE INDEX idx_training_data_user_id
  ON training_data(user_id);

-- Lookup by course
CREATE INDEX idx_training_data_course_id
  ON training_data(course_id);

-- Composite index for TSC Wizard query (most efficient)
CREATE INDEX idx_training_data_project_location
  ON training_data(project_id, training_location);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view training data for their projects
CREATE POLICY "Users can view training data for their projects"
  ON training_data
  FOR SELECT
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
    )
  );

-- Policy: Users can insert training data for their projects
CREATE POLICY "Users can insert training data for their projects"
  ON training_data
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can update training data for their projects
CREATE POLICY "Users can update training data for their projects"
  ON training_data
  FOR UPDATE
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can delete training data for their projects
CREATE POLICY "Users can delete training data for their projects"
  ON training_data
  FOR DELETE
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_training_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_data_updated_at
  BEFORE UPDATE ON training_data
  FOR EACH ROW
  EXECUTE FUNCTION update_training_data_updated_at();

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON training_data TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get unique courses for a project
CREATE OR REPLACE FUNCTION get_project_courses(p_project_id UUID)
RETURNS TABLE (
  course_id TEXT,
  course_name TEXT,
  duration_hrs NUMERIC,
  functional_area TEXT,
  course_topic TEXT,
  course_priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    td.course_id,
    td.course_name,
    td.duration_hrs,
    td.functional_area,
    td.course_topic,
    td.course_priority
  FROM training_data td
  WHERE td.project_id = p_project_id
  ORDER BY td.course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get unique users for a project
CREATE OR REPLACE FUNCTION get_project_users(p_project_id UUID)
RETURNS TABLE (
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  training_location TEXT,
  user_project_role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    td.user_id,
    td.user_name,
    td.user_email,
    td.training_location,
    td.user_project_role
  FROM training_data td
  WHERE td.project_id = p_project_id
  ORDER BY td.user_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get training data statistics
CREATE OR REPLACE FUNCTION get_training_data_stats(p_project_id UUID)
RETURNS TABLE (
  total_assignments INTEGER,
  unique_users INTEGER,
  unique_courses INTEGER,
  unique_locations INTEGER,
  unique_functional_areas INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_assignments,
    COUNT(DISTINCT td.user_id)::INTEGER AS unique_users,
    COUNT(DISTINCT td.course_id)::INTEGER AS unique_courses,
    COUNT(DISTINCT td.training_location)::INTEGER AS unique_locations,
    COUNT(DISTINCT td.functional_area)::INTEGER AS unique_functional_areas
  FROM training_data td
  WHERE td.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_project_courses(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_training_data_stats(UUID) TO authenticated;

-- =====================================================
-- VALIDATION QUERIES (Run after import to verify data)
-- =====================================================

-- Check total records
-- SELECT COUNT(*) AS total_records FROM training_data;

-- Check unique counts
-- SELECT
--   COUNT(DISTINCT user_id) AS unique_users,
--   COUNT(DISTINCT course_id) AS unique_courses,
--   COUNT(DISTINCT training_location) AS unique_locations
-- FROM training_data;

-- Check data distribution by location
-- SELECT
--   training_location,
--   COUNT(DISTINCT user_id) AS users,
--   COUNT(DISTINCT course_id) AS courses,
--   COUNT(*) AS assignments
-- FROM training_data
-- GROUP BY training_location
-- ORDER BY assignments DESC;

-- Check data distribution by functional area
-- SELECT
--   functional_area,
--   COUNT(DISTINCT course_id) AS courses,
--   COUNT(DISTINCT user_id) AS users,
--   COUNT(*) AS assignments
-- FROM training_data
-- GROUP BY functional_area
-- ORDER BY assignments DESC;

-- Preview sample data
-- SELECT
--   user_name,
--   training_location,
--   course_name,
--   duration_hrs,
--   functional_area
-- FROM training_data
-- LIMIT 10;

-- =====================================================
-- NOTES
-- =====================================================

-- Advantages of this approach:
-- 1. Single CSV import - no need for multiple tables
-- 2. Simple queries - no JOINs needed for TSC Wizard
-- 3. Fast performance - all data pre-joined
-- 4. Easy to understand - one row = one assignment
-- 5. Easy to export back to CSV for MS Access

-- Disadvantages:
-- 1. Data duplication (user info repeated per course)
-- 2. Larger table size (~10,000 rows vs. 1,000 users + 700 courses)
-- 3. Not normalized (but acceptable for interim solution)

-- For a temporary/interim solution (few months), this is the ideal approach!

-- =====================================================
-- END OF SCHEMA
-- =====================================================
