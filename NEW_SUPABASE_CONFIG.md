# New Supabase Instance Configuration

## Project Details
- **Project Name**: MS Access Migration Project
- **Project Reference ID**: `syrdmvfwptkzjdwvdcae`
- **Project UUID**: `9dc6763e-8573-4a32-aead-ca77379d0620`

## Steps to Complete Configuration

### 1. Get Your API Keys

Go to your NEW Supabase project dashboard:
1. Navigate to **Settings** → **API**
2. Copy the following values:

**Project URL** (e.g., `https://syrdmvfwptkzjdwvdcae.supabase.co`)
```
YOUR_PROJECT_URL_HERE
```

**anon public key** (starts with `eyJ...`)
```
YOUR_ANON_KEY_HERE
```

**service_role key** (starts with `eyJ...`, keep secret!)
```
YOUR_SERVICE_ROLE_KEY_HERE
```

### 2. Update .env File

Open `C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access\.env`

Replace with:
```env
VITE_SUPABASE_URL=https://syrdmvfwptkzjdwvdcae.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_FROM_DASHBOARD
VITE_PROJECT_ID=9dc6763e-8573-4a32-aead-ca77379d0620
```

### 3. Verify Connection

After updating .env:
```bash
cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access
npm run dev
```

The app should start on a different port (e.g., http://localhost:5174/)

---

## Next Steps

Once the .env is configured:
1. ✅ Test the application loads
2. ⏭️ Build ImportExportUserCourseMappings component
3. ⏭️ Export data from MS Access to CSV
4. ⏭️ Import CSV data to new Supabase instance
5. ⏭️ Test TSC Wizard with individual course mappings
