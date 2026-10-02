# Quick Guide: Creating Relationships in MS Access

## Problem
You have created all 7 tables but they have no relationships (foreign keys) connecting them.

## Solution: Use the Relationships GUI Tool

### Step-by-Step Instructions

#### Step 1: Open Relationships Window
1. Click the **"Database Tools"** tab at the top
2. Click the **"Relationships"** button (it has a table icon with connecting lines)
3. A dialog will pop up asking which tables to add
4. Select **ALL 7 tables** (hold Ctrl and click each one):
   - ✅ lines_of_business
   - ✅ training_locations
   - ✅ courses
   - ✅ end_users
   - ✅ end_user_lob_assignments
   - ✅ course_lob_assignments
   - ✅ user_course_mappings
5. Click **"Add"**
6. Click **"Close"**

You should now see all 7 tables displayed as small boxes in the Relationships window.

---

#### Step 2: Arrange Tables (Optional but Helpful)
Drag the table boxes to organize them clearly:

**Suggested Layout:**
```
Top Row:       [lines_of_business]    [training_locations]

Middle Row:    [courses]               [end_users]

Bottom Row:    [course_lob_assignments] [end_user_lob_assignments] [user_course_mappings]
```

This makes it easier to see the relationships visually.

---

#### Step 3: Create Relationships (Drag and Drop)

Now create each relationship by **dragging** from the parent table field to the child table field:

---

### **Relationship 1: lines_of_business → end_user_lob_assignments**

**What it means**: Each LoB (Prime, Parts, Services) can have many employees

1. Find the **lines_of_business** table box
2. Click and **drag** the **lob_code** field
3. Drop it onto the **lob_code** field in **end_user_lob_assignments** table
4. A dialog will appear - **Edit Relationships**
5. Check these boxes:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
   - ☐ Cascade Delete Related Records (leave unchecked for now)
6. Click **"Create"**

You should see a line connecting the two tables with **1** on the lines_of_business side and **∞** on the end_user_lob_assignments side.

---

### **Relationship 2: lines_of_business → course_lob_assignments**

**What it means**: Each LoB can have many courses tagged to it

1. Drag **lines_of_business.lob_code**
2. Drop onto **course_lob_assignments.lob_code**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
4. Click **"Create"**

---

### **Relationship 3: training_locations → end_users**

**What it means**: Each training location can have many users assigned to it

1. Drag **training_locations.name**
2. Drop onto **end_users.training_location**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
4. Click **"Create"**

---

### **Relationship 4: courses → course_lob_assignments**

**What it means**: Each course can be tagged to multiple Lines of Business

1. Drag **courses.course_id**
2. Drop onto **course_lob_assignments.course_id**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
4. Click **"Create"**

---

### **Relationship 5: courses → user_course_mappings**

**What it means**: Each course can be assigned to many users (this is the key table for testing!)

1. Drag **courses.course_id**
2. Drop onto **user_course_mappings.course_id**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
4. Click **"Create"**

---

### **Relationship 6: end_users → end_user_lob_assignments**

**What it means**: Each user can be assigned to multiple Lines of Business

1. Drag **end_users.id**
2. Drop onto **end_user_lob_assignments.end_user_id**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
   - ☑ **Cascade Delete Related Records** ← Check this one too!
4. Click **"Create"**

**Why Cascade Delete?** If you delete a user, their LoB assignments should also be deleted.

---

### **Relationship 7: end_users → user_course_mappings**

**What it means**: Each user can have many courses assigned to them (THE PRIMARY TABLE FOR TESTING!)

1. Drag **end_users.id**
2. Drop onto **user_course_mappings.end_user_id**
3. Check:
   - ☑ **Enforce Referential Integrity**
   - ☑ **Cascade Update Related Fields**
   - ☑ **Cascade Delete Related Records** ← Check this one too!
4. Click **"Create"**

**Why Cascade Delete?** If you delete a user, their course assignments should also be deleted.

---

#### Step 4: Save the Relationships

1. Close the Relationships window (click the **X** or **Close** button)
2. Click **"Yes"** when asked to save changes

---

#### Step 5: Verify Relationships Created

1. Re-open the Relationships window (Database Tools → Relationships)
2. You should now see:
   - **7 lines** connecting the tables
   - **"1"** symbol on the parent side of each line
   - **"∞"** (infinity) symbol on the child side of each line

**Expected Visual:**
```
lines_of_business (1) ───∞ end_user_lob_assignments
lines_of_business (1) ───∞ course_lob_assignments
training_locations (1) ───∞ end_users
courses (1) ───∞ course_lob_assignments
courses (1) ───∞ user_course_mappings
end_users (1) ───∞ end_user_lob_assignments
end_users (1) ───∞ user_course_mappings
```

