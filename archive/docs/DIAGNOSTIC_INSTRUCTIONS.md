# Diagnostic Instructions for Schedule Save Issue

## Problem
Schedules with multiple groups on the same day (AM and PM) are not saving or loading correctly.

## Steps to Diagnose

### Step 1: Check Browser Console for Errors

1. Open your application in the browser
2. Press **F12** to open Developer Tools
3. Click on the **Console** tab
4. Clear the console (click the 🚫 icon)
5. Try to save your schedule with two groups on the same day
6. Look for any **RED error messages** in the console
7. Copy the full error message and share it

**Look for these specific error patterns:**
- `duplicate key value violates unique constraint`
- `session_identifier`
- `training_sessions`
- Any PostgreSQL/Supabase error codes

### Step 2: Check Network Tab for API Errors

1. In Developer Tools, click on the **Network** tab
2. Clear the network log
3. Try to save your schedule
4. Look for any requests to `training_sessions` that are RED (failed)
5. Click on the failed request
6. Look at the **Response** tab
7. Copy any error messages

### Step 3: Check Supabase Database Directly

If you have access to Supabase dashboard:

1. Go to your Supabase project
2. Click on **Table Editor**
3. Find the `training_sessions` table
4. Click on the table
5. Look at the **Constraints** section
6. Check if there's a UNIQUE constraint on `session_identifier`

### Step 4: Run This SQL Query in Supabase SQL Editor

```sql
-- Check for unique constraints on training_sessions
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name='training_sessions'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name;
```

**Expected Result:**
- Should show PRIMARY KEY on `id` column
- Should NOT show any UNIQUE constraint on `session_identifier`

### Step 5: Test with a Simple Schedule

Try creating a schedule with:
- Only ONE course
- TWO groups
- Same day, different times (AM and PM)
- Different classrooms

**Expected Behavior:**
- Both sessions should save successfully
- When you reopen the schedule, both sessions should appear

---

## Temporary Workaround

If you need to continue working while we fix this:

**Option 1:** Schedule groups on different days
- Put Group 1 AM on Monday
- Put Group 2 PM on Tuesday

**Option 2:** Use only one time slot (AM only or PM only)

---

## Send This Information Back

Please provide:
1. ✅ Browser console error messages (from Step 1)
2. ✅ Network tab errors (from Step 2)
3. ✅ Database constraint information (from Step 3 or 4)
4. ✅ Description of what you see before/after saving

This will help me identify the exact cause and fix it permanently.
