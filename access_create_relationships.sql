-- =====================================================
-- MS ACCESS - CREATE RELATIONSHIPS (FOREIGN KEYS)
-- =====================================================
-- Purpose: Create foreign key relationships between tables
-- Note: MS Access relationship creation via SQL is limited
-- RECOMMENDED: Use GUI method (Database Tools → Relationships)
-- =====================================================

-- =====================================================
-- METHOD 1: GUI METHOD (RECOMMENDED - EASIEST!)
-- =====================================================
--
-- Step 1: Open Relationships Window
--   - Click "Database Tools" tab
--   - Click "Relationships" button
--   - Click "Show Table" button
--   - Add ALL 7 tables to the window
--   - Click "Close"
--
-- Step 2: Arrange Tables Visually
--   - Drag tables to organize them nicely
--   - Suggested layout:
--     Top row: lines_of_business, training_locations
--     Middle row: courses, end_users
--     Bottom row: course_lob_assignments, end_user_lob_assignments, user_course_mappings
--
-- Step 3: Create Each Relationship (Drag and Drop)
--   Drag the field from parent table to child table:
--
--   RELATIONSHIP 1: lines_of_business → end_user_lob_assignments
--     - Drag: lines_of_business.lob_code
--     - To: end_user_lob_assignments.lob_code
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Leave unchecked: ☐ Cascade Delete Related Records (optional)
--     - Click: Create
--
--   RELATIONSHIP 2: lines_of_business → course_lob_assignments
--     - Drag: lines_of_business.lob_code
--     - To: course_lob_assignments.lob_code
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Click: Create
--
--   RELATIONSHIP 3: training_locations → end_users
--     - Drag: training_locations.name
--     - To: end_users.training_location
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Click: Create
--
--   RELATIONSHIP 4: courses → course_lob_assignments
--     - Drag: courses.course_id
--     - To: course_lob_assignments.course_id
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Click: Create
--
--   RELATIONSHIP 5: courses → user_course_mappings
--     - Drag: courses.course_id
--     - To: user_course_mappings.course_id
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Click: Create
--
--   RELATIONSHIP 6: end_users → end_user_lob_assignments
--     - Drag: end_users.id
--     - To: end_user_lob_assignments.end_user_id
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Check: ☑ Cascade Delete Related Records (RECOMMENDED - deletes LoB assignments when user deleted)
--     - Click: Create
--
--   RELATIONSHIP 7: end_users → user_course_mappings
--     - Drag: end_users.id
--     - To: user_course_mappings.end_user_id
--     - Check: ☑ Enforce Referential Integrity
--     - Check: ☑ Cascade Update Related Fields
--     - Check: ☑ Cascade Delete Related Records (RECOMMENDED - deletes course assignments when user deleted)
--     - Click: Create
--
-- Step 4: Save Relationships
--   - Click: Close (or Save icon)
--   - Click: Yes to save layout
--
-- Step 5: Verify Relationships
--   - Open "Relationships" window again
--   - You should see lines connecting the tables
--   - One-to-Many relationships will show "1" on parent side and "∞" on child side
--

-- =====================================================
-- METHOD 2: SQL ALTER TABLE (May not work in all Access versions)
-- =====================================================
-- NOTE: MS Access has limited ALTER TABLE support
-- These statements may fail depending on your Access version
-- If they fail, use GUI method above instead
-- =====================================================

-- Relationship 1: lines_of_business → end_user_lob_assignments
ALTER TABLE end_user_lob_assignments
ADD CONSTRAINT fk_user_lob_lobcode
FOREIGN KEY (lob_code) REFERENCES lines_of_business(lob_code);

-- Relationship 2: lines_of_business → course_lob_assignments
ALTER TABLE course_lob_assignments
ADD CONSTRAINT fk_course_lob_lobcode
FOREIGN KEY (lob_code) REFERENCES lines_of_business(lob_code);

-- Relationship 3: training_locations → end_users
-- NOTE: This references training_locations.name which is TEXT, not a numeric ID
-- MS Access may have issues with TEXT foreign keys
ALTER TABLE end_users
ADD CONSTRAINT fk_end_users_training_location
FOREIGN KEY (training_location) REFERENCES training_locations(name);

-- Relationship 4: courses → course_lob_assignments
ALTER TABLE course_lob_assignments
ADD CONSTRAINT fk_course_lob_courseid
FOREIGN KEY (course_id) REFERENCES courses(course_id);

-- Relationship 5: courses → user_course_mappings
ALTER TABLE user_course_mappings
ADD CONSTRAINT fk_user_course_courseid
FOREIGN KEY (course_id) REFERENCES courses(course_id);

-- Relationship 6: end_users → end_user_lob_assignments
ALTER TABLE end_user_lob_assignments
ADD CONSTRAINT fk_user_lob_userid
FOREIGN KEY (end_user_id) REFERENCES end_users(id);

-- Relationship 7: end_users → user_course_mappings
ALTER TABLE user_course_mappings
ADD CONSTRAINT fk_user_course_userid
FOREIGN KEY (end_user_id) REFERENCES end_users(id);

