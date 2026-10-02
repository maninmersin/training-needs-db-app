-- =====================================================
-- CREATE PROJECTS_WITH_STATS VIEW
-- This view provides project information with statistics
-- =====================================================

-- Drop the view if it exists
DROP VIEW IF EXISTS projects_with_stats;

-- Create the view with project statistics
CREATE OR REPLACE VIEW projects_with_stats AS
SELECT
    p.id,
    p.name,
    p.name as title,  -- Some components expect 'title' field
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    -- Count of project members
    COALESCE(
        (SELECT COUNT(DISTINCT pu.user_id)
         FROM project_users pu
         WHERE pu.project_id = p.id AND pu.is_active = true),
        0
    ) AS member_count,
    -- Count of training schedules
    COALESCE(
        (SELECT COUNT(*)
         FROM training_schedules ts
         WHERE ts.project_id = p.id),
        0
    ) AS schedule_count,
    -- Count of courses
    COALESCE(
        (SELECT COUNT(DISTINCT c.course_id)
         FROM courses c
         WHERE c.project_id = p.id),
        0
    ) AS course_count,
    -- Count of end users
    COALESCE(
        (SELECT COUNT(*)
         FROM end_users eu
         WHERE eu.project_id = p.id),
        0
    ) AS user_count,
    -- Count of training data records
    COALESCE(
        (SELECT COUNT(*)
         FROM training_data td
         WHERE td.project_id = p.id),
        0
    ) AS training_data_count
FROM projects p;

-- Grant permissions to authenticated users
GRANT SELECT ON projects_with_stats TO authenticated;

-- Enable RLS on the view (inherits from projects table)
ALTER VIEW projects_with_stats SET (security_invoker = true);

-- Verify the view
SELECT * FROM projects_with_stats;

-- =====================================================
-- What this does:
-- - Creates a view that combines project info with statistics
-- - Counts members, schedules, courses, users, and training data
-- - Provides the data that ProjectContext expects
-- - Shows you all projects with their stats
-- =====================================================
