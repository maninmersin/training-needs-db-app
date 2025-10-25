# Monthly Calendar Grid Excel Export - Implementation Plan

## Overview
Add a new export format called **"Monthly Grid"** to the existing ExcelExportDialog that creates a visual monthly calendar layout in Excel with training sessions displayed in calendar cells.

## Requirements Summary
- **Format**: Monthly calendar grid (side-by-side months)
- **Details per session**: Course, Group, Location, Classroom, Time (09:00-12:00)
- **Multi-day courses**: Show each day separately (e.g., "Course A - Day 1", "Course A - Day 2")
- **Multiple sessions per day**: Stack vertically in cells with separate rows
- **Time intervals**: 1-hour granularity for display
- **Color coding**: By course or location
- **Location**: Schedule Manager export dialog

---

## Implementation Plan

### **Phase 1: Add New Export Format Option**
**File**: `src/shared/components/ExcelExportDialog.jsx`

**Changes**:
1. Add new radio button option: **"Monthly Grid (Visual calendar layout)"**
2. Add handler for `exportFormat === 'monthly-grid'`
3. Create new function: `createMonthlyGridExport(scheduleData)`

**Code Addition (around line 350)**:
```jsx
<label>
  <input
    type="radio"
    value="monthly-grid"
    checked={exportFormat === 'monthly-grid'}
    onChange={(e) => setExportFormat(e.target.value)}
  />
  Monthly Grid (Visual calendar layout)
</label>
```

---

### **Phase 2: Core Monthly Grid Generation Logic**
**File**: `src/shared/components/ExcelExportDialog.jsx`

**New Function**: `createMonthlyGridExport(scheduleData)`

**Algorithm**:
```javascript
const createMonthlyGridExport = async (scheduleData) => {
  // Step 1: Fetch all sessions from database
  const allSessions = await fetchSessionsForSchedules(scheduleData);

  // Step 2: Group sessions by month
  const sessionsByMonth = groupSessionsByMonth(allSessions);

  // Step 3: Create workbook
  const workbook = XLSX.utils.book_new();

  // Step 4: For each pair of months, create side-by-side calendars
  const months = Object.keys(sessionsByMonth).sort();

  for (let i = 0; i < months.length; i += 2) {
    const month1 = months[i];
    const month2 = months[i + 1] || null;

    // Create worksheet for this pair of months
    const worksheet = createMonthPairSheet(
      sessionsByMonth[month1],
      sessionsByMonth[month2]
    );

    const sheetName = month2
      ? `${month1} & ${month2}`
      : month1;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Step 5: Add color legend sheet
  addColorLegendSheet(workbook, allSessions);

  return workbook;
};
```

---

### **Phase 3: Session Formatting & Details**

**Helper Functions**:

#### 3.1 Format Session for Cell Display
```javascript
const formatSessionForCell = (session) => {
  const startTime = new Date(session.start_datetime).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const endTime = new Date(session.end_datetime).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Determine if multi-day course
  const dayLabel = session.total_parts > 1
    ? ` - Day ${session.course_day_sequence}`
    : '';

  // Build formatted string
  return [
    `${startTime}-${endTime}`,
    `${session.course_name}${dayLabel}`,
    `Group: ${session.group_name}`,
    `Loc: ${abbreviateLocation(session.training_location)}`,
    `CR${session.classroom_number || '?'}`
  ].join('\n');
};
```

#### 3.2 Abbreviate Location Names
```javascript
const abbreviateLocation = (location) => {
  // Shorten long location names for calendar display
  const maxLength = 20;
  if (location.length <= maxLength) return location;

  // Try to intelligently abbreviate
  const parts = location.split(' - ');
  if (parts.length > 1) {
    return parts[0].substring(0, maxLength) + '...';
  }

  return location.substring(0, maxLength) + '...';
};
```

#### 3.3 Group Sessions by Date
```javascript
const groupSessionsByDate = (sessions) => {
  const grouped = {};

  sessions.forEach(session => {
    const dateKey = new Date(session.start_datetime)
      .toISOString()
      .split('T')[0]; // YYYY-MM-DD

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    grouped[dateKey].push(session);
  });

  // Sort sessions within each day by start time
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) =>
      new Date(a.start_datetime) - new Date(b.start_datetime)
    );
  });

  return grouped;
};
```

