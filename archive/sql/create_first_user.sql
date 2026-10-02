-- =====================================================
-- CREATE FIRST USER IN AUTH_USERS TABLE
-- This syncs your Supabase Auth user with the custom auth_users table
-- =====================================================

-- Insert current authenticated user into auth_users table
-- This will automatically use the ID from your Supabase Auth account
INSERT INTO auth_users (id, email, full_name, user_type, is_super_admin, is_active)
SELECT
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    'admin' as user_type,
    true as is_super_admin,
    true as is_active
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM auth_users WHERE auth_users.id = auth.users.id
)
ON CONFLICT (id) DO UPDATE
SET
    user_type = 'admin',
    is_super_admin = true,
    is_active = true;

-- Verify the insert
SELECT id, email, user_type, is_super_admin, is_active, created_at
FROM auth_users;

-- =====================================================
-- What this does:
-- - Takes your user from auth.users (Supabase Auth)
-- - Inserts it into auth_users (custom table)
-- - Makes you a super admin with full access
-- - Shows you the result
-- =====================================================
