import {
  BookOpen, CalendarCheck, CalendarCog, CalendarPlus, Calculator, ClipboardCheck, Database,
  FolderKanban, GraduationCap, Link2, Table2, ShieldCheck, UserCog, Users, BarChart3,
  Download
} from 'lucide-react';

/**
 * The app's navigation, as data. Same routes and wording as the old per-module sidebars.
 * `usesAccessData` is true when the project's TNA data comes from the MS Access import.
 */
export function getNavSections({ usesAccessData = true } = {}) {
  const setupItems = usesAccessData
    ? [{ to: '/import-export-training-data', label: 'Import/Export Training Data (MS Access)', icon: Database }]
    : [
        { to: '/reference-data', label: 'Reference Data', icon: Database },
        { to: '/dynamic-users', label: 'End Users', icon: Users },
        { to: '/courses', label: 'Courses', icon: BookOpen },
        { to: '/edit-mappings', label: 'Role-Course Mappings', icon: Link2 },
        { to: '/export-all-data', label: 'Export All Data', icon: Download },
        { to: '/pivot-report', label: 'Pivot Tables', icon: Table2 }
      ];

  return [
    {
      id: 'setup',
      module: 'TNA',
      label: `Setup (${usesAccessData ? 'MS Access data' : 'in-app data'})`,
      items: [...setupItems, { to: '/trainers', label: 'Trainers', icon: GraduationCap }]
    },
    {
      id: 'scheduling',
      module: 'TNA',
      label: 'Schedule Management',
      items: [
        { to: '/training-sessions', label: 'Session Calculator', icon: Calculator },
        { to: '/training-scheduler?restart=true', label: 'Schedule Creator', icon: CalendarPlus },
        { to: '/schedule-manager?restart=true', label: 'Schedule Manager', icon: CalendarCog },
        { to: '/drag-drop-assignments', label: 'User Assignments', icon: CalendarCheck }
      ]
    },
    {
      id: 'attendance',
      module: 'TNA',
      label: 'Attendance Management',
      items: [
        { to: '/attendance-tracker', label: 'Attendance Tracker', icon: ClipboardCheck },
        { to: '/attendance-compliance', label: 'Reports', icon: BarChart3 }
      ]
    },
    {
      id: 'admin',
      module: 'Administration',
      label: 'Administration',
      items: [
        { to: '/projects', label: 'Projects', icon: FolderKanban },
        { to: '/user-management', label: 'User Dashboard', icon: UserCog },
        { to: '/role-permissions', label: 'Roles & Permissions', icon: ShieldCheck }
      ]
    }
  ];
}

const pathOf = (to) => to.split('?')[0];

/** Breadcrumb trail for a path: [module, section, page]. Unknown pages fall back to just the module. */
export function getBreadcrumbTrail(pathname, sections) {
  for (const section of sections) {
    const item = section.items.find((candidate) => pathname === pathOf(candidate.to) || pathname.startsWith(`${pathOf(candidate.to)}/`));
    if (item) {
      const trail = [section.module];
      if (section.label && section.module !== section.label) trail.push(section.label);
      trail.push(item.label);
      return trail;
    }
  }
  if (pathname.startsWith('/admin')) return ['Administration', 'Overview'];
  return ['TNA'];
}

/** Where the first breadcrumb ("TNA", "Administration") leads: Administration has an overview page; TNA opens its first menu item. */
export function getModuleHomePath(module, sections) {
  if (module === 'Administration') return '/admin';
  const first = sections.find((section) => section.module === module);
  return first?.items[0]?.to || null;
}
