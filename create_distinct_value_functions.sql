-- Create database functions to efficiently get distinct values from training_data
-- This avoids the Supabase row limit issue when fetching all rows

-- Function to get distinct training locations for a project
CREATE OR REPLACE FUNCTION get_distinct_training_locations(p_project_id UUID)
RETURNS TABLE(training_location TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT td.training_location
  FROM training_data td
  WHERE td.project_id = p_project_id
    AND td.training_location IS NOT NULL
  ORDER BY td.training_location;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get distinct functional areas for a project
CREATE OR REPLACE FUNCTION get_distinct_functional_areas(p_project_id UUID)
RETURNS TABLE(functional_area TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT td.functional_area
  FROM training_data td
  WHERE td.project_id = p_project_id
    AND td.functional_area IS NOT NULL
  ORDER BY td.functional_area;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_distinct_training_locations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_functional_areas(UUID) TO authenticated;

-- Test the functions (replace with your actual project_id)
-- SELECT * FROM get_distinct_training_locations('9dc6763e-8573-4a32-aead-ca77379d0620');
-- SELECT * FROM get_distinct_functional_areas('9dc6763e-8573-4a32-aead-ca77379d0620');
