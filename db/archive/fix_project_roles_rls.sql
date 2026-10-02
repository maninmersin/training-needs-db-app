-- Fix RLS policies for project_roles table
-- This script ensures project members can manage project roles

-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can insert project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can update project roles for their projects" ON project_roles;
DROP POLICY IF EXISTS "Users can delete project roles for their projects" ON project_roles;

-- Enable RLS on the table
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

-- Policy for viewing project roles (members can view their project's roles)
CREATE POLICY "Users can view project roles for their projects" ON project_roles
    FOR SELECT
    USING (
        project_id IN (
            SELECT pu.project_id 
            FROM project_users pu 
            WHERE pu.user_id = auth.uid() 
            AND pu.is_active = true
        )
    );

-- Policy for inserting project roles (members can add roles to their projects)
CREATE POLICY "Users can insert project roles for their projects" ON project_roles
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

-- Policy for updating project roles (members can update their project's roles)
CREATE POLICY "Users can update project roles for their projects" ON project_roles
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

-- Policy for deleting project roles (members can delete their project's roles)
CREATE POLICY "Users can delete project roles for their projects" ON project_roles
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

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON project_roles TO authenticated;

-- Show the created policies for verification
SELECT schemaname, tablename, policyname, permissive, cmd, qual 
FROM pg_policies 
WHERE tablename = 'project_roles';