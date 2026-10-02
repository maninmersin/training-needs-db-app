# MS Access Integration Project - Roadmap & Status

**Project Goal**: Integrate MS Access database (~1000 users, ~700 courses) with the training needs analysis application using **individual user-to-course mappings** instead of role-based mappings.

**Timeline**: Interim solution for a few months before returning to role-based system.

---

## 🎯 Project Overview

### Current State (Original App)
- **Folder**: `C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new`
- **Architecture**: Role-based course assignments
  - Users → Project Roles → Role-Course Mappings → Courses
  - Managed via `role_course_mappings` table
- **Status**: ✅ **UNTOUCHED AND SAFE** - continues to work normally

### New State (MS Access App)
- **Folder**: `C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access` ⭐ **YOU ARE HERE**
- **Architecture**: Individual-based course assignments
  - Users → User-Course Mappings → Courses (direct)
  - Uses `user_course_mappings` table
- **Status**: 🚧 **IN DEVELOPMENT** - schema deployed, app copied, ready for component development

---

## ✅ What's Been Completed

### 1. New Supabase Instance Created
- **Project Name**: MS Access Migration Project
- **Project Reference ID**: `syrdmvfwptkzjdwvdcae`
- **Project UUID**: `9dc6763e-8573-4a32-aead-ca77379d0620`
- **URL**: https://syrdmvfwptkzjdwvdcae.supabase.co

### 2. Database Schema Deployed
Complete schema deployed including:
- ✅ `projects` and `project_users` (project isolation)
- ✅ `functional_areas`, `training_locations`, `project_roles` (reference data)
- ✅ `courses` (course catalog)
- ✅ `end_users` (user directory)
- ✅ **`user_course_mappings`** (individual course assignments - THE KEY TABLE!)
- ✅ `training_schedules`, `training_sessions`, `user_assignments` (TSC Wizard)
- ✅ All RLS policies (Row Level Security)
- ✅ All indexes for performance
- ✅ Helper functions (get_user_courses, get_course_users, bulk_assign_courses)

**Schema File**: `NEW_INSTANCE_MASTER_SCHEMA.sql`

### 3. Application Copied
- Original app: `training_needs_db_app_new` (unchanged)
- New app: `training_needs_db_app_ms_access` (this folder!)
- `.env` file updated with new Supabase credentials

### 4. Initial Project Created
- Project ID: `9dc6763e-8573-4a32-aead-ca77379d0620`
- All imported data will use this project ID

---

## 🚧 What's Next (In Order)

### Phase 1: Build Import/Export Components (NEXT STEP!)

**Goal**: Create UI components to import MS Access data via CSV files

#### 1A. Build ImportExportUserCourseMappings Component (PRIORITY 1)
**File to Create**: `src/shared/components/ImportExportUserCourseMappings.jsx`

**Features**:
- **Excel Template Generator**:
  - Export template with all users (rows) and all courses (columns)
  - Wide format: Each course is a column, mark with 'X' for assignment
  - Include user metadata: ID, Name, Email, Role, Location
  - Include course metadata in headers

- **Import Wizard**:
  - Upload completed Excel/CSV file
  - Validate structure (users exist, courses exist)
  - Parse X's/checkmarks to create user-course mappings
  - Batch insert into `user_course_mappings` table
  - Show import summary (X users, Y courses, Z assignments)
  - Handle errors gracefully

**Excel Format**:
```
UserID | Name      | Email        | Role    | COURSE_A | COURSE_B | COURSE_C
1      | John Doe  | john@ex.com  | Manager | X        | X        |
2      | Mary Jane | mary@ex.com  | Staff   | X        |          | X
```

**Why This First?**: Your MS Access data will be initially loaded via this bulk import.

#### 1B. Build Individual User Course Editor (PRIORITY 2)
**File to Create**: `src/shared/components/UserCourseMappingsEditor.jsx`

**Purpose**: For ongoing changes after initial import

**Features**:
- Select one user from dropdown
- View user's current course assignments
- Add/remove courses via checkboxes
- Show course details (functional area, duration, etc.)
- Save/Cancel buttons
- Assignment audit info (assigned by, date)

#### 1C. Build Bulk Course Assignment Tool (PRIORITY 3)
**File to Create**: `src/shared/components/BulkCourseAssignmentTool.jsx`

**Purpose**: For bulk updates to filtered groups of users

