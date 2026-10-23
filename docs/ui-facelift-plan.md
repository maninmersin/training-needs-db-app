# UI face-lift: modern, dense, corporate design with light and dark modes

## Context
The app was built about a year ago and looks dated. The user wants a complete face-lift that looks and feels
current, working in a copy of the app (free to change anything). Decisions made with the user:
- **Style: corporate and dense** - compact tables and forms that fit a lot on screen, conservative palette.
- **Light and dark modes with a toggle.**
- **No branding to follow** - a neutral modern palette and a placeholder logo mark (swappable later).
- **Do the setup and data screens first**, then the schedule and assignment screens.

What exists today (measured):
- 67 hand-written CSS files (~22,000 lines), 2,357 hard-coded colours (210 distinct), 238 inline `style={{}}`
  blocks in 42 components, icons that are a mix of emoji and two icon libraries, `alert()`/`confirm()` popups.
- A modern toolkit is installed but unused: Tailwind v4, `class-variance-authority`, `tailwind-merge`, `clsx`,
  `lucide-react`, `tw-animate-css`, and a shadcn-style token block in `src/styles.css`.
- Tailwind is **not actually switched on**: `styles.css` uses v3 directives (`@tailwind base`) under v4, and is
  only `@import`ed by three screens' CSS (Login, two import screens), so it loads late and partially.
- App shell: `ModuleSwitcher` (top bar) + `ModularSidebar` (left, per-module sidebars) + `UserHeader`
  (`src/App.jsx`, `src/core/components/`). Routes are fine and stay as they are.

## Approach

The look changes; behaviour does not. Every screen keeps its routes, data loading, rules, wording and
accessible names (the 193 unit tests and 21 backend tests act as the regression net). Screens are converted one
at a time, and an unconverted screen keeps working throughout, so the work can stop at any point.

### Phase 0 - Agree the look before any code (sign-off)
- Build clickable HTML mockups, published as a private page, of: the new app shell, the **End Users** table
  screen, an **Import** screen (upload -> preview -> result) and one edit dialog, in **light and dark**, at the
  dense setting. The user reviews and adjusts colours, density and layout; Phase 1 starts from the agreed version.

### Phase 1 - Foundation (no visible change to existing screens)
1. **Tailwind set up properly**: one entry stylesheet `src/styles/app.css` with `@import "tailwindcss"` minus
   preflight for now (theme + utilities layers only), `tw-animate-css`, and the design tokens. Remove the broken
   v3 directives from `src/styles.css`; drop the three `@import '../../styles.css'` lines.
2. **Design tokens** (CSS variables, shadcn naming so components drop in): neutral zinc/slate surfaces, one
   blue-indigo accent, status colours (success/warning/danger/info), chart colours, radius, shadows, and
   **density tokens** for the corporate look: 13px table/form text, 32px rows and inputs, compact padding, tabular
   numbers. Light and dark sets, AA contrast checked in both.
3. **Theme**: `ThemeProvider` (light / dark / follow system, saved per browser) and a toggle in the user menu.
4. **Self-hosted Inter font** (`@fontsource-variable/inter`) instead of Google Fonts, because the local stack
   runs without the cloud.
5. **Old CSS can't fight the new styles**: a small PostCSS step in `postcss.config.js` wraps every existing
   component CSS file in a low-priority `@layer legacy`, so new Tailwind classes always win and old screens look
   exactly as before. **Exception**: CSS that overrides third-party styles (FullCalendar in
   `calendar/*.css`, `react-pivottable` in `PivotReport.css`) stays unlayered until those screens are redone,
   otherwise the library's own CSS would win.
6. **Component library** in `src/components/ui/` (shadcn-style source, built on Radix primitives, `cva` and
   `tailwind-merge` - all owned code, no runtime theme lock-in): Button, IconButton, Input, Textarea, Select,
   Combobox, Checkbox, Switch, RadioGroup, Label/FormField (label, hint, error), Badge/StatusBadge, Card, Tabs,
   Dialog, AlertDialog (replaces `confirm()`), Sheet (side panel for editing), DropdownMenu, Tooltip, Toast
   (`sonner`, replaces `alert()`), Skeleton, EmptyState, PageHeader, Toolbar, StatCard, FileDrop.
   **DataTable** on `@tanstack/react-table`: sorting, column filter, search, column visibility, sticky header,
   row selection, pagination or virtual scroll for big lists (replacing `core/components/VirtualizedTable.jsx`),
   inline-edit cells. **ImportFlow** (upload -> validate/preview -> apply -> result report), shared by all import
   screens. Icons: `lucide-react` everywhere (emoji and `react-icons` phased out).