#### 3.4 Group Sessions by Month
```javascript
const groupSessionsByMonth = (sessions) => {
  const grouped = {};

  sessions.forEach(session => {
    const date = new Date(session.start_datetime);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }

    grouped[monthKey].push(session);
  });

  return grouped;
};
```

---

### **Phase 4: Excel Calendar Grid Generation**

#### 4.1 Create Month Pair Sheet
```javascript
const createMonthPairSheet = (month1Sessions, month2Sessions) => {
  const worksheet = {};

  // Create first month calendar (columns A-H)
  if (month1Sessions && month1Sessions.length > 0) {
    const date1 = new Date(month1Sessions[0].start_datetime);
    createMonthCalendar(worksheet, date1, month1Sessions, 0); // Start at column 0 (A)
  }

  // Create second month calendar (columns J-Q) - leave column I blank for spacing
  if (month2Sessions && month2Sessions.length > 0) {
    const date2 = new Date(month2Sessions[0].start_datetime);
    createMonthCalendar(worksheet, date2, month2Sessions, 9); // Start at column 9 (J)
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, // Month 1
    { wch: 2 },  // Spacer
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }  // Month 2
  ];

  return worksheet;
};
```

#### 4.2 Create Single Month Calendar
```javascript
const createMonthCalendar = (worksheet, date, sessions, startCol) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Get first and last day of month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Group sessions by date for quick lookup
  const sessionsByDate = groupSessionsByDate(sessions);

  // Row 0: Month/Year header (merged across 7 columns)
  const monthName = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const headerCell = XLSX.utils.encode_cell({ r: 0, c: startCol });
  worksheet[headerCell] = {
    v: monthName,
    t: 's',
    s: {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: '4472C4' } }
    }
  };

  // Merge header across 7 columns
  if (!worksheet['!merges']) worksheet['!merges'] = [];
  worksheet['!merges'].push({
    s: { r: 0, c: startCol },
    e: { r: 0, c: startCol + 6 }
  });

  // Row 1: Day names (Sun, Mon, Tue, etc.)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach((day, index) => {
    const cell = XLSX.utils.encode_cell({ r: 1, c: startCol + index });
    worksheet[cell] = {
      v: day,
      t: 's',
      s: {
        font: { bold: true },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: 'D9D9D9' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } }
        }
      }
    };
  });

  // Rows 2-7: Calendar grid (up to 6 weeks)
  let currentDay = 1;
  let currentRow = 2;

  for (let week = 0; week < 6; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: startCol + dayOfWeek });

      // Check if we should place a day number here
      if ((week === 0 && dayOfWeek < startDayOfWeek) || currentDay > daysInMonth) {
        // Empty cell (before month starts or after month ends)
        worksheet[cellRef] = {
          v: '',
          t: 's',
          s: {
            fill: { fgColor: { rgb: 'F2F2F2' } },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          }
        };
      } else {
        // Valid day in the month
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const daySessions = sessionsByDate[dateKey] || [];

        // Format cell content
        let cellValue = `${currentDay}\n`; // Day number at top

        if (daySessions.length > 0) {
          // Add formatted sessions
          cellValue += daySessions.map(s => formatSessionForCell(s)).join('\n---\n');
        }

        // Get course color for first session (for background)
        const bgColor = daySessions.length > 0
          ? getCourseColor(daySessions[0].course_name)
          : 'FFFFFF';

        worksheet[cellRef] = {
          v: cellValue,
          t: 's',
          s: {
            alignment: {
              wrapText: true,
              vertical: 'top',
              horizontal: 'left'
            },
            fill: { fgColor: { rgb: bgColor } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } }
            },
            font: { sz: 9 }
          }
        };

        currentDay++;
      }
    }

    currentRow++;

    // Stop if we've placed all days
    if (currentDay > daysInMonth) break;
  }

  // Set row heights (taller for days with sessions)
  if (!worksheet['!rows']) worksheet['!rows'] = [];
  for (let i = 2; i < currentRow; i++) {
    worksheet['!rows'][i] = { hpt: 80 }; // 80 pixels tall
  }
};
```

