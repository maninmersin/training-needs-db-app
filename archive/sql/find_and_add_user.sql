-- Find your user ID and add to project
-- Run this in Supabase SQL Editor

-- 1. Find all users in auth.users table
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check the project
SELECT id, name FROM projects WHERE id = '9dc6763e-8573-4a32-aead-ca77379d0620';

-- 3. Check who's currently in this project
SELECT pu.user_id, au.email, pu.role, pu.is_active
FROM project_users pu
LEFT JOIN auth.users au ON au.id = pu.user_id
WHERE pu.project_id = '9dc6763e-8573-4a32-aead-ca77379d0620';

-- 4. MANUAL STEP: Copy your user ID from query #1, then run this:
-- Replace 'YOUR_USER_ID_HERE' with your actual UUID from query #1
--
-- INSERT INTO project_users (user_id, project_id, role, is_active)
-- VALUES (
--   'YOUR_USER_ID_HERE',  -- <-- Replace this with your user ID
--   '9dc6763e-8573-4a32-aead-ca77379d0620',
--   'owner',
--   true
-- )
-- ON CONFLICT (user_id, project_id)
-- DO UPDATE SET
--   is_active = true,
--   role = 'owner';

-- 5. After inserting, verify with this query:
-- SELECT pu.user_id, au.email, pu.role, pu.is_active
-- FROM project_users pu
-- LEFT JOIN auth.users au ON au.id = pu.user_id
-- WHERE pu.project_id = '9dc6763e-8573-4a32-aead-ca77379d0620';