-- =====================================================
-- RELATIONSHIP SUMMARY
-- =====================================================
--
-- Parent Table              Child Table                  Relationship Type
-- =====================================================
-- lines_of_business    →    end_user_lob_assignments     One-to-Many (LoB can have many users)
-- lines_of_business    →    course_lob_assignments       One-to-Many (LoB can have many courses)
-- training_locations   →    end_users                    One-to-Many (Location can have many users)
-- courses              →    course_lob_assignments       One-to-Many (Course can apply to many LoB)
-- courses              →    user_course_mappings         One-to-Many (Course can be assigned to many users)
-- end_users            →    end_user_lob_assignments     One-to-Many (User can work in many LoB)
-- end_users            →    user_course_mappings         One-to-Many (User can be assigned many courses)
--
-- =====================================================
-- VISUAL DIAGRAM
-- =====================================================
--
--  ┌─────────────────────┐         ┌──────────────────────┐
--  │ lines_of_business   │         │ training_locations   │
--  ├─────────────────────┤         ├──────────────────────┤
--  │ id (PK)             │         │ id (PK)              │
--  │ lob_code (UNIQUE)   │─┐       │ name (UNIQUE)        │─┐
--  │ lob_name            │ │       │ display_order        │ │
--  │ description         │ │       │ active               │ │
--  └─────────────────────┘ │       └──────────────────────┘ │
--                          │                                 │
--                          │                                 │
--  ┌─────────────────────┐ │                                 │
--  │ courses             │ │                                 │
--  ├─────────────────────┤ │                                 │
--  │ course_id (PK)      │─┤                                 │
--  │ course_name         │ │                                 │
--  │ functional_area     │ │                                 │
--  │ duration_hrs        │ │                                 │
--  └─────────────────────┘ │                                 │
--                          │                                 │
--                          │                                 │
--                          │       ┌──────────────────────┐  │
--                          │       │ end_users            │  │
--                          │       ├──────────────────────┤  │
--                          │       │ id (PK)              │─┐│
--                          │       │ name                 │ ││
--                          │       │ email                │ ││
--                          │       │ training_location (FK)│─┘
--                          │       │ job_title            │
--                          │       └──────────────────────┘
--                          │                 │
--                          │                 │
--  ┌───────────────────────┴─┐     ┌─────────┴──────────────┐
--  │ course_lob_assignments  │     │ end_user_lob_assignments│
--  ├─────────────────────────┤     ├────────────────────────┤
--  │ id (PK)                 │     │ id (PK)                │
--  │ course_id (FK)          │     │ end_user_id (FK)       │
--  │ lob_code (FK)           │     │ lob_code (FK)          │
--  │ is_mandatory            │     │ is_primary             │
--  └─────────────────────────┘     └────────────────────────┘
--            │                                │
--            │       ┌────────────────────────┘
--            │       │
--            │   ┌───┴───────────────────────┐
--            │   │ user_course_mappings      │
--            │   ├───────────────────────────┤
--            │   │ id (PK)                   │
--            └───│ course_id (FK)            │
--                │ end_user_id (FK)          │
--                │ assigned_by               │
--                │ assigned_date             │
--                │ notes                     │
--                └───────────────────────────┘
--
-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
--
-- ERROR: "Cannot create relationship because indexes don't exist"
-- SOLUTION: Create an index on the foreign key field first
--   Example:
--   CREATE INDEX idx_temp ON end_user_lob_assignments (lob_code);
--   Then create the relationship via GUI
--
-- ERROR: "Cannot create relationship because data violates referential integrity"
-- SOLUTION: There are orphaned child records (FK values don't exist in parent)
--   1. Check for orphaned records:
--      SELECT DISTINCT lob_code FROM end_user_lob_assignments
--      WHERE lob_code NOT IN (SELECT lob_code FROM lines_of_business);
--   2. Delete orphaned records or fix the FK values
--   3. Then create the relationship
--
-- ERROR: ALTER TABLE foreign key syntax not supported
-- SOLUTION: Use GUI method instead (Database Tools → Relationships)
--
-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after creating relationships to verify they work

-- Test 1: Try to insert user-course mapping with invalid user_id (should fail)
-- INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
-- VALUES ('00000000-0000-0000-0000-000000000001', 9999, 'C001', 'admin');
-- Expected: Error "You cannot add or change a record because a related record is required in table 'end_users'"

-- Test 2: Try to insert user-course mapping with invalid course_id (should fail)
-- INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
-- VALUES ('00000000-0000-0000-0000-000000000001', 1, 'INVALID', 'admin');
-- Expected: Error "You cannot add or change a record because a related record is required in table 'courses'"

-- Test 3: Try to delete a user who has course assignments (behavior depends on cascade settings)
-- DELETE FROM end_users WHERE id = 1;
-- If cascade delete enabled: Should delete user AND related records in user_course_mappings
-- If cascade delete disabled: Should fail with referential integrity error

-- =====================================================
-- BENEFITS OF RELATIONSHIPS
-- =====================================================
--
-- 1. DATA INTEGRITY
--    - Cannot assign courses to non-existent users
--    - Cannot assign non-existent courses
--    - Cannot assign users to non-existent LoB
--
-- 2. CASCADE UPDATES
--    - If you change a course_id, all related assignments update automatically
--    - If you change a user's ID, all related assignments update automatically
--
-- 3. CASCADE DELETES (if enabled)
--    - If you delete a user, all their course assignments delete automatically
--    - If you delete a course, all assignments of that course delete automatically
--
-- 4. QUERY PERFORMANCE
--    - Access optimizes queries that use relationships
--    - Enforces indexes on foreign key fields
--
-- 5. FORMS AND REPORTS
--    - Access forms can use relationships to show related data
--    - Drop-down lists automatically populated from related tables
--
-- =====================================================
