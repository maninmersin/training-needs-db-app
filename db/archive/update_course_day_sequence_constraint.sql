-- Update course_day_sequence constraint to allow more days
-- Current limit: 3 days
-- New limit: 20 days (allows for longer multi-day courses)

-- Step 1: Drop the existing constraint
ALTER TABLE training_sessions
DROP CONSTRAINT IF EXISTS check_course_day_sequence_max;

-- Step 2: Add the new constraint with higher limit
ALTER TABLE training_sessions
ADD CONSTRAINT check_course_day_sequence_max
CHECK (course_day_sequence <= 20);

-- Verification: Check the new constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'check_course_day_sequence_max';
