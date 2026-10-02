# MS Access Flat Table Import - Complete Setup Guide

**Status**: Ready to use
**Approach**: Option A - Single Flat Table (simplest for interim solution)
**Date Created**: 2025-01-17

---

## 🎯 Overview

This guide walks you through the complete process of importing your MS Access training data (~1000 users, ~700 courses) into Supabase using a **single flat table** approach.

**Why this approach?**
- ✅ ONE export query from Access
- ✅ ONE import to Supabase
- ✅ NO complex JOINs in TSC Wizard
- ✅ Fast and simple for interim/temporary solution
- ✅ Easy to troubleshoot

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `ACCESS_EXPORT_QUERY.sql` | SQL query to run in MS Access |
| `training_data_flat_table_schema.sql` | Supabase table schema |
| `src/shared/components/ImportExportTrainingData.jsx` | Import/export component |
| `src/modules/training/components/tsc-wizard/TSCFetchDataStage.jsx` | Updated to use flat table |
| `FLAT_TABLE_SETUP_GUIDE.md` | This file |

---

## 🚀 Step-by-Step Implementation

### Step 1: Deploy Supabase Schema (5 minutes)

1. **Open Supabase SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/syrdmvfwptkzjdwvdcae
   - Click "SQL Editor" in left sidebar

2. **Run the schema**:
   - Open file: `training_data_flat_table_schema.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click "Run" button

3. **Verify table created**:
   - Go to "Table Editor" in left sidebar
   - You should see new table: `training_data`
   - Check columns match the schema

**Expected result**: New `training_data` table created with indexes, RLS policies, and helper functions.

---

### Step 2: Export Data from MS Access (10-15 minutes)

1. **Open your MS Access database**

2. **Create new query**:
   - Click "Create" tab → "Query Design"
   - Close the "Show Table" dialog
   - Click "SQL View" button (or View → SQL View)

3. **Paste the export query**:
   - Open file: `ACCESS_EXPORT_QUERY.sql`
   - Copy entire SQL query
   - Paste into Access SQL View
   - **IMPORTANT**: Review the query and adjust if needed (see notes below)

4. **Run the query to preview**:
   - Click "Run" button (! icon) or View → Datasheet View
   - You should see results like:
     ```
     user_id | user_name  | training_location | course_id | course_name | duration_hrs | ...
     123     | John Doe   | YASMINE          | 101       | Safety      | 2.5          | ...
     123     | John Doe   | YASMINE          | 102       | Service     | 4.0          | ...
     456     | Mary Smith | CAIRO            | 101       | Safety      | 2.5          | ...
     ```
   - **Expected row count**: ~10,000 rows (1000 users × avg 10 courses each)

5. **Export to CSV**:
   - Click "External Data" tab
   - Click "Text File" in "Export" section
   - Choose save location: `training_data_export.csv`
   - Click OK
   - Choose "Delimited" format
   - Choose "Comma" delimiter
   - ✅ **CHECK** "Include Field Names on First Row"
   - Click "Finish"
   - Do NOT save export steps (unless you want to repeat regularly)

6. **Verify CSV file**:
   - Open `training_data_export.csv` in Excel or Notepad
   - Check first row contains column headers
   - Check data looks correct
   - Note file size (should be several MB for 10k rows)

**Troubleshooting**:
- **No results?** Check that `user_course_mappings` table has data
- **Too many results?** This is expected - one row per user-course combination
- **Missing functional_area?** Check JOIN to `functional_area` table is correct
- **Error about field names?** Check table/field names match your Access database exactly

---

### Step 3: Import Data to Supabase (10-15 minutes)

1. **Start development server** (if not running):
   ```bash
   cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access
   npm run dev
   ```

2. **Navigate to import tool**:
   - Open browser: http://localhost:5173 (or port shown in terminal)
   - Log in to application
   - Select your project
   - Navigate to: **Import/Export Training Data**

3. **Import CSV file**:
   - Click "Choose File" button
   - Select `training_data_export.csv`
   - Click "Import CSV (Replace All)" button
   - Wait for import to complete (progress bar will show)

4. **Verify import**:
   - Check success message shows correct counts
   - Review statistics panel (users, courses, locations, etc.)
   - Go to Supabase → Table Editor → `training_data`
   - Verify data looks correct

**Expected results**:
- ✅ Import completed successfully
- ✅ ~10,000 records imported
- ✅ Statistics show: ~1000 unique users, ~700 unique courses

**Troubleshooting**:
- **Missing columns error?** Check CSV headers match required columns
- **Validation errors?** Review first few error messages for clues
- **Import fails partway?** Check Supabase logs for detailed error
- **Timeout?** Large files may need to be split into smaller batches

---

### Step 4: Test TSC Wizard (15-20 minutes)

1. **Navigate to TSC Wizard**:
   - Click "Training" in top navigation
   - Click "Training Schedule Creator" or "TSC Wizard"

2. **Start new schedule**:
   - Wizard should auto-load data from `training_data` table
   - Check console logs for: "✅ Training data fetched"
   - Verify courses and users are loaded

3. **Define criteria**:
   - Select functional areas to include
   - Set start date and scheduling preferences
   - Set max attendees per session
   - Choose scheduling days

4. **Generate schedule**:
   - Click through wizard stages
   - Verify sessions are calculated correctly
   - Check grouping by `training_location` works
   - Review session titles include course names

5. **Save and export**:
   - Save schedule to database
   - Export to Excel (optional)
   - View in calendar (optional)

**Expected results**:
- ✅ TSC Wizard loads data without errors
- ✅ Sessions are generated and grouped correctly
- ✅ Course names, durations, and locations appear correctly
- ✅ No console errors

**Troubleshooting**:
- **No data loads?** Check Supabase table has records for your project
- **Wrong grouping?** Verify `training_location` field is populated
- **Missing courses?** Check `course_id` field is correct in data
- **Console errors?** Check browser console for detailed error messages

---

## 📊 Data Validation Queries

Run these in Supabase SQL Editor to verify data integrity:

### Check total records
```sql
SELECT COUNT(*) AS total_records FROM training_data;
```

### Check unique counts
```sql
SELECT
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT course_id) AS unique_courses,
  COUNT(DISTINCT training_location) AS unique_locations,
  COUNT(DISTINCT functional_area) AS unique_functional_areas
