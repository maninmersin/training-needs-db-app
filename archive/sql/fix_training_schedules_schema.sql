-- Fix training_schedules table schema - add all missing columns

-- Add missing columns
ALTER TABLE training_schedules
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS functional_areas TEXT[],
ADD COLUMN IF NOT EXISTS training_locations TEXT[],
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS scheduled_start_date DATE,
ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

-- Create index on project_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_training_schedules_project_id ON training_schedules(project_id);

-- Create index on created_at if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_training_schedules_created_at ON training_schedules(created_at);

-- Verify the columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_schedules'
ORDER BY ordinal_position;