---

### **Phase 5: Color Coding System**

#### 5.1 Color Palette
```javascript
const COLOR_PALETTE = [
  'FFE5B4', // Peach
  'ADD8E6', // Light Blue
  'FFB6C1', // Light Pink
  'E0BBE4', // Lavender
  'B4E7CE', // Mint
  'FFDAB9', // Peach Puff
  'F0E68C', // Khaki
  'DDA0DD', // Plum
  '98D8C8', // Seafoam
  'F7DC6F', // Yellow
  'AED6F1', // Sky Blue
  'FAD7A0'  // Apricot
];
```

#### 5.2 Get Course Color
```javascript
const getCourseColor = (courseName) => {
  // Simple hash function to consistently assign colors to courses
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
};
```

#### 5.3 Add Color Legend Sheet
```javascript
const addColorLegendSheet = (workbook, sessions) => {
  // Get unique courses
  const uniqueCourses = [...new Set(sessions.map(s => s.course_name))];

  // Create legend data
  const legendData = uniqueCourses.map(courseName => ({
    'Course Name': courseName,
    'Color': getCourseColor(courseName),
    'Total Sessions': sessions.filter(s => s.course_name === courseName).length
  }));

  const worksheet = XLSX.utils.json_to_sheet(legendData);

  // Apply color styling to Color column
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let row = 1; row <= range.e.r; row++) {
    const colorCell = XLSX.utils.encode_cell({ r: row, c: 1 }); // Color column
    if (worksheet[colorCell]) {
      const color = worksheet[colorCell].v;
      worksheet[colorCell].s = {
        fill: { fgColor: { rgb: color } },
        alignment: { horizontal: 'center' }
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Color Legend');
};
```

---

### **Phase 6: Fetch Sessions from Database**

```javascript
const fetchSessionsForSchedules = async (scheduleData) => {
  const allSessions = [];

  for (const schedule of scheduleData) {
    const { data: sessions, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('schedule_id', schedule.id)
      .order('start_datetime');

    if (error) {
      console.error('Error fetching sessions for schedule:', schedule.id, error);
      continue;
    }

    allSessions.push(...(sessions || []));
  }

  return allSessions;
};
```

---

### **Phase 7: Integration into ExcelExportDialog**

**Modify `exportSchedules()` function** (around line 38):

```javascript
} else if (exportFormat === 'calendar') {
  workbook = createCalendarExport(scheduleData);
} else if (exportFormat === 'monthly-grid') {
  workbook = await createMonthlyGridExport(scheduleData); // NEW
}
```

---

## Edge Cases & Handling

### 1. Sessions Spanning Midnight
```javascript
// Split into two entries if session crosses midnight
const splitMidnightSessions = (session) => {
  const start = new Date(session.start_datetime);
  const end = new Date(session.end_datetime);

  if (start.getDate() !== end.getDate()) {
    // Session crosses midnight - create two entries
    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);

    return [
      { ...session, end_datetime: midnight.toISOString() },
      { ...session, start_datetime: midnight.toISOString() }
    ];
  }

  return [session];
};
```

### 2. Too Many Sessions Per Day (>5)
```javascript
const formatSessionsForDay = (sessions) => {
  const maxVisible = 5;

  if (sessions.length <= maxVisible) {
    return sessions.map(s => formatSessionForCell(s)).join('\n---\n');
  }

  // Show first 4, then "...and X more"
  const visible = sessions.slice(0, 4).map(s => formatSessionForCell(s)).join('\n---\n');
  const remaining = sessions.length - 4;
  return `${visible}\n---\n...and ${remaining} more`;
};
```

### 3. Empty Months
```javascript
// Show placeholder text for months with no sessions
if (!sessions || sessions.length === 0) {
  const placeholderCell = XLSX.utils.encode_cell({ r: 4, c: startCol + 3 });
  worksheet[placeholderCell] = {
    v: 'No sessions scheduled',
    s: {
      font: { italic: true, color: { rgb: '999999' } },
      alignment: { horizontal: 'center' }
    }
  };
}
```

