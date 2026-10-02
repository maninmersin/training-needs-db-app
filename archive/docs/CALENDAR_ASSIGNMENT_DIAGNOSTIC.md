# Calendar Assignment Display Diagnostic

## Summary
Auto-assignment created 740 assignments successfully in the database, but the calendar events aren't showing the assigned users.

## Diagnosis Steps

### 1. Verify Assignments Were Created
Run this query in Supabase SQL Editor:
```sql
SELECT COUNT(*) as total_assignments FROM user_assignments;
```
**Expected Result**: 740 assignments
**Status**: ✅ CONFIRMED (user already ran this)

### 2. Check Session Identifier Format
Run this query to see session_identifier patterns:
```sql
SELECT DISTINCT
  session_identifier,
  COUNT(*) as assignment_count
FROM user_assignments
GROUP BY session_identifier
ORDER BY session_identifier
LIMIT 20;
```

### 3. Check Assignment Data Structure
```sql
SELECT
  id,
  end_user_id,
  user_name,
  course_id,
  session_identifier,
  training_location,
  functional_area,
  assignment_level,
  assignment_status
FROM user_assignments
ORDER BY created_at DESC
LIMIT 10;
```

## Likely Causes

### Cause 1: Calendar Not Refreshing
**Symptoms**:
- Assignments exist in database
- Users still showing in user pool
- Calendar events show 0/X participants

**Fix**: Try these in order:
1. ✅ Close and reopen the assignment panel
2. ✅ Navigate away from the page and back
3. ✅ Refresh the browser page (F5)

### Cause 2: Session Identifier Mismatch
**Symptoms**:
- Assignments have `session_identifier` values like: `29-session5-alexandria-finance-part1`
- Calendar events have different identifier format

**Calendar Matching Logic**:
The calendar component (EnhancedScheduleCalendar.jsx line 468-475) matches assignments using:
```javascript
if (assignment.session_identifier) {
  return assignment.session_identifier === sessionId ||
         assignment.session_identifier === session.session_identifier ||
         assignment.session_identifier === session.eventId;
}
```

**Fix**: Check if session identifiers match between assignments and calendar events

### Cause 3: Missing User Names
**Symptoms**:
- Assignments have `user_name` = NULL
- Calendar can't display user names

**Status**: ✅ CONFIRMED - user_name is NULL in assignments
**Impact**: Minor - calendar should still show user IDs, but names won't display

**Fix**: Update assignments to populate user_name from training_data:
```sql
UPDATE user_assignments ua
SET user_name = td.name
FROM training_data td
WHERE ua.end_user_id = td.user_id
  AND ua.user_name IS NULL;
```

## Quick Fix Steps

### Step 1: Refresh the Calendar
1. Navigate away from the assignments page
2. Navigate back to: http://localhost:5173/drag-drop-assignments
3. Check if calendar events now show participants

### Step 2: Force Re-fetch Assignments
If Step 1 doesn't work:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for messages starting with "📊 CALENDAR: Assignments prop changed"
4. Check the `length` value - should be 740

### Step 3: Verify Assignment Matching
Check browser console for:
- "🎨 RENDERING event" messages
- Look for `assignedUsers.length` values - should be > 0 for events with assignments

## Expected Behavior After Fix

✅ Calendar events should display participant counts like: "6/6 🔴" (at capacity)
✅ Calendar events should show list of assigned users with names/IDs
✅ User pool should be empty or reduced (users moved from pool to calendar)

## Next Steps If Not Fixed

If the calendar still doesn't show assignments after refreshing:

1. **Run the diagnostic queries** (above) to check session_identifier format
2. **Check browser console** for error messages
3. **Verify calendar is receiving assignments**:
   - Look for console message: "📊 CALENDAR: Assignments prop changed - length: 740"
4. **Check session matching**:
   - Look for "🎨 RENDERING event" messages in console
   - Each should show "assignedUsers.length" > 0 for assigned sessions
