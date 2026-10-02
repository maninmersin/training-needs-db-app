# MS Access Database - Individual Course Mapping Test Environment

## Overview

This MS Access database is designed to test the **individual-based course assignment approach** as an alternative to the current **role-based course assignment system**. The database schema exactly matches your PostgreSQL structure, allowing seamless data import/export between Access and your main application.

## Project Goal

**Test Question**: Is assigning training courses to individual employees (rather than job roles) a more flexible and effective approach for your organization?

**Use Case**: Test individual course mapping in MS Access, and if successful, import the assignment data back to your main PostgreSQL application.

---

## Files Included

### 1. `access_database_schema.sql`
**Purpose**: Complete MS Access database schema with all table definitions

**Contents**:
- 7 core tables (end_users, courses, training_locations, user_course_mappings, etc.)
- Lines of Business (LoB) tables and many-to-many junction tables
- Sample data for testing (3 LoB, 3 training locations, 4 courses, 4 users)
- Indexes and unique constraints
- Useful testing queries
- Implementation notes and troubleshooting guide

**How to Use**:
1. Create new blank MS Access database
2. Open SQL View (Create → Query Design → SQL View)
3. Copy/paste CREATE TABLE statements from this file
4. Run each CREATE TABLE individually
5. Run INSERT statements to populate sample data

---

### 2. `export_to_access.sql`
**Purpose**: PostgreSQL scripts to export your current data for MS Access import

**Contents**:
- Export scripts for training_locations, courses, end_users
- Generates MS Access-compatible INSERT statements
- Combined export option (all data at once)
- Alternative CSV export instructions
- Troubleshooting guide for common export issues

**How to Use**:
1. Find your project UUID in PostgreSQL: `SELECT id, name FROM projects;`
2. Replace `'YOUR_PROJECT_ID_HERE'` in scripts with your actual project UUID
3. Run export scripts in Supabase SQL Editor
4. Copy the generated INSERT statements
5. Paste and run in MS Access SQL View
6. Verify data imported correctly by opening tables

**Alternative**: Export to CSV files and import via Access GUI

---

### 3. `import_from_access.sql`
**Purpose**: PostgreSQL scripts to import course assignments from Access back to PostgreSQL

**Contents**:
- Three import methods (Direct SQL, CSV Staging, Upsert)
- ID mapping strategy (if user IDs differ between systems)
- Data validation queries (check for duplicates, invalid IDs)
- Post-import verification queries
- LoB assignment import scripts (optional)
- Rollback procedures (if import goes wrong)
- Complete workflow summary

**How to Use**:
1. After testing in Access, export `user_course_mappings` to CSV
2. Create staging table in PostgreSQL (see Method 2)
3. Import CSV data to staging table
4. Validate staging data (check for errors)
5. Import from staging to production `user_course_mappings` table
6. Verify results with validation queries
7. Test in main application (TSC Wizard)

---

### 4. `ACCESS_DATABASE_README.md` (this file)
**Purpose**: Comprehensive guide to using the MS Access test environment

---

## Database Schema Overview

### Core Tables

#### 1. **end_users**
Stores employee/end user information who need training

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| name | TEXT(255) | Full name (required) |
| email | TEXT(255) | Email address |
| job_title | TEXT(255) | Job title/position |
| country | TEXT(100) | Country |
| division | TEXT(255) | Business division |
| sub_division | TEXT(255) | Sub-division |
| location_name | TEXT(255) | Physical office location |
| training_location | TEXT(255) | Training venue (FK to training_locations.name) |
| project_role | TEXT(255) | Job role (for filtering/organization) |
| organisation | TEXT(255) | Organization/department |
| project_id | TEXT(36) | Project UUID (use '00000000-0000-0000-0000-000000000001') |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Relationships**:
- Many-to-many with `lines_of_business` via `end_user_lob_assignments`
- Many-to-many with `courses` via `user_course_mappings`

---

#### 2. **courses**
Training course catalog

