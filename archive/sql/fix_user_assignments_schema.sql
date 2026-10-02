-- Fix user_assignments table schema - add missing schedule_id column

-- First, check if the table exists and what columns it has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_assignments'
ORDER BY ordinal_position;

-- Add missing schedule_id column
ALTER TABLE user_assignments
ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES training_schedules(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_assignments_schedule_id ON user_assignments(schedule_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_assignments'
ORDER BY ordinal_position;