**Features**:
- Filter users by: role, location, department, name/email
- Multi-select users
- Multi-select courses
- Assignment mode toggle: ADD (keep existing) vs REPLACE (clear and reassign)
- Preview: "Assigning 5 courses to 12 users"
- Progress indicator
- Results summary

---

### Phase 2: Modify TSC Wizard (Training Schedule Creator)

**Goal**: Make TSC Wizard use `user_course_mappings` instead of `role_course_mappings`

**Files to Modify**:
- `src/modules/training/components/tsc-wizard/TSCFetchDataStage.jsx`
  - Current: Fetches `project_roles` with `role_course_mappings`
  - New: Fetch `end_users` JOIN `user_course_mappings`

**Key Insight**: `TrainingCalculations.jsx` already expects `user.course_id`, so minimal changes needed!

**Data Structure Change**:
```javascript
// OLD (Role-Based):
const data = {
  courses: [...],
  end_users: projectRoles.map(role => ({
    ...role,
    course_id: role.mapped_course_id
  }))
}

// NEW (Individual-Based):
const data = {
  courses: [...],
  end_users: users.map(user => ({
    ...user,
    course_id: user.assigned_course_id  // from user_course_mappings
  }))
}
```

---

### Phase 3: MS Access Data Export

**Goal**: Export data from MS Access to CSV format for import

**Tables to Export from MS Access**:

1. **end_users** → `ms_access_end_users.csv`
   - Columns: id, name, email, job_title, country, division, sub_division, training_location, project_role, location_name

2. **courses** → `ms_access_courses.csv`
   - Columns: course_id, course_name, functional_area, duration_hrs, application, priority

3. **user_course_mappings** → `ms_access_user_course_mappings.csv`
   - Columns: end_user_id, course_id, assigned_by, notes
   - OR use wide format (preferred): UserID, Name, Email, Role, COURSE_A, COURSE_B, etc.

4. **functional_areas** → `ms_access_functional_areas.csv` (optional)
5. **training_locations** → `ms_access_training_locations.csv` (optional)

**MS Access Export Steps**:
1. Open MS Access database
2. Select table → External Data → Export → Text File
3. Choose CSV format
4. Save with descriptive names

---

### Phase 4: Data Import Workflow

**Goal**: Import all MS Access data into new Supabase instance

**Import Order** (IMPORTANT!):
1. ✅ **Projects** - Already created (9dc6763e-8573-4a32-aead-ca77379d0620)
2. **Functional Areas** (if needed) - Import via existing component or SQL
3. **Training Locations** (if needed) - Import via existing component or SQL
4. **Courses** - Import via existing `ImportExportCourses.jsx` component
5. **End Users** - Import via existing `ImportExportEndUsers.jsx` component
6. **User-Course Mappings** - Import via NEW `ImportExportUserCourseMappings.jsx` component ⭐

**Why This Order?**: Foreign key dependencies require parent records exist first.

---

### Phase 5: Testing & Validation

**Goal**: Ensure complete workflow works end-to-end

**Test Checklist**:
- [ ] Import courses from MS Access CSV
- [ ] Import end users from MS Access CSV
- [ ] Import user-course mappings from MS Access CSV
- [ ] Verify data in Supabase Table Editor
- [ ] Verify user-course relationships are correct
- [ ] TSC Wizard loads users with their assigned courses
- [ ] TSC Wizard generates training sessions correctly
- [ ] Calendar events created successfully
- [ ] User assignments work properly
- [ ] Export functionality works
- [ ] No console errors

**Validation Queries** (run in Supabase SQL Editor):
```sql
-- Check record counts
SELECT 'courses' as table_name, COUNT(*) as count FROM courses
UNION ALL
SELECT 'end_users', COUNT(*) FROM end_users
UNION ALL
SELECT 'user_course_mappings', COUNT(*) FROM user_course_mappings;

-- Check user-course mappings sample
SELECT
    eu.name,
    eu.email,
    c.course_id,
    c.course_name,
    ucm.assigned_by
FROM user_course_mappings ucm
JOIN end_users eu ON ucm.end_user_id = eu.id
JOIN courses c ON ucm.course_id = c.course_id
LIMIT 10;

-- Check users without courses (should be zero or intentional)
SELECT eu.id, eu.name, eu.email
FROM end_users eu
LEFT JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
WHERE ucm.id IS NULL;
```

---

## 📋 Key Files & Locations

