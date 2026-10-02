-- Fix training_sessions table schema - add all missing columns

-- Add missing columns
ALTER TABLE training_sessions
ADD COLUMN IF NOT EXISTS classroom_number INTEGER,
ADD COLUMN IF NOT EXISTS session_identifier TEXT,
ADD COLUMN IF NOT EXISTS group_identifier TEXT,
ADD COLUMN IF NOT EXISTS session_number INTEGER,
ADD COLUMN IF NOT EXISTS session_part_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS part_suffix TEXT,
ADD COLUMN IF NOT EXISTS user_count INTEGER,
ADD COLUMN IF NOT EXISTS user_range TEXT,
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS course_day_sequence INTEGER,
ADD COLUMN IF NOT EXISTS course_name TEXT,
ADD COLUMN IF NOT EXISTS delivery_method TEXT,
ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS functional_area TEXT,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS is_multi_day_course BOOLEAN,
ADD COLUMN IF NOT EXISTS part_of_total TEXT,
ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS session_title TEXT;

-- Create indexes for performance (skip indexes that reference non-existent columns)
CREATE INDEX IF NOT EXISTS idx_training_sessions_schedule_id ON training_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_session_identifier ON training_sessions(session_identifier);
CREATE INDEX IF NOT EXISTS idx_training_sessions_group_identifier ON training_sessions(group_identifier);

-- Fix RLS policies
DROP POLICY IF EXISTS "Users can view sessions for their projects" ON training_sessions;
DROP POLICY IF EXISTS "Users can insert sessions for their projects" ON training_sessions;
DROP POLICY IF EXISTS "Users can update sessions for their projects" ON training_sessions;
DROP POLICY IF EXISTS "Users can delete sessions for their projects" ON training_sessions;
DROP POLICY IF EXISTS "Allow authenticated users full access" ON training_sessions;

-- Enable RLS
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON training_sessions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON training_sessions TO authenticated;

-- Verify the columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_sessions'
ORDER BY ordinal_position;
