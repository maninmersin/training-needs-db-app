-- Debug session identifier matching between user_assignments and training_sessions
-- This will help us understand why calendar isn't showing assigned users

-- 1. Get session identifiers from user_assignments (what auto-assign created)
SELECT DISTINCT
  session_identifier as assignment_session_id,
  COUNT(*) as assignment_count
FROM user_assignments
GROUP BY session_identifier
ORDER BY session_identifier
LIMIT 20;

-- 2. Get session identifiers from training_sessions (what calendar is using)
SELECT
  id,
  session_identifier,
  course_id,
  training_location,
  functional_area,
  session_number,
  group_name
FROM training_sessions
WHERE schedule_id IN (SELECT DISTINCT schedule_id FROM user_assignments)
ORDER BY training_location, course_id, session_number
LIMIT 20;

-- 3. Check for matches between assignments and sessions
-- This will show if identifiers match or if there's a mismatch
WITH assignment_ids AS (
  SELECT DISTINCT session_identifier
  FROM user_assignments
),
session_ids AS (
  SELECT DISTINCT session_identifier
  FROM training_sessions
  WHERE schedule_id IN (SELECT DISTINCT schedule_id FROM user_assignments)
)
SELECT
  'Assignments have ' || COUNT(*) || ' unique session_identifiers' as result
FROM assignment_ids
UNION ALL
SELECT
  'Training_sessions have ' || COUNT(*) || ' unique session_identifiers' as result
FROM session_ids
UNION ALL
SELECT
  'Matching identifiers: ' || COUNT(*) as result
FROM assignment_ids
WHERE session_identifier IN (SELECT session_identifier FROM session_ids);

-- 4. Show mismatches - identifiers in assignments but NOT in training_sessions
SELECT
  ua.session_identifier as assignment_identifier,
  COUNT(*) as assignment_count,
  'NOT FOUND IN training_sessions' as status
FROM user_assignments ua
WHERE NOT EXISTS (
  SELECT 1
  FROM training_sessions ts
  WHERE ts.session_identifier = ua.session_identifier
)
GROUP BY ua.session_identifier
LIMIT 10;

-- 5. Show what training_sessions actually have
SELECT
  ts.id,
  ts.session_identifier,
  ts.course_id,
  ts.training_location,
  ts.session_number,
  ts.group_name,
  COUNT(ua.id) as assignment_count
FROM training_sessions ts
LEFT JOIN user_assignments ua ON ua.session_identifier = ts.session_identifier
WHERE ts.schedule_id IN (SELECT DISTINCT schedule_id FROM user_assignments)
GROUP BY ts.id, ts.session_identifier, ts.course_id, ts.training_location, ts.session_number, ts.group_name
ORDER BY ts.training_location, ts.course_id, ts.session_number
LIMIT 20;
