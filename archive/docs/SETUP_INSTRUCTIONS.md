# Setup Instructions for New Supabase Instance
## MS Access Integration Project

Follow these steps to create and configure your new Supabase instance for MS Access integration.

---

## Step 1: Create New Supabase Instance (via Dashboard)

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Configure:
   - **Name**: `training-needs-ms-access` (or your preferred name)
   - **Database Password**: Generate a strong password and **SAVE IT**
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free tier is fine for testing
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning to complete

---

## Step 2: Install Supabase CLI (if not already installed)

### Windows Installation Options:

**Option 1: Using Scoop (Recommended for Windows)**
```powershell
# Install scoop if you don't have it:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Option 2: Direct Download**
1. Go to https://github.com/supabase/cli/releases
2. Download `supabase_windows_amd64.zip` (or arm64 if you have ARM processor)
3. Extract to a folder (e.g., `C:\supabase-cli`)
4. Add that folder to your PATH environment variable

**Option 3: Use npx (No installation needed)**
```bash
# Run commands directly with npx:
npx supabase login
npx supabase link --project-ref YOUR_REF
npx supabase db push --file NEW_INSTANCE_MASTER_SCHEMA.sql
```

### Verify installation:
```bash
supabase --version
# OR with npx:
npx supabase --version
```

---

## Step 3: Link CLI to Your New Instance

1. **Get your project reference ID**:
   - In Supabase dashboard, go to **Settings** → **General**
   - Copy the **Reference ID** (looks like `abcdefghijklmnop`)

2. **Login to Supabase CLI**:
   ```bash
   supabase login
   ```
   This will open a browser to authenticate.

3. **Link to your project**:
   ```bash
   cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new
   supabase link --project-ref YOUR_PROJECT_REFERENCE_ID
   ```
   You'll be prompted for your database password.

---

## Step 4: Deploy the Schema

### Option A: Using Supabase CLI (Recommended)

```bash
# Deploy the schema file
supabase db push --file NEW_INSTANCE_MASTER_SCHEMA.sql
```

### Option B: Using Dashboard SQL Editor (Fallback)

If CLI doesn't work:
1. Go to your new Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy the entire contents of `NEW_INSTANCE_MASTER_SCHEMA.sql`
5. Paste into the SQL Editor
6. Click **"Run"**

---

## Step 5: Verify Schema Deployment

Run this query in SQL Editor to check all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- courses
- end_users
- functional_areas
- project_roles
- project_users
- projects
- training_locations
- training_schedules
- training_sessions
- user_assignments
- user_course_mappings

---

## Step 6: Get Your Connection Details

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them later):
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)
   - **service_role key** (keep this secret!)

---

## Step 7: Create Initial Project Record

Run this in SQL Editor to create your first project:

```sql
-- Insert a test project
INSERT INTO projects (name, description, is_active)
VALUES ('MS Access Migration Test', 'Project for testing MS Access integration', true)
RETURNING id;
```

**Copy the UUID that's returned** - you'll need this for importing data!

---

## Next Steps

Once the schema is deployed and verified:

1. ✅ Schema deployed
2. ⏭️ Copy application codebase to new folder
3. ⏭️ Update environment variables (`.env` file)
4. ⏭️ Build ImportExportUserCourseMappings component
5. ⏭️ Test MS Access → CSV → Supabase workflow

---

## Troubleshooting

### "supabase command not found"
- Restart your terminal after installation
- Check PATH environment variable includes npm global bin folder

### "Permission denied" when linking
- Make sure you're logged in: `supabase login`
- Check you have access to the project in the dashboard

### Schema deployment errors
- Check you're connected to the right project: `supabase projects list`
- Verify your database password is correct
- Try the Dashboard SQL Editor method instead

### RLS policy errors
- These are normal on first run if tables don't exist yet
- Re-run the schema file if you see errors

---

## Need Help?

If you encounter issues:
1. Check the Supabase CLI docs: https://supabase.com/docs/guides/cli
2. Verify your project is active in the dashboard
3. Let me know the specific error message and I'll help troubleshoot!