---

## What These Relationships Do

### **Data Integrity Protection**
Once relationships are created, Access will prevent invalid data:

❌ **Cannot do this** (will get error):
- Assign a course to a user that doesn't exist
- Assign a user to a course that doesn't exist
- Assign a user to a Line of Business that doesn't exist

✅ **Can do this**:
- Create new user and immediately assign courses to them
- Update course names and all assignments update automatically

### **Cascade Updates**
If you change a course_id from "C001" to "SAFE01", all records in `user_course_mappings` with course_id "C001" will automatically update to "SAFE01".

### **Cascade Deletes** (where enabled)
If you delete a user with id=1, all records in:
- `end_user_lob_assignments` where end_user_id=1 → **deleted automatically**
- `user_course_mappings` where end_user_id=1 → **deleted automatically**

This prevents orphaned records!

---

## Common Issues & Solutions

### Issue 1: "Cannot create relationship - indexes don't exist"
**Solution**: The foreign key field needs an index.
1. Close the Relationships window
2. Open the child table in Design View
3. Select the foreign key field (e.g., end_user_id)
4. In Field Properties at bottom, set **Indexed** to "Yes (Duplicates OK)"
5. Save the table
6. Try creating the relationship again

### Issue 2: "Relationship cannot be created - would create duplicate values"
**Solution**: The field you're trying to use as a foreign key already has relationship.
- Check if relationship already exists
- Or you might be dragging to the wrong field

### Issue 3: "Cannot create relationship - data violates referential integrity"
**Solution**: There are orphaned child records (foreign key values that don't exist in parent table).

**Example**: If `user_course_mappings` has end_user_id=999 but there's no user with id=999 in `end_users` table.

**Fix**:
1. Find orphaned records:
   ```sql
   SELECT DISTINCT end_user_id
   FROM user_course_mappings
   WHERE end_user_id NOT IN (SELECT id FROM end_users);
   ```
2. Delete orphaned records or fix the IDs
3. Then create the relationship

### Issue 4: Dragging doesn't work
**Solution**:
- Make sure you're clicking and holding on the **field name** inside the table box
- Drag to the matching **field name** in the other table
- Both fields should have compatible data types (e.g., both INTEGER or both TEXT)

---

## Test Your Relationships

After creating all relationships, test them:

### Test 1: Try to insert invalid data (should fail)
```sql
-- This should FAIL because user_id 9999 doesn't exist
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
VALUES ('00000000-0000-0000-0000-000000000001', 9999, 'C001', 'admin');
```

**Expected Result**: Error message "You cannot add or change a record because a related record is required in table 'end_users'"

### Test 2: Insert valid data (should work)
```sql
-- This should WORK because user_id=1 and course_id='C001' both exist
INSERT INTO user_course_mappings (project_id, end_user_id, course_id, assigned_by)
VALUES ('00000000-0000-0000-0000-000000000001', 1, 'C004', 'admin');
```

**Expected Result**: New record created successfully!

---

## Summary Checklist

After completing all steps, you should have:

✅ **7 tables created**
- lines_of_business
- training_locations
- courses
- end_users
- end_user_lob_assignments
- course_lob_assignments
- user_course_mappings

✅ **7 relationships created**
- lines_of_business → end_user_lob_assignments
- lines_of_business → course_lob_assignments
- training_locations → end_users
- courses → course_lob_assignments
- courses → user_course_mappings
- end_users → end_user_lob_assignments
- end_users → user_course_mappings

✅ **Sample data loaded**
- 3 Lines of Business
- 3 Training Locations
- 4 Courses
- 4 End Users
- 6 User-LoB Assignments
- 9 Course-LoB Assignments
- 8 User-Course Mappings

✅ **Referential integrity enabled**
- Cannot insert orphaned records
- Cannot delete parent records with children (unless cascade delete enabled)

---

## Next Steps

Now that your database structure is complete with relationships:

1. **Verify sample data** - Open each table and check records
2. **Run test queries** - See relationships in action
3. **Start testing individual course mapping** - Add/edit course assignments
4. **Compare to role-based approach** - Evaluate flexibility and ease of use

Your database is ready for testing! 🎉

---

## Need Help?

See also:
- **[access_create_relationships.sql](access_create_relationships.sql)** - Detailed relationship documentation
- **[ACCESS_SETUP_GUIDE.md](ACCESS_SETUP_GUIDE.md)** - Complete setup guide
- **[access_database_schema_FIXED.sql](access_database_schema_FIXED.sql)** - Table creation scripts

All files are in your project folder: `c:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_new\`
