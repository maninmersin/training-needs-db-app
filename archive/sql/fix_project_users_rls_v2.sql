-- Fix infinite recursion in project_users RLS policies
-- Strategy: Use simpler policies that don't create circular dependencies

-- Drop all existing policies
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

-- TEMPORARY FIX: Allow all authenticated users full access to project_users
-- This bypasses the recursion issue while we work on the import
-- We can add more restrictive policies later

CREATE POLICY "Allow authenticated users full access" ON project_users
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify RLS is enabled
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;

-- Show the new policies
SELECT
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'project_users'
ORDER BY policyname;