### Configuration Files
- **Environment**: `.env` (already updated with new Supabase credentials)
- **Schema**: `NEW_INSTANCE_MASTER_SCHEMA.sql` (deployed to Supabase)
- **Project ID**: `9dc6763e-8573-4a32-aead-ca77379d0620`

### Components to Create
- `src/shared/components/ImportExportUserCourseMappings.jsx` ⭐ **START HERE**
- `src/shared/components/ImportExportUserCourseMappings.css`
- `src/shared/components/UserCourseMappingsEditor.jsx`
- `src/shared/components/UserCourseMappingsEditor.css`
- `src/shared/components/BulkCourseAssignmentTool.jsx`
- `src/shared/components/BulkCourseAssignmentTool.css`

### Existing Components to Reference
- `src/shared/components/ImportExportEndUsers.jsx` (similar pattern for CSV import)
- `src/shared/components/ImportExportCourses.jsx` (similar pattern for CSV import)
- `src/modules/training/components/tsc-wizard/TSCFetchDataStage.jsx` (will be modified)

### Database Tables
- **Key Table**: `user_course_mappings` (end_user_id, course_id, project_id, assigned_by, notes)
- **Supporting**: `end_users`, `courses`, `projects`
- **TSC Wizard**: `training_schedules`, `training_sessions`, `user_assignments`

---

## 🔧 Development Commands

### Start Development Server
```bash
cd C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access
npm run dev
```
**Note**: Will likely run on different port than original app (e.g., 5174 instead of 5173)

### Access Supabase Dashboard
**New Instance**: https://supabase.com/dashboard/project/syrdmvfwptkzjdwvdcae

### Useful SQL Queries
```sql
-- View all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- View user-course mappings
SELECT * FROM user_course_mappings LIMIT 10;

-- Count mappings per user
SELECT end_user_id, COUNT(*) as course_count
FROM user_course_mappings
GROUP BY end_user_id
ORDER BY course_count DESC;
```

---

## 🎯 Immediate Next Steps

### When You Resume Development:

1. **Open the new folder in VS Code**:
   ```bash
   code C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access
   ```

2. **Start building ImportExportUserCourseMappings component**:
   - File: `src/shared/components/ImportExportUserCourseMappings.jsx`
   - Reference existing import components for patterns
   - Focus on Excel template generation first
   - Then build the import validation and processing logic

3. **Reference existing patterns**:
   - Look at `ImportExportEndUsers.jsx` for CSV parsing
   - Look at `ImportExportCourses.jsx` for Supabase insertion
   - Use `papaparse` library (already in project) for CSV handling

4. **Test as you go**:
   - Start dev server: `npm run dev`
   - Navigate to the import component
   - Test template generation
   - Test import with small sample file first

---

## 🚨 Important Reminders

### DO NOT Touch Original App
- **Folder**: `training_needs_db_app_new`
- **Status**: Production/stable - leave completely untouched
- Original Supabase instance (dcjgyqybjfbqpxojiamz) remains fully functional

### Safety Net
- You can always delete the new app folder and start over
- Original app is your backup/rollback point
- New Supabase instance is isolated - no impact on original data

### Data Flow
```
MS Access Database
    ↓ (Export to CSV)
CSV Files
    ↓ (ImportExportUserCourseMappings component)
New Supabase Instance (syrdmvfwptkzjdwvdcae)
    ↓ (TSC Wizard)
Training Schedules & Calendar Events
```

---

## 📞 Quick Reference

### New Supabase Instance
- **URL**: https://syrdmvfwptkzjdwvdcae.supabase.co
- **Project Ref**: syrdmvfwptkzjdwvdcae
- **Project UUID**: 9dc6763e-8573-4a32-aead-ca77379d0620

### App Folders
- **Original**: `C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new`
- **MS Access**: `C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access` ⭐

### Key Concept
**Individual Mappings**: Each user has their own specific list of courses assigned directly, rather than inheriting courses from their role. This provides maximum flexibility for the MS Access data structure.

---

## ✅ Success Criteria

The project will be complete when:
1. ✅ All MS Access data imported successfully
2. ✅ TSC Wizard generates schedules using individual mappings
3. ✅ Training sessions created with correct attendees
4. ✅ Calendar events display properly
5. ✅ Users can be assigned/removed from courses via UI
6. ✅ Bulk operations work efficiently
7. ✅ No data loss or errors in workflow
8. ✅ System is usable for few months until returning to role-based

---

**Last Updated**: 2025-01-17
**Status**: Ready to begin component development
**Next Action**: Build ImportExportUserCourseMappings component
