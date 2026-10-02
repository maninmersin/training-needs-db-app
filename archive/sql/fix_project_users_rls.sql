-- Fix infinite recursion in project_users RLS policies
-- This script drops the problematic policies and creates simple, non-recursive ones

-- Drop existing policies
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

-- Create simple, non-recursive policies for project_users
-- Policy 1: Users can view their own memberships (no recursion)
CREATE POLICY "Users can view their own memberships" ON project_users
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Users can view memberships of projects they belong to (using direct auth check)
CREATE POLICY "Users can view project memberships for their projects" ON project_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu2
      WHERE pu2.project_id = project_users.project_id
        AND pu2.user_id = auth.uid()
        AND pu2.is_active = true
    )
  );

-- Policy 3: Project owners can insert new memberships
CREATE POLICY "Project owners can add members" ON project_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_users pu2
      WHERE pu2.project_id = project_users.project_id
        AND pu2.user_id = auth.uid()
        AND pu2.role IN ('owner', 'admin')
        AND pu2.is_active = true
    )
  );

-- Policy 4: Project owners can update memberships
CREATE POLICY "Project owners can update members" ON project_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu2
      WHERE pu2.project_id = project_users.project_id
        AND pu2.user_id = auth.uid()
        AND pu2.role IN ('owner', 'admin')
        AND pu2.is_active = true
    )
  );

-- Policy 5: Project owners can delete memberships
CREATE POLICY "Project owners can remove members" ON project_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_users pu2
      WHERE pu2.project_id = project_users.project_id
        AND pu2.user_id = auth.uid()
        AND pu2.role IN ('owner', 'admin')
        AND pu2.is_active = true
    )
  );

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
