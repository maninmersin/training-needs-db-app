-- Find the actual project you're working with

-- 1. List all projects
SELECT id, name, created_at
FROM projects
ORDER BY created_at DESC;

-- 2. Find what project_id is in your training_data
SELECT DISTINCT project_id, COUNT(*) as record_count
FROM training_data
GROUP BY project_id;

-- 3. Find what project_id is in your training_schedules
SELECT id, name, project_id, created_at
FROM training_schedules
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check project_users to see what projects have users
SELECT p.id, p.name, COUNT(pu.user_id) as user_count
FROM projects p
LEFT JOIN project_users pu ON pu.project_id = p.id
GROUP BY p.id, p.name;