| Column | Type | Description |
|--------|------|-------------|
| course_id | TEXT(50) | Primary key (e.g., 'C001', 'C002') |
| course_name | TEXT(255) | Course title (required) |
| functional_area | TEXT(255) | Functional area category (required) |
| duration_hrs | DOUBLE | Duration in hours (e.g., 2.5, 4.0) |
| application | TEXT(255) | Application/context |
| priority | INTEGER | Priority ranking |
| project_id | TEXT(36) | Project UUID |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Relationships**:
- Many-to-many with `lines_of_business` via `course_lob_assignments`
- Many-to-many with `end_users` via `user_course_mappings`

---

#### 3. **training_locations**
Reference data for training venue locations

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| name | TEXT(255) | Location name (required, unique per project) |
| display_order | INTEGER | Ordering for dropdowns |
| active | YESNO | Active status (default: True) |
| project_id | TEXT(36) | Project UUID |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Relationships**:
- Referenced by `end_users.training_location`

---

#### 4. **user_course_mappings** ⭐ **PRIMARY TEST TABLE**
Individual course assignments (this is the new approach being tested!)

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| project_id | TEXT(36) | Project UUID (required) |
| end_user_id | INTEGER | FK to end_users.id (required) |
| course_id | TEXT(50) | FK to courses.course_id (required) |
| assigned_by | TEXT(50) | Who assigned (default: 'admin') |
| assigned_date | DATETIME | When assigned (default: now) |
| notes | MEMO | Assignment notes/comments |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**UNIQUE CONSTRAINT**: (end_user_id, course_id) - prevents duplicate course assignments

**Purpose**: This table replaces the role-based mapping approach. Each employee can have their own unique list of assigned courses.

---

#### 5. **lines_of_business**
Reference data for Lines of Business (Prime, Parts, Services)

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| lob_code | TEXT(50) | LoB code (e.g., 'PRIME', 'PARTS', 'SERVICES') |
| lob_name | TEXT(255) | LoB display name (required) |
| description | MEMO | Description of LoB |
| display_order | INTEGER | Ordering for dropdowns |
| active | YESNO | Active status (default: True) |
| project_id | TEXT(36) | Project UUID |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**UNIQUE CONSTRAINT**: (lob_code, project_id)

---

#### 6. **end_user_lob_assignments**
Many-to-many junction table: Employees can work across multiple Lines of Business

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| end_user_id | INTEGER | FK to end_users.id (required) |
| lob_code | TEXT(50) | FK to lines_of_business.lob_code (required) |
| is_primary | YESNO | Is this the user's primary LoB? (default: False) |
| project_id | TEXT(36) | Project UUID |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**UNIQUE CONSTRAINT**: (end_user_id, lob_code) - prevents duplicate LoB assignments

**Example**: Lisa Brown (Regional Manager) is assigned to all three LoB (PRIME, PARTS, SERVICES) with PRIME as primary.

---

#### 7. **course_lob_assignments**
Many-to-many junction table: Courses can apply to multiple Lines of Business

| Column | Type | Description |
|--------|------|-------------|
| id | AUTOINCREMENT | Primary key |
| course_id | TEXT(50) | FK to courses.course_id (required) |
| lob_code | TEXT(50) | FK to lines_of_business.lob_code (required) |
| is_mandatory | YESNO | Is course mandatory for this LoB? (default: False) |
| project_id | TEXT(36) | Project UUID |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**UNIQUE CONSTRAINT**: (course_id, lob_code) - prevents duplicate course-LoB assignments

**Example**: "Safety Training" (C001) is assigned to all three LoB (PRIME, PARTS, SERVICES) as mandatory.

---

## Sample Data Included

### Lines of Business (3 records)
- **PRIME** - Prime retail operations and sales
- **PARTS** - Parts inventory and distribution
- **SERVICES** - Customer services and support

### Training Locations (3 records)
- Manchester
- London
- Birmingham

