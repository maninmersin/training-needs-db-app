-- Create active_training_locations view for calendar component
-- This view filters training_locations to only show active locations

-- Drop view if it exists
DROP VIEW IF EXISTS active_training_locations CASCADE;

-- Create view showing only active training locations
CREATE OR REPLACE VIEW active_training_locations
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  display_order,
  project_id,
  active as is_active,
  created_at,
  updated_at
FROM training_locations
WHERE active = true
ORDER BY display_order, name;

-- Grant permissions
GRANT SELECT ON active_training_locations TO authenticated;

-- Note: This view inherits RLS policies from training_locations table
-- Users will only see locations for their projects

-- Verify the view was created
SELECT * FROM active_training_locations LIMIT 5;
