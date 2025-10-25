-- =====================================================
-- TRAINING COURSE ASSIGNMENT ARCHITECTURE REDESIGN
-- Phase 1: Individual-Based Course Assignment Schema
-- Created: 2025-10-19
-- =====================================================

-- Purpose: Transition from role-based to individual-based course assignments
-- This allows each end user to have unique course assignments rather than
-- inheriting courses from their role.

-- =====================================================
-- TABLE: user_course_mappings
-- =====================================================
-- Maps individual users to courses they need to complete
-- Supports multiple courses per user
-- Tracks assignment audit trail (who assigned, when)

CREATE TABLE IF NOT EXISTS user_course_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  end_user_id INTEGER NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL DEFAULT 'admin',
  -- Values: 'admin', 'manager', 'system', 'self', 'bulk'
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate course assignments to same user
  CONSTRAINT unique_user_course UNIQUE(end_user_id, course_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for project-based queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_user_course_mappings_project_id
  ON user_course_mappings(project_id);

-- Index for user-based lookups (e.g., "what courses does this user have?")
CREATE INDEX IF NOT EXISTS idx_user_course_mappings_end_user_id
  ON user_course_mappings(end_user_id);

-- Index for course-based lookups (e.g., "who needs this course?")
CREATE INDEX IF NOT EXISTS idx_user_course_mappings_course_id
  ON user_course_mappings(course_id);

-- Composite index for project + user lookups (TSC Wizard queries)
CREATE INDEX IF NOT EXISTS idx_user_course_mappings_project_user
  ON user_course_mappings(project_id, end_user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE user_course_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view mappings for their projects
CREATE POLICY "Users can view mappings for their projects"
  ON user_course_mappings
  FOR SELECT
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
    )
  );

-- Policy: Users can insert mappings for their projects
CREATE POLICY "Users can insert mappings for their projects"
  ON user_course_mappings
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can update mappings for their projects
CREATE POLICY "Users can update mappings for their projects"
  ON user_course_mappings
  FOR UPDATE
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- Policy: Users can delete mappings for their projects
CREATE POLICY "Users can delete mappings for their projects"
  ON user_course_mappings
  FOR DELETE
  USING (
    project_id IN (
      SELECT pu.project_id
      FROM project_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.is_active = true
        AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp on row updates
CREATE OR REPLACE FUNCTION update_user_course_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Call the function before each update
CREATE TRIGGER user_course_mappings_updated_at
  BEFORE UPDATE ON user_course_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_course_mappings_updated_at();

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_course_mappings TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS (Optional but useful)
-- =====================================================

-- Function: Get all courses assigned to a user
CREATE OR REPLACE FUNCTION get_user_courses(p_end_user_id INTEGER)
RETURNS TABLE (
  course_id TEXT,
  course_name TEXT,
  functional_area TEXT,
  duration_hours NUMERIC,
  assigned_by TEXT,
  assigned_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.course_id,
    c.course_name,
    c.functional_area,
    c.duration_hours,
    ucm.assigned_by,
    ucm.assigned_date
  FROM user_course_mappings ucm
  JOIN courses c ON ucm.course_id = c.course_id
  WHERE ucm.end_user_id = p_end_user_id
  ORDER BY c.course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get all users assigned to a course
CREATE OR REPLACE FUNCTION get_course_users(p_course_id TEXT, p_project_id UUID)
RETURNS TABLE (
  end_user_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  project_role TEXT,
  training_location TEXT,
  assigned_by TEXT,
  assigned_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    eu.id,
    eu.first_name,
    eu.last_name,
    eu.email,
    eu.project_role,
    eu.training_location,
    ucm.assigned_by,
    ucm.assigned_date
  FROM user_course_mappings ucm
  JOIN end_users eu ON ucm.end_user_id = eu.id
  WHERE ucm.course_id = p_course_id
    AND ucm.project_id = p_project_id
  ORDER BY eu.last_name, eu.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Bulk assign courses to users
-- Returns number of assignments created
CREATE OR REPLACE FUNCTION bulk_assign_courses(
  p_project_id UUID,
  p_user_ids INTEGER[],
  p_course_ids TEXT[],
  p_assigned_by TEXT DEFAULT 'bulk',
  p_replace_mode BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
  v_course_id TEXT;
  v_count INTEGER := 0;
BEGIN
  -- If replace mode, delete existing assignments for these users
  IF p_replace_mode THEN
    DELETE FROM user_course_mappings
    WHERE end_user_id = ANY(p_user_ids)
      AND project_id = p_project_id;
  END IF;

  -- Insert new assignments (ON CONFLICT DO NOTHING prevents duplicates)
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    FOREACH v_course_id IN ARRAY p_course_ids
    LOOP
      INSERT INTO user_course_mappings (
        project_id,
        end_user_id,
        course_id,
        assigned_by,
        assigned_date
      ) VALUES (
        p_project_id,
        v_user_id,
        v_course_id,
        p_assigned_by,
        NOW()
      )
      ON CONFLICT (end_user_id, course_id) DO NOTHING;

      -- Count successful insertions
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_user_courses(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_users(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_assign_courses(UUID, INTEGER[], TEXT[], TEXT, BOOLEAN) TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES (for testing)
-- =====================================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_course_mappings'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'user_course_mappings';

-- Check RLS policies
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'user_course_mappings';

-- =====================================================
-- NOTES FOR DEPRECATION
-- =====================================================

-- The following tables/components are now deprecated but kept for reference:
-- - role_course_mappings table (old role-based assignment)
-- - RoleCourseMappingsEditor component (hidden from navigation)
--
-- The end_users.project_role field is KEPT for:
-- - Organizational reference
-- - Filtering/grouping in bulk operations
-- - Reporting and analytics
-- BUT it is NO LONGER used for course assignment logic

-- =====================================================
-- END OF SCHEMA
-- =====================================================
