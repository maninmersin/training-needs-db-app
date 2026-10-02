-- Fix user_assignments table schema - add missing session_identifier column
-- This column is needed to link assignments to specific training sessions

-- First, check current table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_assignments'
ORDER BY ordinal_position;

-- Add missing session_identifier column
-- This should match the session_identifier format used in training_sessions table
ALTER TABLE user_assignments
ADD COLUMN IF NOT EXISTS session_identifier TEXT;

-- Create index for performance (frequently queried)
CREATE INDEX IF NOT EXISTS idx_user_assignments_session_identifier ON user_assignments(session_identifier);

-- Add other commonly needed columns if missing
ALTER TABLE user_assignments
ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(course_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS training_location TEXT,
ADD COLUMN IF NOT EXISTS functional_area TEXT,
ADD COLUMN IF NOT EXISTS assignment_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS assigned_by TEXT,
ADD COLUMN IF NOT EXISTS assignment_level TEXT DEFAULT 'session',
ADD COLUMN IF NOT EXISTS group_identifier TEXT,
ADD COLUMN IF NOT EXISTS assignment_method TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS assignment_source TEXT DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS exception_reason TEXT,
ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'enrolled',
ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS session_id UUID,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'not_attended',
ADD COLUMN IF NOT EXISTS attendance_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS attendance_notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_assignments_course_id ON user_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user_id ON user_assignments(user_id);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_assignments'
ORDER BY ordinal_position;
