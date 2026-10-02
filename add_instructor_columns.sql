-- Add instructor_id and instructor_name columns to training_sessions table
-- This script is safe to run multiple times

-- Add instructor_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'training_sessions'
        AND column_name = 'instructor_id'
    ) THEN
        ALTER TABLE training_sessions
        ADD COLUMN instructor_id INTEGER DEFAULT 0;
        RAISE NOTICE 'instructor_id column added successfully';
    ELSE
        RAISE NOTICE 'instructor_id column already exists';
    END IF;
END $$;

-- Add instructor_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'training_sessions'
        AND column_name = 'instructor_name'
    ) THEN
        ALTER TABLE training_sessions
        ADD COLUMN instructor_name TEXT DEFAULT '';
        RAISE NOTICE 'instructor_name column added successfully';
    ELSE
        RAISE NOTICE 'instructor_name column already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'training_sessions'
AND column_name IN ('instructor_id', 'instructor_name')
ORDER BY column_name;

-- Add comments explaining these columns
COMMENT ON COLUMN training_sessions.instructor_id IS
'Instructor assignment ID - 0 = unassigned. To be implemented in future instructor management feature.';

COMMENT ON COLUMN training_sessions.instructor_name IS
'Instructor name - empty string = unassigned. To be implemented in future instructor management feature.';
