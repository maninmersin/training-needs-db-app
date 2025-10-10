-- Add location_name field to end_users table
-- This adds a new optional text field for location name

-- Add the new column
ALTER TABLE end_users 
ADD COLUMN location_name text;

-- Add a comment to document the field
COMMENT ON COLUMN end_users.location_name IS 'Physical location or office name for the end user';

-- Verify the change
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'end_users' 
ORDER BY ordinal_position;