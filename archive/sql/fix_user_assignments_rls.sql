-- Fix user_assignments RLS policies
-- Allow authenticated users to insert/update/delete assignments for their projects

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assignments for their projects" ON user_assignments;
DROP POLICY IF EXISTS "Users can insert assignments for their projects" ON user_assignments;
DROP POLICY IF EXISTS "Users can update assignments for their projects" ON user_assignments;
DROP POLICY IF EXISTS "Users can delete assignments for their projects" ON user_assignments;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON user_assignments;

-- Enable RLS
ALTER TABLE user_assignments ENABLE ROW LEVEL SECURITY;

-- Create simple policy for authenticated users
-- This allows full access to assignments for projects the user has access to
CREATE POLICY "Allow authenticated users full access" ON user_assignments
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND project_id IN (
      SELECT pu.project_id FROM project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND project_id IN (
      SELECT pu.project_id FROM project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_assignments TO authenticated;

-- Verify policy was created
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_assignments';
