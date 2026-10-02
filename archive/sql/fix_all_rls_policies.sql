-- Comprehensive RLS fix for infinite recursion issues
-- This fixes both project_users and training_data tables

-- ============================================================================
-- FIX 1: project_users table
-- ============================================================================

-- Drop all existing policies on project_users
DROP POLICY IF EXISTS "Users can view project memberships" ON project_users;
DROP POLICY IF EXISTS "Users can view their own project memberships" ON project_users;
DROP POLICY IF EXISTS "Users can insert project memberships" ON project_users;
DROP POLICY IF EXISTS "Users can update project memberships" ON project_users;
DROP POLICY IF EXISTS "Users can delete project memberships" ON project_users;
DROP POLICY IF EXISTS "Project owners can manage memberships" ON project_users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON project_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON project_users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON project_users;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON project_users;
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_users;
DROP POLICY IF EXISTS "Users can view project memberships for their projects" ON project_users;
DROP POLICY IF EXISTS "Project owners can add members" ON project_users;
DROP POLICY IF EXISTS "Project owners can update members" ON project_users;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_users;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON project_users;

-- Create simple non-recursive policy for project_users
CREATE POLICY "Allow authenticated users full access" ON project_users
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX 2: training_data table
-- ============================================================================

-- Drop all existing policies on training_data
DROP POLICY IF EXISTS "Users can view training data for their projects" ON training_data;
DROP POLICY IF EXISTS "Users can insert training data for their projects" ON training_data;
DROP POLICY IF EXISTS "Users can update training data for their projects" ON training_data;
DROP POLICY IF EXISTS "Users can delete training data for their projects" ON training_data;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON training_data;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON training_data;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON training_data;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON training_data;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON training_data;

-- Create simple non-recursive policy for training_data
CREATE POLICY "Allow authenticated users full access" ON training_data
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all policies for both tables
SELECT
  'project_users' as table_name,
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'project_users'

UNION ALL

SELECT
  'training_data' as table_name,
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'training_data'

ORDER BY table_name, policyname;