---

## Testing Checklist

- [ ] Single month schedule exports correctly
- [ ] Multi-month schedule shows side-by-side calendars
- [ ] Multi-day courses show "Day 1", "Day 2", etc.
- [ ] Multiple sessions per day stack vertically
- [ ] Color coding is consistent per course
- [ ] Time format is correct (09:00-12:00)
- [ ] Location abbreviation works for long names
- [ ] Sessions at midnight are handled correctly
- [ ] Days with 10+ sessions show truncated list
- [ ] Empty months show placeholder text
- [ ] Color legend sheet is created
- [ ] Excel file opens without errors
- [ ] Cells have proper borders and formatting
- [ ] Text wraps correctly in cells
- [ ] Row heights adjust for content

---

## Implementation Estimate
- **Phase 1**: Add export option - 15 minutes
- **Phase 2**: Core grid generation - 2 hours
- **Phase 3**: Session formatting - 1.5 hours
- **Phase 4**: Excel calendar grid - 2.5 hours
- **Phase 5**: Color coding - 1 hour
- **Phase 6**: Database integration - 30 minutes
- **Phase 7**: Testing & refinement - 1.5 hours
- **Total**: **8-10 hours**

---

## Example Output

### Excel Sheet Name: "2025-01 & 2025-02"

#### January 2025 (Left Side)
```
┌──────────────────────────────────────────────────────┐
│              January 2025                             │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│  Sun   │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│        │        │        │   1    │   2    │   3    │   4    │
│        │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│   5    │   6    │   7    │   8    │   9    │  10    │  11    │
│        │        │09:00-  │09:00-  │        │        │        │
│        │        │12:00   │12:00   │        │        │        │
│        │        │PPM     │PPM     │        │        │        │
│        │        │Day 1   │Day 2   │        │        │        │
│        │        │Group:  │Group:  │        │        │        │
│        │        │Loc-CR1 │Loc-CR1 │        │        │        │
│        │        │Loc:    │Loc:    │        │        │        │
│        │        │Alex... │Alex... │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
...
```

#### February 2025 (Right Side)
```
┌──────────────────────────────────────────────────────┐
│             February 2025                             │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│  Sun   │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
...
```

---

## Files Modified/Created

### Modified:
1. **`src/shared/components/ExcelExportDialog.jsx`**
   - Add "Monthly Grid" radio option (line ~350)
   - Add `createMonthlyGridExport()` function
   - Add all helper functions listed above
   - Update `exportSchedules()` to handle new format

### Created (Optional):
2. **`src/core/utils/monthlyCalendarExport.js`**
   - Extract calendar generation logic for code organization
   - Export helper functions if ExcelExportDialog becomes too large

---

## Future Enhancements (Backlog)

1. **Weekly Grid View** - Alternative to monthly, showing week-by-week
2. **PDF Export** - Generate PDF with same calendar layout
3. **Gantt Chart View** - For multi-day courses visualization
4. **Filtering Options** - Export only specific locations or courses
5. **Excel Tables** - Convert to Excel Table format for filtering
6. **Print Optimization** - Page breaks and scaling for printing
7. **Attendance Tracking** - Add attendance checkboxes in calendar
8. **Custom Color Selection** - Allow users to choose course colors
9. **Location-Specific Sheets** - Separate sheet per training location
10. **Email Integration** - Direct email of calendar to stakeholders

---

## References

- **SheetJS (xlsx) Documentation**: https://docs.sheetjs.com/
- **Excel Cell Styling**: https://docs.sheetjs.com/docs/csf/cell#cell-styles
- **FullCalendar (current UI)**: https://fullcalendar.io/
- **Current Export Dialog**: `src/shared/components/ExcelExportDialog.jsx`

---

**Document Version**: 1.0
**Created**: 2025-01-25
**Last Updated**: 2025-01-25
**Status**: Planning Phase - Not Yet Implemented
