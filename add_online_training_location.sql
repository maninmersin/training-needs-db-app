-- Add "Online" as a training location to the reference table
-- This will make "Online" appear in the TSC Wizard Training Locations dropdown

-- Step 1: Find your project ID (run this first to see your projects)
SELECT id, name FROM projects;

-- Step 2: After finding your project ID, update the INSERT below with your actual project_id
-- Replace 'YOUR-PROJECT-ID-HERE' with the UUID from Step 1

INSERT INTO training_locations (project_id, name, active, display_order, created_at, updated_at)
VALUES (
  'YOUR-PROJECT-ID-HERE',  -- ⚠️ REPLACE THIS with your actual project ID
  'Online',
  true,
  999,  -- High number to show at end of list
  NOW(),
  NOW()
);

-- Step 3: Verify it was added
SELECT * FROM training_locations WHERE name = 'Online';
