# Quick Start: MS Access Import (3 Easy Steps)

**Total Time**: ~30 minutes
**Last Updated**: 2025-01-17

---

## Your Data Structure (Confirmed)

✅ **Course** = `sub_functional_area` (e.g., "Purchasing", "Self Service Procurement (SSP)")
✅ **Course ID** = `ID` from `functional_area` table (e.g., 17, 18)
✅ **Duration** = `est_duration_hrs` (e.g., 6 hours)
✅ **Users** mapped via `user_course_mappings` → `functional_area.ID`

---

## Step 1: Deploy Supabase Schema (5 minutes)

### 1.1 Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard/project/syrdmvfwptkzjdwvdcae
- Click "SQL Editor" in left sidebar

### 1.2 Run the Schema
- Open file: `training_data_flat_table_schema.sql`
- Copy entire contents
- Paste into SQL Editor
- Click "Run" button

### 1.3 Verify
- Go to "Table Editor" in left sidebar
- Check that `training_data` table exists

**✅ Done!** Supabase database is ready.

---

## Step 2: Export from MS Access (10 minutes)

### Option A: Use Your Existing Query (RECOMMENDED if you already have it)

If you already have the query that produces this format:
```
ID | functional_area | sub_functional_area | est_duration_hrs | emp_id | name | email | ...
```

**Just export it to CSV:**
1. Open your query in Access
2. External Data → Text File (Export)
3. Save as: `training_data_export.csv`
4. Delimited format, Comma delimiter
5. ✅ CHECK "Include Field Names on First Row"
6. Click Finish

**✅ Skip to Step 3!**

### Option B: Create New Query (if needed)

1. **Open MS Access** database
2. **Create → Query Design**
3. **Close "Show Table" dialog**
4. **View → SQL View**
5. **Paste this query:**

```sql
SELECT
    fa.ID AS ID,
    fa.functional_area AS functional_area,
    fa.sub_functional_area AS sub_functional_area,
    fa.est_duration_hrs AS est_duration_hrs,
    eu.emp_id AS emp_id,
    eu.name AS name,
    eu.[business-unit] AS [business-unit],
    eu.org AS org,
    eu.country AS country,
    eu.department AS department,
    eu.job_title AS job_title,
    eu.email AS email,
    eu.location AS location,
    eu.training_location AS training_location,
    eu.project_role AS project_role,
    ucm.assigned_by AS assigned_by,
    ucm.assigned_date AS assigned_date,
    ucm.notes AS notes
FROM
    (user_course_mappings ucm
    INNER JOIN end_users eu ON ucm.end_user_id = eu.emp_id)
    INNER JOIN functional_area fa ON ucm.functional_id = fa.ID
WHERE
    eu.emp_id IS NOT NULL
    AND fa.ID IS NOT NULL
ORDER BY
    eu.training_location, eu.name, fa.ID;
```

6. **Run → Datasheet View** to preview
7. **External Data → Text File (Export)**
8. Save as: `training_data_export.csv`
9. Delimited, Comma, ✅ Include Field Names
10. Finish

**✅ CSV file ready!**

---

## Step 3: Import to Supabase (10 minutes)

### 3.1 Start Dev Server
```bash
cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access
npm run dev
```

### 3.2 Navigate to Import Tool
- Open browser: http://localhost:5173 (or port shown)
- Log in
- Select project
- Navigate to: **Import/Export Training Data (MS Access)**

### 3.3 Import CSV
- Click "Choose File"
- Select `training_data_export.csv`
- Click "Import CSV (Replace All)"
- Wait for progress bar to complete

### 3.4 Verify Import
- Check success message shows correct counts
- Review statistics (users, courses, locations)
- Go to Supabase → Table Editor → `training_data`
- Spot check a few records

**✅ Data imported!**

---

## Step 4: Test TSC Wizard (5 minutes)

1. **Navigate to TSC Wizard**
   - Training → Training Schedule Creator

2. **Check data loads**
   - Should auto-load from `training_data` table
   - Console should show: "✅ Training data fetched"

3. **Create test schedule**
   - Select functional areas
   - Set date range and preferences
   - Generate schedule
   - Verify sessions created correctly

**✅ Everything working!**

---

## Common Issues & Solutions

### Issue: "Missing required columns"
**Solution**: Check CSV has these exact column names:
- `ID`, `functional_area`, `sub_functional_area`, `est_duration_hrs`
- `emp_id`, `name`, `training_location`
- Open CSV in Notepad to verify first row has headers

### Issue: "training_location is blank"
**Solution**: This field is CRITICAL!
- Update `end_users` table in Access to populate `training_location`
- Re-export and re-import

### Issue: TSC Wizard shows no data
**Solution**:
- Check Supabase Table Editor has records
- Verify `project_id` matches current project
- Check browser console for errors

### Issue: Courses duration multiplied
**Don't worry!** The scheduler automatically deduplicates courses by ID.
- Course ID 17 will only use 6 hours (not 6 × number of users)
- This is handled in `TSCFetchDataStage.jsx` lines 32-46

---

## Quick Validation

After import, run these queries in Supabase SQL Editor:

```sql
-- Check total records
SELECT COUNT(*) FROM training_data;

-- Check unique counts
SELECT
  COUNT(DISTINCT user_id) AS users,
  COUNT(DISTINCT course_id) AS courses,
  COUNT(DISTINCT training_location) AS locations
FROM training_data;

-- Preview sample
SELECT
  user_name,
  course_name,
  duration_hrs,
  training_location
FROM training_data
LIMIT 10;
```

**Expected**:
- Total records: ~1000-10000 (depending on user-course assignments)
- Users: ~1000
- Courses: ~hundreds (number of unique sub_functional_areas)

---

## Need Help?

**Files to reference:**
- `ACCESS_EXPORT_QUERY.sql` - Detailed query with comments
- `FLAT_TABLE_SETUP_GUIDE.md` - Complete detailed guide
- `training_data_flat_table_schema.sql` - Database schema

**Key Points:**
- Your `ID` field = course identifier
- Your `sub_functional_area` = course name
- Your `est_duration_hrs` = course duration
- Scheduler will NOT multiply duration by number of users!

---

**That's it! You're done in ~30 minutes.**
