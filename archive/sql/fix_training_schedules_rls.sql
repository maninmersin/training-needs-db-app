-- Fix RLS policies for training_schedules table

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view schedules for their projects" ON training_schedules;
DROP POLICY IF EXISTS "Users can insert schedules for their projects" ON training_schedules;
DROP POLICY IF EXISTS "Users can update schedules for their projects" ON training_schedules;
DROP POLICY IF EXISTS "Users can delete schedules for their projects" ON training_schedules;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON training_schedules;

-- Enable RLS
ALTER TABLE training_schedules ENABLE ROW LEVEL SECURITY;

-- Create simple policy: Allow all authenticated users full access
-- (This matches the approach we used for training_data, courses, etc.)
CREATE POLICY "Allow authenticated users full access" ON training_schedules
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON training_schedules TO authenticated;

-- Verify the policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'training_schedules'
ORDER BY policyname;
