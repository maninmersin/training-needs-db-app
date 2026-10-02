-- Add current user to project so they can create assignments
-- This fixes the RLS policy error

-- First, check what user you are
SELECT auth.uid() as your_user_id, auth.email() as your_email;

-- Check if project exists
SELECT id, name FROM projects WHERE id = '9dc6763e-8573-4a32-aead-ca77379d0620';

-- Check current project_users
SELECT * FROM project_users WHERE project_id = '9dc6763e-8573-4a32-aead-ca77379d0620';

-- Add yourself to the project as owner (if not already there)
INSERT INTO project_users (user_id, project_id, role, is_active)
VALUES (
  auth.uid(),
  '9dc6763e-8573-4a32-aead-ca77379d0620',
  'owner',
  true
)
ON CONFLICT (user_id, project_id)
DO UPDATE SET
  is_active = true,
  role = 'owner';

-- Verify you were added
SELECT pu.*, au.email
FROM project_users pu
JOIN auth.users au ON au.id = pu.user_id
WHERE pu.project_id = '9dc6763e-8573-4a32-aead-ca77379d0620';
