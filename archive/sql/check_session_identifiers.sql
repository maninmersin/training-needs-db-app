-- Check session identifiers in user_assignments
-- This will help us understand if assignments are matching calendar sessions

-- 1. Get unique session_identifiers from user_assignments
SELECT DISTINCT
  session_identifier,
  COUNT(*) as assignment_count
FROM user_assignments
GROUP BY session_identifier
ORDER BY session_identifier
LIMIT 20;

-- 2. Sample assignment data with all relevant fields
SELECT
  id,
  end_user_id,
  user_name,
  course_id,
  session_identifier,
  training_location,
  functional_area,
  assignment_level,
  assignment_status,
  created_at
FROM user_assignments
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if session_identifier format matches expected pattern
-- Expected format: {courseId}-session{sessionNumber}-{location}-{functionalArea}[-part{N}]
SELECT
  session_identifier,
  CASE
    WHEN session_identifier LIKE '%-session%-%-part%' THEN 'Multi-part format'
    WHEN session_identifier LIKE '%-session%-%-%' THEN 'Standard format'
    ELSE 'Unknown format'
  END as format_type,
  COUNT(*) as count
FROM user_assignments
GROUP BY session_identifier, format_type
ORDER BY count DESC
LIMIT 20;
