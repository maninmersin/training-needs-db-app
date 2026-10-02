-- =====================================================
-- AUTHENTICATION SCHEMA UPDATE
-- Add missing columns to existing auth_users table
-- Created: 2025-01-17
-- =====================================================

-- Add missing columns to auth_users table
ALTER TABLE auth_users
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Create auth_user_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL, -- 'users', 'assignments', 'schedules', etc.
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    functional_area_names TEXT[], -- Array of allowed functional area names
    training_location_names TEXT[], -- Array of allowed training location names
    project_ids UUID[], -- Array of allowed project IDs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, resource_type)
);

-- Add indexes for new table
CREATE INDEX IF NOT EXISTS idx_auth_user_permissions_user_id ON auth_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_permissions_resource_type ON auth_user_permissions(resource_type);

-- Enable RLS
ALTER TABLE auth_user_permissions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for auth_user_permissions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'auth_user_permissions'
        AND policyname = 'Users can view their own permissions'
    ) THEN
        CREATE POLICY "Users can view their own permissions" ON auth_user_permissions
            FOR SELECT USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'auth_user_permissions'
        AND policyname = 'Users can update their own permissions'
    ) THEN
        CREATE POLICY "Users can update their own permissions" ON auth_user_permissions
            FOR UPDATE USING (user_id = auth.uid());
    END IF;
END $$;

-- Update existing users to have default values for new columns
UPDATE auth_users
SET user_type = 'standard'
WHERE user_type IS NULL;

UPDATE auth_users
SET is_super_admin = false
WHERE is_super_admin IS NULL;

-- Make your first user a super admin (update with your email)
-- IMPORTANT: Replace 'your-email@example.com' with your actual email
-- UPDATE auth_users
-- SET is_super_admin = true, user_type = 'admin'
-- WHERE email = 'your-email@example.com';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_user_permissions TO authenticated;

-- =====================================================
-- END OF UPDATE SCRIPT
-- =====================================================

-- Verification queries (uncomment to test after running):
-- SELECT id, email, user_type, is_super_admin, is_active FROM auth_users;
-- SELECT * FROM auth_user_permissions;