### Courses (4 records)
1. **C001** - Safety Training (2.5 hrs, Health & Safety) - Applies to ALL LoB
2. **C002** - Customer Service Excellence (4.0 hrs, Customer Relations) - Applies to PRIME + SERVICES
3. **C003** - Inventory Management (3.0 hrs, Operations) - Applies to PARTS only
4. **C004** - Leadership Development (8.0 hrs, Management) - Applies to ALL LoB (optional)

### End Users (4 records)
1. **John Doe** - Store Manager (PRIME) - Assigned: C001 + C002
2. **Mary Smith** - Parts Specialist (PARTS) - Assigned: C001 + C003
3. **Steve Johnson** - Service Advisor (SERVICES) - Assigned: C001 + C002
4. **Lisa Brown** - Regional Manager (PRIME + PARTS + SERVICES) - Assigned: C001 + C004

### User-LoB Assignments (6 records)
Demonstrates how users can belong to one or multiple Lines of Business.

### Course-LoB Assignments (9 records)
Demonstrates how courses can apply to one or multiple Lines of Business.

### User-Course Mappings (8 records)
Demonstrates individual course assignments with different combinations per employee.

---

## Step-by-Step Usage Guide

### Phase 1: Create MS Access Database

**Step 1.1**: Create New Database
1. Open MS Access
2. File → New → Blank Database
3. Name: `training_needs_test.accdb`
4. Save in convenient location

**Step 1.2**: Create Tables
1. Create → Query Design → SQL View
2. Open `access_database_schema.sql`
3. Copy one CREATE TABLE statement at a time
4. Paste into SQL View
5. Click "Run" (!) button
6. Repeat for all 7 tables

**Step 1.3**: Verify Table Structure
1. Close SQL View
2. View all tables in navigation pane (left sidebar)
3. Open each table in Design View
4. Verify columns, data types, primary keys
5. Create foreign key relationships:
   - Database Tools → Relationships
   - Drag lines between related fields
   - Check "Enforce Referential Integrity"

**Step 1.4**: Load Sample Data
1. Return to SQL View
2. Copy INSERT statements from `access_database_schema.sql`
3. Run INSERT statements (individually or in batches)
4. Open each table to verify data loaded correctly

**Troubleshooting**:
- If CREATE TABLE fails: Use Table Design View to create tables manually
- If INSERT fails: Check for foreign key constraint violations (import order matters)
- If UNIQUE constraint fails: Create indexes via Table Design → Indexes

---

### Phase 2: Import Your Actual Data from PostgreSQL

**Step 2.1**: Find Your Project UUID
1. Open Supabase Dashboard → SQL Editor
2. Run: `SELECT id, name FROM projects WHERE name LIKE '%your_project%';`
3. Copy your project UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

**Step 2.2**: Export Training Locations
1. Open `export_to_access.sql`
2. Find "SCRIPT 1: EXPORT TRAINING LOCATIONS"
3. Replace `'YOUR_PROJECT_ID_HERE'` with your actual project UUID
4. Run in Supabase SQL Editor
5. Copy all INSERT statements from results
6. Paste into MS Access SQL View
7. Run to import training locations

**Step 2.3**: Export Courses
1. Find "SCRIPT 2: EXPORT COURSES" in `export_to_access.sql`
2. Replace `'YOUR_PROJECT_ID_HERE'` with your actual project UUID
3. Run in Supabase SQL Editor
4. Copy INSERT statements
5. Paste into MS Access SQL View
6. Run to import courses

**Step 2.4**: Export End Users
1. Find "SCRIPT 3: EXPORT END USERS" in `export_to_access.sql`
2. Replace `'YOUR_PROJECT_ID_HERE'` with your actual project UUID
3. Run in Supabase SQL Editor
4. Copy INSERT statements
5. Paste into MS Access SQL View
6. Run to import end users

**Step 2.5**: Verify Import
1. Open each table in MS Access
2. Check record counts match PostgreSQL
3. Verify data integrity (no missing fields, correct values)
4. Run test queries (see "Useful Queries" section below)

**Alternative: CSV Import**
- Export each table to CSV from PostgreSQL
- In Access: External Data → Import → Text File
- Select CSV file and map columns to table

