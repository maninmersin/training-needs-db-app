-- Diagnose user_assignments table structure and RLS issues

-- 1. Check all columns in user_assignments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_assignments'
ORDER BY ordinal_position;

-- 2. Check primary key
SELECT a.attname AS column_name
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE i.indrelid = 'user_assignments'::regclass AND i.indisprimary;

-- 3. Check current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_assignments';

-- 4. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_assignments';

-- 5. Check current user's project access
SELECT pu.project_id, p.name as project_name, pu.role, pu.is_active
FROM project_users pu
JOIN projects p ON p.id = pu.project_id
WHERE pu.user_id = auth.uid();

-- 6. Try a test insert to see the exact error
-- This will fail but show us what's wrong
-- INSERT INTO user_assignments (project_id, end_user_id)
-- VALUES ('9dc6763e-8573-4a32-aead-ca77379d0620', 1);
