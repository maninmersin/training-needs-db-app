-- Fix NOT NULL constraints on training_sessions
-- The save_schedule function is using start_datetime/end_datetime instead of session_date/start_time/end_time
-- Make all these old columns nullable since we're using the new datetime columns

-- First, let's see the current constraints
SELECT column_name, is_nullable, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'training_sessions'
  AND column_name IN ('session_date', 'start_time', 'end_time', 'duration_hrs')
ORDER BY column_name;

-- Make all old time/date columns nullable (we're using start_datetime/end_datetime instead)
ALTER TABLE training_sessions
ALTER COLUMN session_date DROP NOT NULL,
ALTER COLUMN start_time DROP NOT NULL,
ALTER COLUMN end_time DROP NOT NULL,
ALTER COLUMN duration_hrs DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'training_sessions'
  AND column_name IN ('session_date', 'start_time', 'end_time', 'duration_hrs')
ORDER BY column_name;
