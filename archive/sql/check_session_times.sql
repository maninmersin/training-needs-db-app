-- SQL Query to check if session times are saving correctly
-- This will show you all sessions for your schedule with their times
-- Run this in Supabase SQL Editor AFTER you save your schedule

-- Replace 'YOUR_SCHEDULE_ID' with your actual schedule ID
-- You can find the schedule ID in the browser URL when editing the schedule
-- Example: /schedule-manager/edit/c47f9aff-8534-4519-bcc4-71d73da6d285

SELECT 
    id,
    course_name,
    session_number,
    session_title,
    classroom_number,
    training_location,
    start_datetime,
    end_datetime,
    -- Show the time part clearly
    TO_CHAR(start_datetime, 'YYYY-MM-DD HH24:MI:SS') as start_time_formatted,
    TO_CHAR(end_datetime, 'YYYY-MM-DD HH24:MI:SS') as end_time_formatted,
    -- Show just the date and time separately for easier reading
    DATE(start_datetime) as session_date,
    TO_CHAR(start_datetime, 'HH24:MI') as start_time_only,
    TO_CHAR(end_datetime, 'HH24:MI') as end_time_only,
    session_identifier,
    created_at,
    updated_at
FROM 
    training_sessions
WHERE 
    schedule_id = 'c47f9aff-8534-4519-bcc4-71d73da6d285'  -- Replace with your schedule ID
    AND course_name = 'Project Cost Control (PCC)'  -- Looking at your specific course
ORDER BY 
    session_date, 
    start_time_only,
    session_number;

-- Alternative query: Show sessions grouped by date and time
-- This will clearly show if multiple groups are at the same time or different times
SELECT 
    DATE(start_datetime) as session_date,
    TO_CHAR(start_datetime, 'HH24:MI') as start_time,
    classroom_number,
    COUNT(*) as session_count,
    STRING_AGG(session_title, ' | ') as sessions
FROM 
    training_sessions
WHERE 
    schedule_id = 'c47f9aff-8534-4519-bcc4-71d73da6d285'  -- Replace with your schedule ID
GROUP BY 
    DATE(start_datetime),
    TO_CHAR(start_datetime, 'HH24:MI'),
    classroom_number
ORDER BY 
    session_date,
    start_time;

-- Third query: Look specifically for Wednesday June 10, 2026
-- This should show if Group 1 (AM) and Group 2 (PM) are at different times
SELECT 
    session_number,
    session_title,
    TO_CHAR(start_datetime, 'Day, DD Mon YYYY HH24:MI') as start_formatted,
    TO_CHAR(end_datetime, 'HH24:MI') as end_time,
    CASE 
        WHEN EXTRACT(HOUR FROM start_datetime) < 12 THEN 'AM Session'
        ELSE 'PM Session'
    END as time_slot,
    session_identifier
FROM 
    training_sessions
WHERE 
    schedule_id = 'c47f9aff-8534-4519-bcc4-71d73da6d285'  -- Replace with your schedule ID
    AND DATE(start_datetime) = '2026-06-10'  -- Wednesday June 10, 2026
    AND course_name LIKE '%Project Cost Control%'
ORDER BY 
    start_datetime;