FROM training_data;
```

### Check data distribution by location
```sql
SELECT
  training_location,
  COUNT(DISTINCT user_id) AS users,
  COUNT(DISTINCT course_id) AS courses,
  COUNT(*) AS assignments
FROM training_data
GROUP BY training_location
ORDER BY assignments DESC;
```

### Check data distribution by functional area
```sql
SELECT
  functional_area,
  COUNT(DISTINCT course_id) AS courses,
  COUNT(DISTINCT user_id) AS users,
  COUNT(*) AS assignments
FROM training_data
GROUP BY functional_area
ORDER BY assignments DESC;
```

### Preview sample data
```sql
SELECT
  user_name,
  training_location,
  course_name,
  duration_hrs,
  functional_area
FROM training_data
LIMIT 10;
```

---

## 🔧 Customizing the Access Export Query

If your Access database has different field names or structure, you'll need to adjust the query:

### Common Adjustments:

1. **Field name with hyphen** (`business-unit`):
   ```sql
   eu.[business-unit] AS business_unit,
   ```
   Note the square brackets around field names with special characters.

2. **Different table names**:
   Replace table names to match your database:
   ```sql
   FROM tbl_UserCourseMappings ucm  -- if your table is named differently
   ```

3. **Project filtering**:
   If you have multiple projects in Access and only want one:
   ```sql
   WHERE ucm.project_id = 'your-specific-project-id'
   ```

4. **Additional fields**:
   Add any extra fields you need:
   ```sql
   SELECT
     ...,
     eu.manager_name AS user_manager,  -- add extra field
     c.vendor AS course_vendor,        -- add extra field
     ...
   ```

---

## 🎯 Success Criteria

Your implementation is successful when:

- ✅ Supabase `training_data` table exists and has data
- ✅ Row count is approximately: (number of users) × (avg courses per user)
- ✅ All required fields are populated (user_id, course_id, training_location, etc.)
- ✅ TSC Wizard loads data without errors
- ✅ Training sessions are generated correctly
- ✅ Calendar events display with correct information

---

## 🚨 Common Issues & Solutions

### Issue: Access query returns no results
**Solution**:
- Check that `user_course_mappings` table has data
- Verify foreign key relationships (emp_id, functional_id)
- Remove WHERE clause temporarily to see all data

### Issue: CSV import fails with "Missing columns"
**Solution**:
- Check CSV first row has column headers
- Verify headers match expected names (case-sensitive!)
- Open CSV in text editor to check formatting

### Issue: TSC Wizard shows no data
**Solution**:
- Check Supabase table has records
- Verify `project_id` matches current project
- Check RLS policies allow access
- Review browser console for errors

### Issue: Training sessions not grouping correctly
**Solution**:
- Verify `training_location` field is populated in all records
- Check for typos or inconsistent location names
- Ensure location values match between users

### Issue: Import very slow (>5 minutes)
**Solution**:
- This is normal for large files (10k+ rows)
- Consider splitting CSV into smaller files
- Check network connection to Supabase
- Increase batch size in import component (currently 500)

---

## 🔄 Re-importing Updated Data

If you need to re-import after making changes in Access:

1. **Export new CSV from Access** (Steps 2.1-2.6 above)
2. **Import to Supabase**:
   - Import tool uses REPLACE mode
   - All existing data for project will be deleted
   - New data will be imported
   - No need to manually delete old data

**⚠️ Warning**: Re-importing will delete any training schedules and calendar events you've created! Export them first if needed.

---

## 📞 Next Steps

After successful implementation:

1. **Test with sample schedules**: Create a few test schedules to verify everything works
2. **User training**: Train your team on how to use the TSC Wizard
3. **Backup strategy**: Set up regular exports of training data
4. **Monitor performance**: Watch for any slow queries or issues
5. **Plan transition**: When ready to switch back to role-based system, you have the original app unchanged

---

## 📝 Technical Notes

### Data Structure
- **Denormalized**: User info is repeated for each course (acceptable for interim solution)
- **Row count**: Expected ~10,000 rows for 1000 users with 10 courses each
- **Storage**: Approximately 2-5 MB for 10k rows

### Performance
- **Single query**: TSC Wizard fetches all data in one query (fast!)
- **No JOINs**: Data is pre-joined (excellent performance)
- **Indexes**: Optimized for common queries (project_id, training_location)

### Comparison to Normalized Approach
- **Simpler**: No JOIN queries needed
- **Faster import**: One CSV upload vs. three separate imports
- **Easier troubleshooting**: All data in one place
- **Less "proper"**: Not normalized, but perfectly fine for temporary use

---

**Last Updated**: 2025-01-17
**Status**: Ready for implementation
**Estimated Time**: 45-60 minutes total setup