---

### Phase 3: Test Individual Course Mapping

**Step 3.1**: Delete Sample Assignments (if desired)
```sql
DELETE FROM user_course_mappings;
```

**Step 3.2**: Create Your Own Course Assignments

**Option A: Manual Entry (Small Dataset)**
1. Open `user_course_mappings` table
2. Click "New Record" (bottom of table)
3. Enter values:
   - `project_id`: 00000000-0000-0000-0000-000000000001
   - `end_user_id`: 1 (or select user ID)
   - `course_id`: C001 (or select course ID)
   - `assigned_by`: admin
   - `assigned_date`: (leave default or enter date)
   - `notes`: (optional comments)
4. Repeat for each user-course assignment

**Option B: SQL INSERT (Medium Dataset)**
```sql
-- Example: Assign C001 to all users
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
SELECT '00000000-0000-0000-0000-000000000001', id, 'C001', 'admin'
FROM end_users;

-- Example: Assign specific courses to specific users
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
VALUES
('00000000-0000-0000-0000-000000000001', 1, 'C001', 'admin', 'Mandatory safety'),
('00000000-0000-0000-0000-000000000001', 1, 'C002', 'admin', 'Customer service'),
('00000000-0000-0000-0000-000000000001', 2, 'C001', 'admin', 'Mandatory safety'),
('00000000-0000-0000-0000-000000000001', 2, 'C003', 'admin', 'Inventory mgmt');
```

**Option C: Create Access Form (Best User Experience)**
1. Create → Form Design
2. Add combo box for user selection (data source: end_users)
3. Add multi-select list box for courses (data source: courses)
4. Add "Assign Courses" button with VBA code:
   ```vba
   Private Sub btnAssignCourses_Click()
       Dim db As DAO.Database
       Dim rs As DAO.Recordset
       Dim userID As Integer
       Dim courseID As String

       Set db = CurrentDb()
       userID = Me.cboUser.Value

       ' Loop through selected courses
       For Each courseID In Me.lstCourses.ItemsSelected
           Set rs = db.OpenRecordset("user_course_mappings")
           rs.AddNew
           rs!project_id = "00000000-0000-0000-0000-000000000001"
           rs!end_user_id = userID
           rs!course_id = Me.lstCourses.ItemData(courseID)
           rs!assigned_by = "admin"
           rs!assigned_date = Now()
           rs.Update
           rs.Close
       Next courseID

       MsgBox "Courses assigned successfully!"
   End Sub
   ```

**Step 3.3**: Assign Courses Based on Lines of Business

**Strategy 1**: Assign all courses for a user's LoB
```sql
-- Assign all mandatory courses for user's primary LoB
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by, notes)
SELECT
    '00000000-0000-0000-0000-000000000001',
    ela.end_user_id,
    cla.course_id,
    'system',
    'Auto-assigned based on LoB: ' & lob.lob_name
FROM end_user_lob_assignments ela
INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
WHERE ela.is_primary = True  -- Primary LoB only
  AND cla.is_mandatory = True;  -- Mandatory courses only
```

**Strategy 2**: Assign specific courses to users in specific LoB
```sql
-- Assign Safety Training to all PRIME users
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
SELECT DISTINCT
    '00000000-0000-0000-0000-000000000001',
    ela.end_user_id,
    'C001',
    'admin'
FROM end_user_lob_assignments ela
WHERE ela.lob_code = 'PRIME';
```

**Step 3.4**: Validate Assignments
```sql
-- View all users with their assigned courses
SELECT
    eu.id,
    eu.name,
    c.course_id,
    c.course_name,
    ucm.assigned_date
FROM end_users eu
INNER JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
INNER JOIN courses c ON ucm.course_id = c.course_id
ORDER BY eu.name, c.course_id;

-- Find users with no course assignments
SELECT eu.id, eu.name, eu.email, eu.job_title
FROM end_users eu
LEFT JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
WHERE ucm.id IS NULL;

-- Course assignment summary (how many users per course)
SELECT c.course_id, c.course_name, COUNT(ucm.id) AS assigned_count
FROM courses c
LEFT JOIN user_course_mappings ucm ON c.course_id = ucm.course_id
GROUP BY c.course_id, c.course_name
ORDER BY assigned_count DESC;
```

