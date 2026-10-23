// The rules behind `npm run lint:styles`: they keep the app on the design tokens.
//  1. No hard-coded colours (hex, rgb, hsl) in components or stylesheets. Use a token (`text-primary`,
//     `var(--border)`). Files whose colours ARE the data (the course colour palette) or that override a
//     third-party library are listed in COLOUR_ALLOWED.
//  2. No `style={{ ... }}` on a component unless the value is computed (a width from a percentage, a position
//     from the mouse, a colour from data). Existing ones are listed in INLINE_STYLE_BASELINE; a file may not
//     gain more than its baseline.

export const COLOUR_ALLOWED = [
  'src/styles/app.css', // the tokens themselves
  'src/core/utils/colorUtils.js', // the course colour palette
  'src/core/utils/consoleUtils.js', // coloured console messages
  'src/modules/training/components/calendar/calendarTheme.css', // overrides FullCalendar
  'src/modules/training/components/calendar/EnhancedScheduleCalendar.css', // event surfaces carry their own colours; high-contrast mode
  'src/shared/components/PivotReport.css', // overrides react-pivottable
  'src/modules/training/components/schedule-manager/AddCourseToScheduleModal.jsx', // default session colour (data)
  'src/modules/training/components/schedule-manager/ScheduleEditor.jsx', // default colour of the colour picker (data)
  'src/modules/training/components/schedule-manager/SessionEditModal.jsx', // default session colour (data)
  'src/modules/training/components/calendar/ScheduleCalendar.jsx' // drag shadow set on the library's element
];

// How many computed inline styles each file may have
export const INLINE_STYLE_BASELINE = {
  'src/core/components/shell/AppShell.jsx': 1,
  'src/modules/training/components/assignments/AssignmentStatsModal.jsx': 2,
  'src/modules/training/components/assignments/DragDropAssignmentPanel.jsx': 1,
  'src/modules/training/components/assignments/UserContextMenu.jsx': 1,
  'src/modules/training/components/attendance/AttendanceReports.jsx': 2,
  'src/modules/training/components/attendance/AttendanceTracker.jsx': 2,
  'src/modules/training/components/attendance/ComplianceMetricCard.jsx': 1,
  'src/modules/training/components/schedule-manager/ScheduleEditor.jsx': 1,
  'src/modules/training/components/schedule-manager/SessionEditModal.jsx': 1,
  'src/shared/components/ImportExportTrainingData.jsx': 1
};

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const INLINE_STYLE = /style=\{\{/g;

/** Problems in one file. `path` uses forward slashes and starts with `src/`; `text` is its content. */
export function checkFile(path, text) {
  const problems = [];
  const isCss = path.endsWith('.css');
  const isCode = path.endsWith('.jsx') || path.endsWith('.js');
  if (path.includes('/__tests__/') || path.endsWith('.test.js') || path.endsWith('.test.jsx')) return problems;
  if (path === 'src/components/UiKit.jsx') return problems; // the dev-only gallery

  if ((isCss || isCode) && !COLOUR_ALLOWED.includes(path)) {
    text.split('\n').forEach((line, index) => {
      // Ignore comments in CSS and JS
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
      if (COLOUR.test(code)) problems.push({ path, line: index + 1, message: `hard-coded colour: ${line.trim().slice(0, 80)}` });
    });
  }

  if (path.endsWith('.jsx')) {
    const count = (text.match(INLINE_STYLE) || []).length;
    const allowed = INLINE_STYLE_BASELINE[path] ?? 0;
    if (count > allowed) {
      problems.push({ path, line: 1, message: `${count} inline style(s), ${allowed} allowed. Use Tailwind classes, or add the file to INLINE_STYLE_BASELINE if the value is computed.` });
    }
  }
  return problems;
}
