-- Add instructor_id column to training_sessions table if it doesn't exist
-- This script is safe to run multiple times

-- Check if the column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'training_sessions'
        AND column_name = 'instructor_id'
    ) THEN
        -- Add the column with a default value
        ALTER TABLE training_sessions
        ADD COLUMN instructor_id INTEGER DEFAULT 0;

        RAISE NOTICE 'instructor_id column added successfully';
    ELSE
        RAISE NOTICE 'instructor_id column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'training_sessions'
AND column_name = 'instructor_id';

-- Add a comment explaining this column
COMMENT ON COLUMN training_sessions.instructor_id IS
'Instructor assignment - 0 = unassigned. To be implemented in future instructor management feature.';