7. **UI kit page** (`/ui-kit`, development only) showing every component in both themes, for review.
8. New dependencies: `@radix-ui/react-*` (dialog, alert-dialog, dropdown-menu, select, popover, tabs, tooltip,
   checkbox, switch, radio-group, label, slot), `@tanstack/react-table`, `sonner`, `@fontsource-variable/inter`.

### Phase 2 - New app shell
- Replace the separate top module bar with one **compact left sidebar**: project switcher at the top, module
  sections (TNA, Administration, Dashboard) with grouped links and Lucide icons, collapse to icons, active state,
  user menu (theme toggle, sign out) at the bottom. A slim top bar with breadcrumbs and page actions.
- Same routes and the same TNA sidebar logic (MS Access vs in-app setup links, from `TrainingModuleSidebar.jsx`).
- Restyle the **Login** page.
- Files: `src/App.jsx`, `src/core/components/{ModularSidebar,ModuleSwitcher,UserHeader,Breadcrumb}.jsx`,
  `src/core/components/sidebars/*`, `src/modules/training/components/TrainingModuleSidebar.jsx`,
  `src/auth/components/LoginComponent.jsx`. Remove `Sidebar.css`, `ModuleSwitcher.css`, `UserHeader.css` after.

### Phase 3 - Setup and data screens (user's priority), in this order
Each uses the same page template: PageHeader (title, short description, main actions) + Toolbar (search and
filters) + DataTable + editing in a Sheet or Dialog + toasts for results + EmptyState.
1. Projects: `ProjectSelectionDashboard`, `ProjectTable`, `CreateProjectModal`, `EditProjectModal`.
2. End Users (`DynamicUserForm`), Courses (`CoursesForm`), Trainers (`TrainerManagement`).
3. Reference Data (`ReferenceDataManager`, tabs per list), Role-Course Mappings (`RoleCourseMappingsEditor`),
   Individual Course Assignments (`ImportExportUserCourseMappings`).
4. Imports and exports on the shared ImportFlow: `ImportExportEndUsers`, `ImportExportCourses`,
   `ImportExportTrainingData`, `ExportAllData`; `PivotReport` (theme the pivot table).
5. Attendance: `AttendanceTracker`, `AttendanceReports`, `AttendanceComplianceDashboard`.
6. Administration: `UserManagementDashboard`, `RolePermissionsEditor`, `AdminDashboard`.

Rule for every converted screen: Tailwind classes and `ui/` components only; delete the screen's CSS file;
no inline styles; no hard-coded colours; Lucide icons; `alert`/`confirm` replaced; behaviour, text and
`aria`/labels unchanged; checked in both themes.

### Phase 4 - Schedule Creator wizard
`TSCWizard` and its stages (the Define Criteria stage alone has 62 inline styles), as a stepper with a summary panel.

### Phase 5 - Schedule Manager and calendars
`ScheduleManager`, `ScheduleEditor`, `SessionEditModal`, `AddCourseToScheduleModal`; theme **FullCalendar**
through its CSS variables so it follows light/dark, and move the calendar overrides into the new system (then
they can join the normal layers).

### Phase 6 - User Assignments
`DragDropAssignmentPage`/`Panel` (about 3,900 lines), `AssignmentWorkspace`, `EnhancedScheduleCalendar`, the
Move dialog and the review-sheet import dialog. Restyle in place; split the panel into smaller files only where
it makes the restyle safer, with no change to the drag-and-drop or saving logic.

### Phase 7 - Clean-up
Remove the `legacy` layer step and the remaining legacy CSS (`App.css`, `index.css`, `styles.css`,
`core/styles/colors.css`), switch on Tailwind preflight, uninstall `react-icons`, and add a check
(`npm run lint:styles`) that fails on hard-coded colours or `style={{}}` in components, so the app stays consistent.

## Verification
- **Every step**: `npm test` (193 unit tests; they find elements by role, label and text, so they catch
  behaviour changes), `npm run test:local-stack`, `npm run lint` (zero errors), `npm run build`.
- **New components**: unit tests for DataTable (sorting, filtering, selection, empty state), ImportFlow,
  ThemeProvider (saved choice, follows system), Dialog/AlertDialog focus and keyboard handling.
- **Per screen**: run the app (`start-local.bat`), check the screen in light and dark on the ACME (in-app) and
  MS Access projects, at the usual laptop size and at a narrow width; confirm the old CSS file is gone and the
  style check passes. The user reviews each phase in the browser before the next starts.
- **Commits**: one per screen or component group, so any screen can be rolled back on its own.
