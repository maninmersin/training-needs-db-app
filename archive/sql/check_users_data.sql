-- Check if end_users table exists and has data

-- 1. Check end_users table
SELECT COUNT(*) as end_users_count FROM end_users;

-- 2. Check training_data table
SELECT COUNT(*) as training_data_count FROM training_data;

-- 3. Check if user IDs match between tables
SELECT
  COUNT(DISTINCT td.user_id) as unique_users_in_training_data,
  COUNT(DISTINCT eu.id) as matching_users_in_end_users
FROM training_data td
LEFT JOIN end_users eu ON td.user_id = eu.id;

-- 4. Sample users from training_data
SELECT DISTINCT user_id, user_name, user_email, training_location
FROM training_data
LIMIT 10;

-- 5. Sample users from end_users
SELECT id, name, email, training_location, project_id
FROM end_users
LIMIT 10;

-- 6. Check for mismatched user IDs
SELECT DISTINCT td.user_id, td.user_name
FROM training_data td
LEFT JOIN end_users eu ON td.user_id = eu.id
WHERE eu.id IS NULL
LIMIT 10;
