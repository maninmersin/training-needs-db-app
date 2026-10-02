-- Make instructor_id column nullable in training_sessions table
-- This allows training sessions to be saved without assigning an instructor

-- Check current constraint
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'training_sessions'
AND column_name = 'instructor_id';

-- Make the column nullable if it's currently NOT NULL
ALTER TABLE training_sessions
ALTER COLUMN instructor_id DROP NOT NULL;

-- Verify the change
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'training_sessions'
AND column_name = 'instructor_id';

-- Optional: Add a comment explaining this is for future use
COMMENT ON COLUMN training_sessions.instructor_id IS
'Instructor assignment - nullable to allow scheduling without instructor assignment. To be implemented in future instructor management feature.';
