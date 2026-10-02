# MS Access Database Setup Guide - Step by Step

## Problem: SQL Syntax Errors

MS Access has **very limited SQL support** compared to PostgreSQL. Many SQL features don't work:
- ❌ `DEFAULT` constraints in CREATE TABLE
- ❌ `NOT NULL` constraints (in some versions)
- ❌ Some complex index creation syntax
- ❌ Triggers and functions

**Solution**: Use **Table Design View** (GUI method) - much more reliable!

---

## Option 1: GUI Method (RECOMMENDED - No SQL Errors!)

### Step 1: Create New Database
1. Open MS Access
2. **File** → **New** → **Blank Database**
3. Name it: `training_needs_test.accdb`
4. Click **Create**

### Step 2: Create Tables Using Table Design View

#### Table 1: lines_of_business

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| lob_code | Short Text | 50 | Yes | |
| lob_name | Short Text | 255 | Yes | |
| description | Long Text | | No | |
| display_order | Number | Integer | No | |
| active | Yes/No | | No | True |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key** (key icon appears)
4. Save table as: `lines_of_business`

#### Table 2: training_locations

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| name | Short Text | 255 | Yes | |
| display_order | Number | Integer | No | |
| active | Yes/No | | No | True |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key**
4. Save table as: `training_locations`

#### Table 3: courses

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| course_id | Short Text | 50 | Yes | |
| course_name | Short Text | 255 | Yes | |
| functional_area | Short Text | 255 | Yes | |
| duration_hrs | Number | Double | No | |
| application | Short Text | 255 | No | |
| priority | Number | Integer | No | |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **course_id** field → **Primary Key**
4. Save table as: `courses`

#### Table 4: end_users

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| name | Short Text | 255 | Yes | |
| email | Short Text | 255 | No | |
| job_title | Short Text | 255 | No | |
| country | Short Text | 100 | No | |
| division | Short Text | 255 | No | |
| sub_division | Short Text | 255 | No | |
| location_name | Short Text | 255 | No | |
| training_location | Short Text | 255 | No | |
| project_role | Short Text | 255 | No | |
| organisation | Short Text | 255 | No | |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key**
4. Save table as: `end_users`

#### Table 5: end_user_lob_assignments

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| end_user_id | Number | Long Integer | Yes | |
| lob_code | Short Text | 50 | Yes | |
| is_primary | Yes/No | | No | False |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key**
4. Save table as: `end_user_lob_assignments`

#### Table 6: course_lob_assignments

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| course_id | Short Text | 50 | Yes | |
| lob_code | Short Text | 50 | Yes | |
| is_mandatory | Yes/No | | No | False |
| project_id | Short Text | 36 | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key**
4. Save table as: `course_lob_assignments`

#### Table 7: user_course_mappings

1. Click **Create** tab → **Table Design**
2. Add fields:

| Field Name | Data Type | Field Size | Required | Default Value |
|------------|-----------|------------|----------|---------------|
| id | AutoNumber | Long Integer | Yes | (auto) |
| project_id | Short Text | 36 | Yes | |
| end_user_id | Number | Long Integer | Yes | |
| course_id | Short Text | 50 | Yes | |
| assigned_by | Short Text | 50 | No | admin |
| assigned_date | Date/Time | | No | |
| notes | Long Text | | No | |
| created_at | Date/Time | | No | |
| updated_at | Date/Time | | No | |

3. Right-click **id** field → **Primary Key**
4. Save table as: `user_course_mappings`

### Step 3: Create Relationships (Optional but Recommended)

1. Click **Database Tools** tab → **Relationships**
2. Click **Show Table** → Add all 7 tables → Close
3. Drag lines to create relationships:
   - Drag `lines_of_business.lob_code` to `end_user_lob_assignments.lob_code`
   - Drag `lines_of_business.lob_code` to `course_lob_assignments.lob_code`
   - Drag `training_locations.name` to `end_users.training_location`
   - Drag `courses.course_id` to `course_lob_assignments.course_id`
   - Drag `courses.course_id` to `user_course_mappings.course_id`
   - Drag `end_users.id` to `end_user_lob_assignments.end_user_id`
   - Drag `end_users.id` to `user_course_mappings.end_user_id`
4. For each relationship, check **Enforce Referential Integrity**
5. Save relationships

### Step 4: Load Sample Data

Now use the INSERT statements from `access_database_schema_FIXED.sql`:

1. Click **Create** tab → **Query Design** → Close "Show Table" dialog
2. Click **SQL View** button (top left)
3. Copy INSERT statements from `access_database_schema_FIXED.sql`
4. Paste and run **one INSERT at a time** (or small batches)
5. Order matters - insert in this sequence:
   - lines_of_business (3 records)
   - training_locations (3 records)
   - courses (4 records)
   - course_lob_assignments (9 records)
   - end_users (4 records)
   - end_user_lob_assignments (6 records)
   - user_course_mappings (8 records)

