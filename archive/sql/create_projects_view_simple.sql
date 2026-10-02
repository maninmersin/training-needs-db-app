-- =====================================================
-- CREATE PROJECTS_WITH_STATS VIEW (SIMPLE VERSION)
-- Simplified version that should work without issues
-- =====================================================

-- Drop the view if it exists
DROP VIEW IF EXISTS projects_with_stats CASCADE;

-- Create a simple view with just basic project info
CREATE VIEW projects_with_stats AS
SELECT
    id,
    name,
    name as title,
    description,
    is_active,
    created_at,
    updated_at,
    0 AS member_count,
    0 AS schedule_count,
    0 AS course_count,
    0 AS user_count,
    0 AS training_data_count
FROM projects;

-- Grant permissions
GRANT SELECT ON projects_with_stats TO authenticated;

-- Verify
SELECT * FROM projects_with_stats;