**Step 3.5**: Iterate and Refine
- Try different assignment strategies
- Test bulk assignments vs individual assignments
- Evaluate ease of use and flexibility
- Compare to role-based approach
- Gather feedback from stakeholders

---

### Phase 4: Export Assignments Back to PostgreSQL

**Step 4.1**: Validate Data in Access
```sql
-- Check for duplicate assignments (should return no records)
SELECT end_user_id, course_id, COUNT(*) AS count
FROM user_course_mappings
GROUP BY end_user_id, course_id
HAVING COUNT(*) > 1;

-- Check for invalid user IDs
SELECT DISTINCT ucm.end_user_id
FROM user_course_mappings ucm
LEFT JOIN end_users eu ON ucm.end_user_id = eu.id
WHERE eu.id IS NULL;

-- Check for invalid course IDs
SELECT DISTINCT ucm.course_id
FROM user_course_mappings ucm
LEFT JOIN courses c ON ucm.course_id = c.course_id
WHERE c.course_id IS NULL;
```

**Step 4.2**: Export to CSV
1. Open `user_course_mappings` table in MS Access
2. External Data → Export → Text File
3. Select CSV format
4. Include column headers
5. Save as `user_course_mappings_export.csv`

**Exported columns**:
- end_user_id
- course_id
- assigned_by
- assigned_date
- notes

**Step 4.3**: Import to PostgreSQL (See `import_from_access.sql`)
1. Create staging table in PostgreSQL
2. Upload CSV to Supabase Storage or use psql COPY command
3. Validate staging data (check for errors, duplicates)
4. Import to production `user_course_mappings` table
5. Verify import results

**Full instructions in `import_from_access.sql` - Method 2: CSV Import**

---

### Phase 5: Test in Main Application

**Step 5.1**: Verify Data Import
1. Log into your main application
2. Navigate to TSC Wizard or course assignment area
3. Check that individual assignments appear correctly
4. Verify user-course mappings display as expected

**Step 5.2**: Generate Training Schedule (TSC Wizard)
1. Open TSC Wizard
2. Select courses and date range
3. Generate training schedule
4. Verify attendees match individual assignments (not role-based)
5. Check training session calculations (group sizes, session counts)

**Step 5.3**: Create Calendar Events
1. Review generated training schedule
2. Create calendar events
3. Verify events created successfully
4. Check attendee assignments in calendar

**Step 5.4**: Evaluate Results
- Compare to role-based approach
- Assess flexibility and ease of use
- Identify any issues or gaps
- Gather user feedback
- Make decision: continue with individual mapping or revert to role-based

---

## Useful Queries for Testing

### Query 1: View All Users with Their Lines of Business
```sql
SELECT
    eu.id,
    eu.name,
    eu.email,
    eu.job_title,
    lob.lob_name,
    ela.is_primary
FROM end_users eu
INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
ORDER BY eu.name, ela.is_primary DESC;
```

### Query 2: View All Users with Their Assigned Courses
```sql
SELECT
    eu.id,
    eu.name,
    eu.email,
    c.course_id,
    c.course_name,
    c.duration_hrs,
    ucm.assigned_date,
    ucm.notes
FROM end_users eu
INNER JOIN user_course_mappings ucm ON eu.id = ucm.end_user_id
INNER JOIN courses c ON ucm.course_id = c.course_id
ORDER BY eu.name, c.course_id;
```

### Query 3: View Courses by Line of Business
```sql
SELECT
    lob.lob_name,
    c.course_id,
    c.course_name,
    c.functional_area,
    cla.is_mandatory
FROM lines_of_business lob
INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
INNER JOIN courses c ON cla.course_id = c.course_id
ORDER BY lob.lob_name, c.course_id;
```