### Step 5: Verify Data

1. Open each table (double-click table name)
2. Check record counts:
   - lines_of_business: 3 records
   - training_locations: 3 records
   - courses: 4 records
   - course_lob_assignments: 9 records
   - end_users: 4 records
   - end_user_lob_assignments: 6 records
   - user_course_mappings: 8 records

---

## Option 2: Fixed SQL Method (If you prefer SQL)

Use **`access_database_schema_FIXED.sql`** - this has simplified SQL that should work better:

### Step 1: Create Tables with SQL

1. Open MS Access → Create new database
2. **Create** tab → **Query Design** → Close "Show Table" dialog
3. Click **SQL View** button
4. Copy **one CREATE TABLE statement** from `access_database_schema_FIXED.sql`
5. Paste and click **Run (!)**
6. Repeat for all 7 tables

### Step 2: Create Indexes (Optional)

1. Copy CREATE INDEX statements from `access_database_schema_FIXED.sql`
2. Run each index statement separately
3. If you get errors, skip indexes (not critical)

### Step 3: Load Sample Data

1. Copy INSERT statements from `access_database_schema_FIXED.sql`
2. Run them one at a time or in small batches
3. Follow the correct order (parents before children)

---

## What I Fixed in the SQL

### Original (Had Syntax Errors):
```sql
CREATE TABLE courses (
    course_id TEXT(50) PRIMARY KEY,
    course_name TEXT(255) NOT NULL,  -- ❌ NOT NULL doesn't work
    functional_area TEXT(255) NOT NULL,  -- ❌ NOT NULL doesn't work
    duration_hrs DOUBLE,
    application TEXT(255),
    priority INTEGER,
    project_id TEXT(36),
    created_at DATETIME DEFAULT Now(),  -- ❌ DEFAULT doesn't work in CREATE TABLE
    updated_at DATETIME DEFAULT Now()   -- ❌ DEFAULT doesn't work in CREATE TABLE
);
```

### Fixed Version:
```sql
CREATE TABLE courses (
    course_id TEXT(50),
    course_name TEXT(255),  -- ✅ No NOT NULL in SQL
    functional_area TEXT(255),  -- ✅ No NOT NULL in SQL
    duration_hrs DOUBLE,
    application TEXT(255),
    priority INTEGER,
    project_id TEXT(36),
    created_at DATETIME,  -- ✅ No DEFAULT in SQL
    updated_at DATETIME,  -- ✅ No DEFAULT in SQL
    CONSTRAINT pk_courses PRIMARY KEY (course_id)  -- ✅ PK as constraint
);
```

Then set **Required** and **Default Value** properties in **Table Design View** (GUI).

---

## Quick Reference: MS Access Data Types

| PostgreSQL Type | MS Access Type | Notes |
|-----------------|----------------|-------|
| SERIAL / AUTOINCREMENT | AutoNumber | Auto-incrementing integer |
| VARCHAR(n) / TEXT(n) | Short Text | Max 255 characters |
| TEXT / MEMO | Long Text | Unlimited text |
| INTEGER | Number (Long Integer) | 32-bit integer |
| DOUBLE PRECISION | Number (Double) | Floating point |
| BOOLEAN | Yes/No | True/False checkbox |
| TIMESTAMP / DATETIME | Date/Time | Date and time |
| UUID / TEXT(36) | Short Text (36) | Store as text |

---

## Common SQL Errors in MS Access

### Error: "Syntax error in CREATE TABLE statement"
**Cause**: DEFAULT or NOT NULL not supported in CREATE TABLE
**Solution**: Use Table Design View or simplified SQL (see `access_database_schema_FIXED.sql`)

### Error: "Duplicate key value"
**Cause**: Trying to insert same primary key twice
**Solution**: Delete existing data first or use different IDs

### Error: "Cannot insert NULL into required field"
**Cause**: Field is required but INSERT doesn't provide value
**Solution**: Provide value in INSERT or make field optional

### Error: "Foreign key constraint violation"
**Cause**: Parent record doesn't exist
**Solution**: Insert parent table data before child table data

---

## Summary

**EASIEST METHOD**: Use GUI (Table Design View)
- No SQL syntax errors
- Visual field configuration
- Easy to set required fields and defaults
- Takes 15-20 minutes for all 7 tables

**SQL METHOD**: Use `access_database_schema_FIXED.sql`
- Simplified SQL without DEFAULT/NOT NULL
- Faster if SQL works in your Access version
- May still have compatibility issues with older Access versions

**RECOMMENDED WORKFLOW**:
1. Create tables using GUI (Table Design View) ✅
2. Create relationships using GUI (Database Tools → Relationships) ✅
3. Load sample data using SQL INSERT statements ✅
4. Verify data in each table ✅

---

Good luck! Let me know if you encounter any other errors. 🎯
