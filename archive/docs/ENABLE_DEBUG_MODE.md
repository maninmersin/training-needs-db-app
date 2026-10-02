# Enable Debug Mode for Troubleshooting

## Quick Fix: Enable Debug Logging

### Step 1: Open Browser Console
1. Press **F12**
2. Click **Console** tab

### Step 2: Enable Debug Mode
Copy and paste this into the console:
```javascript
localStorage.setItem('debug_mode', 'true');
console.log('✅ Debug mode enabled!');
location.reload();
```

This will:
- Enable debug logging
- Refresh the page automatically
- Show all debug messages

### Step 3: Navigate to Assignment View
After the page reloads:
1. Go to http://localhost:5173/drag-drop-assignments
2. Open console again (F12)
3. You should now see detailed debug messages

### What You'll See

With debug mode enabled, you should see messages like:
```
[DEBUG] 📊 CALENDAR: Assignments prop changed - length: 740
[DEBUG] 🎨 RENDERING event "Course Name"
[DEBUG] 🔥 fetchUserAssignments CALLED with scheduleId: xxx
[DEBUG] 🔥 Setting userAssignments from database: 740
```

### Step 4: Check for Assignment Matching

Look for these specific patterns in the console:

#### Pattern 1: Assignments Loading (GOOD)
```
[DEBUG] 📊 CALENDAR: Assignments prop changed - length: 740
[DEBUG] 🔥 Setting userAssignments from database: 740
```

#### Pattern 2: Session Rendering (GOOD)
```
[DEBUG] 🎨 RENDERING event "Course 29 - Group 1 (Part 1)"
```

#### Pattern 3: Assignment Filtering (CHECK THIS)
After each "RENDERING event" message, there should be assignment matching logic.
If you see the event render but NO users assigned, that's the mismatch problem.

### Disable Debug Mode (Later)
When done troubleshooting:
```javascript
localStorage.setItem('debug_mode', 'false');
location.reload();
```

## Alternative: Add Temporary Console Logs

If debug mode doesn't show enough info, we can add temporary console.log statements to the code.

### Location 1: Check if assignments prop changes
File: `src/modules/training/components/calendar/EnhancedScheduleCalendar.jsx`
Line ~90

Add:
```javascript
console.log('🔍 ASSIGNMENTS PROP:', {
  length: assignments?.length,
  sample: assignments?.[0]
});
```

### Location 2: Check session identifier matching
File: `src/modules/training/components/calendar/EnhancedScheduleCalendar.jsx`
Line ~455 (in renderEventContent function)

Add:
```javascript
console.log('🔍 MATCHING CHECK:', {
  sessionId: sessionId,
  assignmentCount: cachedAssignments.length,
  filteredCount: assignedUsers.length,
  sampleAssignmentIdentifier: cachedAssignments[0]?.session_identifier
});
```

## Next Steps

1. **Enable debug mode** (run the localStorage command above)
2. **Reload the page**
3. **Navigate to assignments view**
4. **Copy console output** and share it

The console output will reveal exactly where the mismatch is happening!
