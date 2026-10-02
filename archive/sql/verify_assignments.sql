-- Verify that assignments were created

-- 1. Count total assignments
SELECT COUNT(*) as total_assignments
FROM user_assignments;

-- 2. Show sample assignments
SELECT
  id,
  end_user_id,
  user_name,
  course_id,
  session_identifier,
  training_location,
  assignment_status,
  created_at
FROM user_assignments
ORDER BY created_at DESC
LIMIT 20;

-- 3. Count assignments by course
SELECT
  course_id,
  COUNT(*) as assignment_count
FROM user_assignments
GROUP BY course_id
ORDER BY course_id;

-- 4. Count assignments by location
SELECT
  training_location,
  COUNT(*) as assignment_count
FROM user_assignments
GROUP BY training_location
ORDER BY training_location;

-- 5. Check assignments for the specific schedule
SELECT
  schedule_id,
  COUNT(*) as assignment_count
FROM user_assignments
WHERE schedule_id = '76b47d03-e013-4a74-8dac-b6ad5768d225'
GROUP BY schedule_id;
