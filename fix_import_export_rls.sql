-- Comprehensive RLS policy fix for import/export functionality
-- This fixes all tables commonly used in import/export operations

-- END USERS TABLE
DROP POLICY IF EXISTS "Users can view end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can insert end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can update end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can delete end users for their projects" ON end_users;

ALTER TABLE end_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view end users for their projects" ON end_users
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert end users for their projects" ON end_users
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update end users for their projects" ON end_users
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete end users for their projects" ON end_users
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- ROLE COURSE MAPPINGS TABLE (for role-based imports)
DROP POLICY IF EXISTS "Users can view role course mappings for their projects" ON role_course_mappings;
DROP POLICY IF EXISTS "Users can insert role course mappings for their projects" ON role_course_mappings;
DROP POLICY IF EXISTS "Users can update role course mappings for their projects" ON role_course_mappings;
DROP POLICY IF EXISTS "Users can delete role course mappings for their projects" ON role_course_mappings;

ALTER TABLE role_course_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role course mappings for their projects" ON role_course_mappings
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert role course mappings for their projects" ON role_course_mappings
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update role course mappings for their projects" ON role_course_mappings
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete role course mappings for their projects" ON role_course_mappings
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- TRAINERS TABLE (in case you import trainers)
DROP POLICY IF EXISTS "Users can view trainers for their projects" ON trainers;
DROP POLICY IF EXISTS "Users can insert trainers for their projects" ON trainers;
DROP POLICY IF EXISTS "Users can update trainers for their projects" ON trainers;
DROP POLICY IF EXISTS "Users can delete trainers for their projects" ON trainers;

ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trainers for their projects" ON trainers
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert trainers for their projects" ON trainers
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update trainers for their projects" ON trainers
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete trainers for their projects" ON trainers
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- Grant necessary permissions to authenticated users for all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON end_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_course_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trainers TO authenticated;

-- Also grant usage on sequences that might be used for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Show all created policies for verification
SELECT schemaname, tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN ('end_users', 'role_course_mappings', 'trainers')
ORDER BY tablename, policyname;