### Query 4: Find Users Who Need Courses Based on Their LoB (Not Yet Assigned)
```sql
SELECT DISTINCT
    eu.id,
    eu.name,
    lob.lob_name,
    c.course_id,
    c.course_name,
    cla.is_mandatory
FROM end_users eu
INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
INNER JOIN lines_of_business lob ON ela.lob_code = lob.lob_code
INNER JOIN course_lob_assignments cla ON lob.lob_code = cla.lob_code
INNER JOIN courses c ON cla.course_id = c.course_id
LEFT JOIN user_course_mappings ucm ON (eu.id = ucm.end_user_id AND c.course_id = ucm.course_id)
WHERE ucm.id IS NULL
ORDER BY eu.name, c.course_id;
```

### Query 5: Course Assignment Summary (Counts)
```sql
SELECT
    c.course_id,
    c.course_name,
    c.functional_area,
    COUNT(ucm.id) AS assigned_count
FROM courses c
LEFT JOIN user_course_mappings ucm ON c.course_id = ucm.course_id
GROUP BY c.course_id, c.course_name, c.functional_area
ORDER BY assigned_count DESC, c.course_id;
```

### Query 6: Users Per Line of Business (Summary)
```sql
SELECT
    lob.lob_name,
    COUNT(DISTINCT ela.end_user_id) AS user_count
FROM lines_of_business lob
LEFT JOIN end_user_lob_assignments ela ON lob.lob_code = ela.lob_code
GROUP BY lob.lob_name
ORDER BY user_count DESC;
```

### Query 7: Employees with Multiple LoB Assignments
```sql
SELECT
    eu.id,
    eu.name,
    eu.job_title,
    COUNT(ela.lob_code) AS lob_count
FROM end_users eu
INNER JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
GROUP BY eu.id, eu.name, eu.job_title
HAVING COUNT(ela.lob_code) > 1
ORDER BY lob_count DESC;
```

### Query 8: Comprehensive Training Matrix (Users × Courses)
```sql
SELECT
    eu.name AS "Employee Name",
    eu.job_title AS "Job Title",
    lob.lob_name AS "Line of Business",
    c.course_name AS "Course",
    c.duration_hrs AS "Duration (hrs)",
    CASE WHEN ucm.id IS NOT NULL THEN 'Assigned' ELSE 'Not Assigned' END AS "Status"
FROM end_users eu
CROSS JOIN courses c
LEFT JOIN end_user_lob_assignments ela ON eu.id = ela.end_user_id
LEFT JOIN lines_of_business lob ON ela.lob_code = lob.lob_code AND ela.is_primary = True
LEFT JOIN user_course_mappings ucm ON (eu.id = ucm.end_user_id AND c.course_id = ucm.course_id)
ORDER BY eu.name, c.course_id;
```

---

## Tips for Testing Individual Course Mapping

### 1. **Start with Sample Data**
Use the provided sample data to understand relationships and test queries before importing your actual data.

### 2. **Test Different Assignment Strategies**
- **All-at-once**: Bulk assign all mandatory courses to all users in specific LoB
- **Role-based baseline**: Assign standard courses by role, then customize per individual
- **Manager-driven**: Allow managers to assign courses to their team members
- **Self-selection**: Let employees request courses (with approval workflow)

### 3. **Evaluate Flexibility**
- Can you easily handle exceptions (users who need extra courses)?
- Can you handle users who work across multiple LoB?
- Is it easy to update assignments when roles change?

### 4. **Compare to Role-Based Approach**
| Aspect | Role-Based | Individual-Based |
|--------|------------|------------------|
| Setup Effort | Low (one-time role setup) | Medium (assign each user) |
| Flexibility | Low (all users in role get same courses) | High (each user customized) |
| Maintenance | Low (update role mapping) | Medium (update individual assignments) |
| Exceptions | Hard (requires workarounds) | Easy (just assign different courses) |
| Bulk Changes | Easy (change role mapping) | Medium (need bulk tools) |
| Audit Trail | Limited | Detailed (who assigned, when) |

