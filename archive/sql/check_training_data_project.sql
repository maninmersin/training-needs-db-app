-- Check if training_data has project_id and what values it contains

-- 1. Check if project_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'training_data' AND column_name = 'project_id';

-- 2. Check distinct project_ids in training_data
SELECT DISTINCT project_id, COUNT(*) as record_count
FROM training_data
GROUP BY project_id;

-- 3. Check sample records
SELECT project_id, user_id, user_name, course_id, training_location, functional_area
FROM training_data
LIMIT 10;

-- 4. Check what projects exist
SELECT id, name
FROM projects
LIMIT 10;

-- 5. Check if training_data has NULL project_ids
SELECT COUNT(*) as null_project_id_count
FROM training_data
WHERE project_id IS NULL;
