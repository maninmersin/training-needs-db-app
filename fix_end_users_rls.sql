-- Fix RLS policies for end_users table
-- This script ensures project members can manage end users for their projects

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can insert end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can update end users for their projects" ON end_users;
DROP POLICY IF EXISTS "Users can delete end users for their projects" ON end_users;

-- Enable RLS on the table
ALTER TABLE end_users ENABLE ROW LEVEL SECURITY;

-- Policy for viewing end users (members can view their project's end users)
CREATE POLICY "Users can view end users for their projects" ON end_users
    FOR SELECT
    USING (
        project_id IN (
            SELECT pu.project_id 
            FROM project_users pu 
            WHERE pu.user_id = auth.uid() 
            AND pu.is_active = true
        )
    );

-- Policy for inserting end users (members can add end users to their projects)
CREATE POLICY "Users can insert end users for their projects" ON end_users
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

-- Policy for updating end users (members can update their project's end users)
CREATE POLICY "Users can update end users for their projects" ON end_users
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

-- Policy for deleting end users (members can delete their project's end users)
CREATE POLICY "Users can delete end users for their projects" ON end_users
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
GRANT SELECT, INSERT, UPDATE, DELETE ON end_users TO authenticated;

-- Show the created policies for verification
SELECT schemaname, tablename, policyname, permissive, cmd, qual 
FROM pg_policies 
WHERE tablename = 'end_users';