### 5. **Use LoB Assignments Wisely**
- Tag users with their Lines of Business
- Tag courses with applicable LoB
- Use LoB to suggest courses (but don't auto-assign without flexibility)
- Allow cross-LoB course assignments when needed

### 6. **Build Helper Queries**
Create saved queries for common tasks:
- "Assign all mandatory LoB courses to new employee"
- "Show gaps (users missing mandatory courses)"
- "Clone assignments from one user to another"

### 7. **Test with Real Scenarios**
- New employee onboarding (what courses do they need?)
- Role change (how to update courses?)
- Cross-functional project (users from multiple LoB)
- Manager requests exception (specific user needs extra course)

---

## Troubleshooting

### Issue: CREATE TABLE fails in MS Access
**Solution**:
- Use Table Design View instead of SQL
- Create tables manually by defining fields, data types, keys
- Older Access versions may not support all SQL syntax

### Issue: INSERT statements fail with "duplicate key" error
**Solution**:
- Delete existing sample data first: `DELETE FROM table_name;`
- Or reset auto-increment: Compact & Repair Database

### Issue: Foreign key constraint violation during import
**Solution**:
- Import tables in correct order (parent tables before child tables)
- Order: training_locations → courses → lines_of_business → end_users → junction tables → user_course_mappings

### Issue: User IDs don't match between Access and PostgreSQL
**Solution**:
- Use email address as matching key instead of ID
- Create ID mapping table (see `import_from_access.sql` - ID Mapping Strategy)

### Issue: CSV export includes quotes around all fields
**Solution**:
- Normal behavior for CSV with TEXT fields
- PostgreSQL COPY command handles quoted fields correctly
- Or remove quotes in text editor with find/replace

### Issue: Date format incompatible between systems
**Solution**:
- Use ISO format: YYYY-MM-DD HH:MM:SS
- In Access export: Format(assigned_date, "yyyy-mm-dd hh:nn:ss")
- In PostgreSQL import: TO_TIMESTAMP(date_string, 'YYYY-MM-DD HH24:MI:SS')

---

## Next Steps After Testing

### If Individual Mapping Works Well:
1. Import assignment data back to PostgreSQL (see `import_from_access.sql`)
2. Update TSC Wizard to use individual mappings (see CLAUDE.md Phase 3)
3. Build UI tools for ongoing course assignment management
4. Deploy to production
5. Archive Access database for reference

### If Role-Based Approach is Better:
1. Document findings and rationale
2. Keep Access database for reference
3. Continue with existing role-based system
4. Consider hybrid approach (role baseline + individual exceptions)

### If You Need More Testing:
1. Import more real data from PostgreSQL
2. Involve stakeholders and managers
3. Test bulk assignment tools
4. Evaluate effort required for ongoing maintenance

---

## Support and Questions

### Documentation Files:
- `access_database_schema.sql` - Complete database schema and sample data
- `export_to_access.sql` - Export data from PostgreSQL to Access
- `import_from_access.sql` - Import assignments from Access back to PostgreSQL
- `ACCESS_DATABASE_README.md` - This comprehensive guide

### Additional Resources:
- **CLAUDE.md** - Main project documentation with architecture details
- **Training Course Assignment Architecture Redesign** section - Detailed background on individual vs role-based approaches

### Getting Help:
- Review troubleshooting sections in each SQL file
- Check MS Access help documentation for SQL syntax differences
- Test queries on sample data before using on production data
- Always backup before importing data to PostgreSQL

---

## Summary

This MS Access test environment provides a complete, isolated sandbox for testing the **individual-based course assignment approach**. The database schema exactly matches your PostgreSQL structure, ensuring seamless data import/export.

**Key Benefits**:
✅ Test new approach without affecting production data
✅ Evaluate flexibility and ease of use
✅ Compare to existing role-based system
✅ Import successful assignments back to main application
✅ Make informed decision based on real testing

**Next Action**: Create the Access database, load your data, and start testing individual course assignments!

Good luck with your testing! 🚀
