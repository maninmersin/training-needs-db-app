-- Comprehensive RLS fix for ALL tables with recursion issues
-- This will fix project_users, training_data, courses, functional_areas, training_locations, and any other affected tables

-- ============================================================================
-- STRATEGY: Replace all project-based RLS policies with simple auth-based policies
-- This eliminates ALL recursion by not checking project_users membership
-- ============================================================================

-- ============================================================================
-- FIX: courses table
-- ============================================================================

-- Drop all existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'courses') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON courses';
    END LOOP;
END $$;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON courses
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX: functional_areas table
-- ============================================================================

-- Drop all existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'functional_areas') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON functional_areas';
    END LOOP;
END $$;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON functional_areas
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE functional_areas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX: training_locations table
-- ============================================================================

-- Drop all existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'training_locations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON training_locations';
    END LOOP;
END $$;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON training_locations
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE training_locations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX: trainers table (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trainers') THEN
        -- Drop all existing policies
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'trainers') LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON trainers';
        END LOOP;

        -- Create simple policy
        EXECUTE 'CREATE POLICY "Allow authenticated users full access" ON trainers
          FOR ALL
          USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL)';

        EXECUTE 'ALTER TABLE trainers ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ============================================================================
-- FIX: training_sessions table (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'training_sessions') THEN
        -- Drop all existing policies
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'training_sessions') LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON training_sessions';
        END LOOP;

        -- Create simple policy
        EXECUTE 'CREATE POLICY "Allow authenticated users full access" ON training_sessions
          FOR ALL
          USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL)';

        EXECUTE 'ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ============================================================================
-- FIX: session_assignments table (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_assignments') THEN
        -- Drop all existing policies
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'session_assignments') LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON session_assignments';
        END LOOP;

        -- Create simple policy
        EXECUTE 'CREATE POLICY "Allow authenticated users full access" ON session_assignments
          FOR ALL
          USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL)';

        EXECUTE 'ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ============================================================================
-- FIX: calendar_events table (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
        -- Drop all existing policies
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'calendar_events') LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON calendar_events';
        END LOOP;

        -- Create simple policy
        EXECUTE 'CREATE POLICY "Allow authenticated users full access" ON calendar_events
          FOR ALL
          USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL)';

        EXECUTE 'ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ============================================================================
-- RE-VERIFY: project_users and training_data (ensure clean state)
-- ============================================================================

-- Drop ALL policies on project_users (including the recursive one)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON project_users';
    END LOOP;
END $$;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON project_users
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;

-- Drop ALL policies on training_data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'training_data') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON training_data';
    END LOOP;
END $$;

-- Create simple policy
CREATE POLICY "Allow authenticated users full access" ON training_data
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION: Show final state of all policies
-- ============================================================================

SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual::text, 50) as using_clause_preview,
  LEFT(with_check::text, 50) as with_check_preview
FROM pg_policies
WHERE tablename IN (
  'project_users', 'training_data', 'courses', 'functional_areas',
  'training_locations', 'trainers', 'training_sessions',
  'session_assignments', 'calendar_events'
)
ORDER BY tablename, policyname;
