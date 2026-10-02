# Timezone Fix - Detailed Explanation

## Problem Statement

When creating training schedules with times 9:30-12:30 and 13:30-16:30, the saved sessions showed times shifted by 3 hours (12:30-15:30). This occurred for users in GMT+0300 timezone (3 hours ahead of UTC).

## Root Cause

The issue was in how JavaScript `Date` objects were created from date strings:

```javascript
// PROBLEMATIC CODE:
let currentDate = new Date("2025-12-21");  // ❌ WRONG!
```

### Why This Fails:

When you pass a string like `"2025-12-21"` to `new Date()`, JavaScript interprets it as **UTC midnight (00:00:00 UTC)**.

For a user in GMT+0300 timezone:
- `new Date("2025-12-21")` creates: **2025-12-21 00:00:00 UTC**
- In local time, this becomes: **2025-12-21 03:00:00 GMT+0300**

Then when you call:
```javascript
currentDate.setHours(9, 30, 0, 0);  // Set to 9:30 local time
```

The Date object **already started at 03:00**, so there's confusion between UTC and local time.

When this Date is later converted for database storage, the timezone conversion happens again, causing the 3-hour shift.

## The Fix

Created a new utility function `createLocalDateFromString()` in `dateTimeUtils.js`:

```javascript
export const createLocalDateFromString = (dateString) => {
  // Parse date components
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  // Create Date in LOCAL timezone at midnight (00:00 local time)
  const localDate = new Date(year, month, day, 0, 0, 0, 0);

  return localDate;
};
```

### Why This Works:

Using the `new Date(year, month, day, hours, minutes, seconds, ms)` constructor creates a Date object in the **local timezone**, not UTC.

For a user in GMT+0300 timezone:
- `createLocalDateFromString("2025-12-21")` creates: **2025-12-21 00:00:00 GMT+0300**
- This is correctly interpreted as midnight in the user's local timezone

Then when you call:
```javascript
currentDate.setHours(9, 30, 0, 0);  // Set to 9:30 local time
```

The Date is now: **2025-12-21 09:30:00 GMT+0300** ✅ Correct!

## Files Updated

1. **src/core/utils/dateTimeUtils.js**
   - Added `createLocalDateFromString()` function
   - Added detailed comments explaining the timezone issue

2. **src/modules/training/components/tsc-wizard/TSCProcessDataStage.jsx**
   - Changed: `new Date(criteria.start_date)` → `createLocalDateFromString(criteria.start_date)`
   - Added import for new utility function

3. **src/modules/training/components/tsc-wizard/TSCWizard.jsx**
   - Changed: `new Date(currentCriteria.start_date)` → `createLocalDateFromString(currentCriteria.start_date)`
   - Added import for new utility function

4. **src/modules/training/components/tsc-wizard/TrainingCalculations.jsx**
   - Changed: `new Date(criteria.start_date)` → `createLocalDateFromString(criteria.start_date)`
   - Added import for new utility function

## Testing Instructions

1. Start the development server
2. Go to Training Schedule Creator (TSC Wizard)
3. Create a new schedule with:
   - Start Date: 2025-12-21
   - AM Time: 9:30 - 12:30
   - PM Time: 13:30 - 16:30
4. Save the schedule
5. Verify in Schedule Manager that times are:
   - AM: 9:30 - 12:30 ✅ (not 12:30 - 15:30)
   - PM: 13:30 - 16:30 ✅ (not 16:30 - 19:30)

## Key Takeaways

### ❌ DON'T:
```javascript
new Date("2025-12-21")  // Interprets as UTC midnight
```

### ✅ DO:
```javascript
createLocalDateFromString("2025-12-21")  // Creates at local midnight
```

Or use the constructor directly:
```javascript
new Date(2025, 11, 21, 0, 0, 0, 0)  // December 21, 2025 at local midnight
// Note: Month is 0-indexed, so 11 = December
```

## Additional Notes

The existing `toLocalDateTime()` and `fromLocalDateTime()` functions in `dateTimeUtils.js` were already correct - they preserve local time during conversion. The issue was that Date objects were being created in UTC in the first place, so by the time they reached these functions, the timezone shift had already occurred.

This fix ensures Date objects are created in the correct timezone from the very beginning of the scheduling process.
