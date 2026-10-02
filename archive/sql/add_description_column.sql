-- Add missing description column to training_schedules table

ALTER TABLE training_schedules
ADD COLUMN IF NOT EXISTS description TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_schedules'
ORDER BY ordinal_position;
