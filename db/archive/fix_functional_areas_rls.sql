-- Fix RLS policies for functional_areas table
-- This script ensures project members can manage functional areas

-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can insert functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can update functional areas for their projects" ON functional_areas;
DROP POLICY IF EXISTS "Users can delete functional areas for their projects" ON functional_areas;

-- Enable RLS on the table
ALTER TABLE functional_areas ENABLE ROW LEVEL SECURITY;

-- Policy for viewing functional areas (members can view their project's functional areas)
CREATE POLICY "Users can view functional areas for their projects" ON functional_areas
    FOR SELECT
    USING (
        project_id IN (
            SELECT pu.project_id 
            FROM project_users pu 
            WHERE pu.user_id = auth.uid() 
            AND pu.is_active = true
        )
    );

-- Policy for inserting functional areas (members can add functional areas to their projects)
CREATE POLICY "Users can insert functional areas for their projects" ON functional_areas
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

-- Policy for updating functional areas (members can update their project's functional areas)
CREATE POLICY "Users can update functional areas for their projects" ON functional_areas
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

-- Policy for deleting functional areas (members can delete their project's functional areas)
CREATE POLICY "Users can delete functional areas for their projects" ON functional_areas
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
GRANT SELECT, INSERT, UPDATE, DELETE ON functional_areas TO authenticated;

-- Show the created policies for verification
SELECT schemaname, tablename, policyname, permissive, cmd, qual 
FROM pg_policies 
WHERE tablename = 'functional_areas';