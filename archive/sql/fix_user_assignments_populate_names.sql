-- Fix user_assignments to populate user_name from training_data
-- This will make the calendar display user names properly

-- 1. Check how many assignments have NULL user_name
SELECT
  COUNT(*) FILTER (WHERE user_name IS NULL) as null_names,
  COUNT(*) FILTER (WHERE user_name IS NOT NULL) as has_names,
  COUNT(*) as total
FROM user_assignments;

-- 2. Preview the update (see what would change)
SELECT
  ua.id,
  ua.end_user_id,
  ua.user_name as current_name,
  td.name as new_name_from_training_data,
  td.email
FROM user_assignments ua
LEFT JOIN training_data td ON ua.end_user_id = td.user_id
WHERE ua.user_name IS NULL
LIMIT 20;

-- 3. Update user_name from training_data
UPDATE user_assignments ua
SET
  user_name = td.name,
  user_email = td.email
FROM training_data td
WHERE ua.end_user_id = td.user_id
  AND ua.user_name IS NULL;

-- 4. Verify the update worked
SELECT
  COUNT(*) FILTER (WHERE user_name IS NULL) as still_null,
  COUNT(*) FILTER (WHERE user_name IS NOT NULL) as now_has_names,
  COUNT(*) as total
FROM user_assignments;

-- 5. Sample updated records
SELECT
  id,
  end_user_id,
  user_name,
  user_email,
  course_id,
  session_identifier,
  training_location
FROM user_assignments
ORDER BY created_at DESC
LIMIT 20;
