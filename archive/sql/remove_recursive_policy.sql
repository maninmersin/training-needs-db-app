-- Remove the remaining recursive policy on project_users

DROP POLICY IF EXISTS "Users can view project members" ON project_users;

-- Verify only the simple policy remains
SELECT
  tablename,
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'project_users'
ORDER BY policyname;
