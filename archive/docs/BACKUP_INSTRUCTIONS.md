# Backup Instructions - Before MS Access Integration

## What to Backup

Before proceeding with the new Supabase instance, we need to backup:
1. ✅ Current application code (entire folder)
2. ✅ Current Supabase database schema
3. ✅ Current Supabase data (if any production data exists)
4. ✅ Environment variables (.env files)

---

## Step 1: Backup Application Code

### Option A: Using File Explorer (Simplest)
1. Open File Explorer
2. Navigate to `C:\Users\Stuart\OneDrive\Desktop\`
3. Right-click on `training_needs_db_app_new` folder
4. Select "Copy"
5. Right-click in empty space, select "Paste"
6. Rename the copy to `training_needs_db_app_new_BACKUP_2025-01-17`

### Option B: Using Command Line
```bash
# From Desktop directory
cd C:\Users\Stuart\OneDrive\Desktop\
xcopy training_needs_db_app_new training_needs_db_app_new_BACKUP_2025-01-17 /E /I /H
```

---

## Step 2: Backup Current Supabase Database

### 2A: Export Database Schema

1. Go to your **current/existing** Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run this query to export table definitions:

```sql
-- Export table creation statements
SELECT
    'CREATE TABLE ' || table_name || ' (' ||
    string_agg(
        column_name || ' ' ||
        data_type ||
        CASE WHEN character_maximum_length IS NOT NULL
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
    ) || ');' AS create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name NOT LIKE 'pg_%'
GROUP BY table_name
ORDER BY table_name;
```

4. Copy the results and save to a file: `current_database_schema_backup.sql`

### 2B: Export All Data (CSV Format)

For each important table with data, export via Supabase dashboard:

1. Go to **Table Editor**
2. Select table (e.g., `end_users`, `courses`, `training_sessions`)
3. Click **"..."** menu → **"Export to CSV"**
4. Save files with descriptive names:
   - `backup_end_users_2025-01-17.csv`
   - `backup_courses_2025-01-17.csv`
   - `backup_training_sessions_2025-01-17.csv`
   - etc.

### 2C: Full Database Backup (Using CLI - Most Complete)

If you have access to your current database:

```bash
# Get your current project's connection string from Supabase dashboard:
# Settings → Database → Connection string (transaction mode)

# Example (replace with your actual connection string):
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > current_database_full_backup_2025-01-17.sql
```

Note: You'll need `pg_dump` installed (comes with PostgreSQL client tools)

---

## Step 3: Backup Environment Variables

1. Copy your `.env` file:
```bash
cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new
copy .env .env.BACKUP_2025-01-17
```

2. Also copy `.env.local` if it exists:
```bash
copy .env.local .env.local.BACKUP_2025-01-17
```

---

## Step 4: Document Current Configuration

Create a backup info file with current setup details:

```bash
# Create a backup info document
notepad backup_info_2025-01-17.txt
```

Add this information:
```
BACKUP DATE: 2025-01-17
CURRENT SUPABASE PROJECT:
- Project Name: [Your current project name]
- Project URL: [Your current Supabase URL]
- Project Ref ID: [Your current project reference ID]
- Database Password: [Store securely - DO NOT commit to git]

CURRENT APPLICATION:
- Node Version: [Run: node --version]
- npm Version: [Run: npm --version]
- Git Branch: [Run: git branch --show-current]
- Last Commit: [Run: git log -1 --oneline]

BACKUP LOCATIONS:
- Code Backup: training_needs_db_app_new_BACKUP_2025-01-17
- Database Schema: current_database_schema_backup.sql
- Environment: .env.BACKUP_2025-01-17
- Data Exports: [List CSV files backed up]
```

---

## Step 5: Verify Backup Integrity

### Check Code Backup:
```bash
# Verify folder was copied
dir C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new_BACKUP_2025-01-17
```

### Check File Count:
```bash
# Original folder
dir training_needs_db_app_new /s /b | find /c /v ""

# Backup folder
dir training_needs_db_app_new_BACKUP_2025-01-17 /s /b | find /c /v ""
```

Both should have the same number of files.

---

## Backup Checklist

Before proceeding to new Supabase instance setup:

- [ ] Application code folder copied and renamed
- [ ] Database schema exported
- [ ] Important table data exported (CSV files)
- [ ] .env file(s) backed up
- [ ] backup_info_2025-01-17.txt created with project details
- [ ] File count verified (original vs backup match)
- [ ] Current Supabase project URL and credentials documented
- [ ] Git commit made (if using version control)

---

## Optional: Git Commit (Recommended)

If your project is in git:

```bash
cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new
git status
git add .
git commit -m "Backup before MS Access integration - 2025-01-17"
```

This creates a version history checkpoint you can always return to.

---

## Restoration Instructions (If Needed)

If something goes wrong with the new setup:

### To Restore Code:
1. Delete `training_needs_db_app_new` folder
2. Rename `training_needs_db_app_new_BACKUP_2025-01-17` to `training_needs_db_app_new`
3. Restore `.env` file from `.env.BACKUP_2025-01-17`

### To Restore Database:
1. Use your original Supabase project (don't delete it!)
2. If needed, re-import data from CSV backups via Table Editor
3. Update `.env` to point back to original Supabase URL/keys

---

## Important Notes

⚠️ **DO NOT DELETE**:
- Your current/original Supabase project
- The backup folder
- Any backup SQL or CSV files
- Keep these until the new system is fully tested and working

✅ **Safe to Proceed When**:
- All checkboxes above are ticked
- You have copies of all critical files
- You can see the backup folder in File Explorer
- Environment variables are documented

---

Once backup is complete, you can proceed with confidence to the new Supabase setup!
