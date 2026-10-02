-- Create a stub role_course_mappings table to prevent errors
-- This is a temporary solution until the Assignment view is updated for the flat table approach

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_course_mappings (
  id SERIAL PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  course_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_role_course_mappings_project_id ON role_course_mappings(project_id);

-- Enable RLS
ALTER TABLE role_course_mappings ENABLE ROW LEVEL SECURITY;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON role_course_mappings
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON role_course_mappings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE role_course_mappings_id_seq TO authenticated;
