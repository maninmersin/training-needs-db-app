-- Comprehensive RLS policy fix for all reference data tables
-- This script ensures project members can manage all reference data for their projects

-- List of tables to fix: functional_areas, training_locations, project_roles, courses

-- FUNCTIONAL AREAS TABLE
DROP POLICY IF EXISTS "Users can view functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can insert functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can update functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can delete functional areas for their projects" ON functional_areas;

ALTER TABLE functional_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view functional areas for their projects" ON functional_areas
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert functional areas for their projects" ON functional_areas
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update functional areas for their projects" ON functional_areas
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete functional areas for their projects" ON functional_areas
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- TRAINING LOCATIONS TABLE
DROP POLICY IF EXISTS "Users can view training locations for their projects" ON training_locations;
DROP POLICY IF EXISTS "Users can insert training locations for their projects" ON training_locations;
DROP POLICY IF EXISTS "Users can update training locations for their projects" ON training_locations;
DROP POLICY IF EXISTS "Users can delete training locations for their projects" ON training_locations;

ALTER TABLE training_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training locations for their projects" ON training_locations
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert training locations for their projects" ON training_locations
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update training locations for their projects" ON training_locations
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete training locations for their projects" ON training_locations
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- PROJECT ROLES TABLE
DROP POLICY IF EXISTS "Users can view project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can insert project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can update project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can delete project roles for their projects" ON project_roles;

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project roles for their projects" ON project_roles
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert project roles for their projects" ON project_roles
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update project roles for their projects" ON project_roles
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete project roles for their projects" ON project_roles
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- COURSES TABLE
DROP POLICY IF EXISTS "Users can view courses for their projects" ON courses;
DROP POLICY IF EXISTS "Users can insert courses for their projects" ON courses;
DROP POLICY IF EXISTS "Users can update courses for their projects" ON courses;
DROP POLICY IF EXISTS "Users can delete courses for their projects" ON courses;

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view courses for their projects" ON courses
    FOR SELECT USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
        )
    );

CREATE POLICY "Users can insert courses for their projects" ON courses
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can update courses for their projects" ON courses
    FOR UPDATE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Users can delete courses for their projects" ON courses
    FOR DELETE USING (
        project_id IN (
            SELECT pu.project_id FROM project_users pu 
            WHERE pu.user_id = auth.uid() AND pu.is_active = true
            AND pu.role IN ('owner', 'admin', 'member')
        )
    );

-- Grant necessary permissions to authenticated users for all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON functional_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON courses TO authenticated;

-- Show all created policies for verification
SELECT schemaname, tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN ('functional_areas', 'training_locations', 'project_roles', 'courses')
ORDER BY tablename, policyname;