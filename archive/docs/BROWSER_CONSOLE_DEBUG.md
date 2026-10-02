# Browser Console Debugging Guide

## Problem
Auto-assignment created 740 records but calendar doesn't show assigned users.

## Debug Steps in Browser Console

### Step 1: Open Browser Developer Tools
1. Press **F12** to open Developer Tools
2. Click on the **Console** tab
3. Clear the console (trash icon or Ctrl+L)

### Step 2: Navigate to Assignment View
1. Go to: http://localhost:5173/drag-drop-assignments
2. Wait for the page to fully load

### Step 3: Check Console Output

Look for these key messages in order:

#### A. Assignment Loading
```
📊 CALENDAR: Assignments prop changed - length: 740
```
✅ **If you see this**: Calendar received the 740 assignments
❌ **If you see length: 0**: Assignments aren't being passed to calendar

#### B. Session Rendering
```
🎨 RENDERING event "Course Name - Group X (Part Y)"
```
For each event, you should see assignment filtering happening.

#### C. Assignment Matching
Look for messages about assigned users. The calendar should show:
```
assignedUsers.length > 0
```

### Step 4: Manual Console Commands

Copy and paste these commands into the browser console (one at a time):

#### Check if assignments data exists:
```javascript
// This will show the assignments in memory
console.log('Assignments check:',
  document.querySelector('[class*="drag-drop-assignment-panel"]') ?
  'Panel found' : 'Panel not found'
);
```

#### Check React component state (if React DevTools installed):
1. Install React Developer Tools extension
2. Click React DevTools tab
3. Find `DragDropAssignmentPanel` component
4. Check `assignments` state - should have 740 items

### Step 5: Check Database Directly

If console shows assignments aren't loading, run this in Supabase:

```sql
-- Verify assignments exist
SELECT COUNT(*) FROM user_assignments;

-- Check schedule_id matches
SELECT DISTINCT schedule_id FROM user_assignments;
```

## Common Issues and Fixes

### Issue 1: Console shows "length: 0"
**Problem**: Assignments aren't being fetched from database
**Check**:
1. Run SQL query: `SELECT COUNT(*) FROM user_assignments;`
2. Verify schedule_id matches current schedule
3. Check RLS policies aren't blocking access

**Fix**:
```sql
-- Check your user has access to the schedule
SELECT * FROM project_users
WHERE user_id = auth.uid()
AND project_id IN (SELECT project_id FROM training_schedules);
```

### Issue 2: Console shows "length: 740" but events show 0/X
**Problem**: Session identifier mismatch
**Solution**: Run `debug_session_matching.sql` to check identifiers

### Issue 3: Browser console has errors
**Look for**:
- Red error messages
- "Failed to fetch" messages
- "RLS policy" violations

**Copy the error** and we can fix it

## Expected Console Output (GOOD)

When working correctly, you should see:
```
📊 CALENDAR: Assignments prop changed - length: 740
🎨 RENDERING event "Course A - Alexandria | Finance - Group 1 (Part 1)"
  assignedUsers.length: 6
  capacityInfo: {current: 6, max: 6, isAtCapacity: true}
🎨 RENDERING event "Course A - Alexandria | Finance - Group 1 (Part 2)"
  assignedUsers.length: 6
  capacityInfo: {current: 6, max: 6, isAtCapacity: true}
...
```

## What to Report Back

Please copy and paste:
1. **Any red error messages**
2. **The line that says**: "📊 CALENDAR: Assignments prop changed - length: X"
3. **A few lines showing**: "🎨 RENDERING event" messages
4. **Any messages about**: "assignedUsers.length"

This will help identify exactly where the issue is!
