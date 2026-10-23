/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../AppShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { useProject } from '@core/contexts/ProjectContext';
import { getBreadcrumbTrail, getNavSections } from '../navigation';

jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => {
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { auth_roles: { name: 'admin' } } }) };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'stuart@example.com' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => query
    }
  };
});

// Hide two known, harmless messages so real problems stay visible: React Router's v7 future-flag notices,
// and "not wrapped in act" for the user lookup that resolves after the first render.
beforeAll(() => {
  const originalWarn = console.warn;
  const originalError = console.error;
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    if (String(args[0]).includes('React Router Future Flag')) return;
    originalWarn(...args);
  });
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    originalError(...args);
  });
});

const project = (over = {}) => ({ id: 'p1', title: 'ACME Corp Training Test', training_data_source: 'app', ...over });

const setup = ({ path = '/courses', current = project(), projects = [project(), project({ id: 'p2', title: 'Second project' })], onLogout = jest.fn() } = {}) => {
  useProject.mockReturnValue({ currentProject: current, projects, switchProject: jest.fn(), isLoading: false });
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <AppShell onLogout={onLogout}><p>Page content</p></AppShell>
      </MemoryRouter>
    </ThemeProvider>
  );
  return { onLogout };
};

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
});

describe('navigation data', () => {
  const labels = (sections) => sections.flatMap((s) => s.items.map((i) => i.label));

  test('an MS Access project gets the import link, an in-app project gets the setup screens', () => {
    const access = labels(getNavSections({ usesAccessData: true }));
    const app = labels(getNavSections({ usesAccessData: false }));
    expect(access).toContain('Import/Export Training Data (MS Access)');
    expect(access).not.toContain('End Users');
    expect(app).toEqual(expect.arrayContaining(['Reference Data', 'End Users', 'Courses', 'Role-Course Mappings', 'Pivot Tables']));
    expect(app).not.toContain('Import/Export Training Data (MS Access)');
    expect(access).toEqual(expect.arrayContaining(['Trainers', 'Schedule Creator', 'User Assignments', 'Attendance Tracker', 'Projects']));
  });

  test('breadcrumbs name the module, section and page', () => {
    const sections = getNavSections({ usesAccessData: false });
    expect(getBreadcrumbTrail('/dynamic-users', sections)).toEqual(['TNA', 'Setup (in-app data)', 'End Users']);
    expect(getBreadcrumbTrail('/schedule-manager', sections)).toEqual(['TNA', 'Schedule Management', 'Schedule Manager']);
    expect(getBreadcrumbTrail('/projects', sections)).toEqual(['Administration', 'Projects']);
    expect(getBreadcrumbTrail('/somewhere-else', sections)).toEqual(['TNA']);
  });
});

describe('AppShell', () => {
  test('shows the sidebar links, current project, breadcrumb and the page', async () => {
    setup({ path: '/dynamic-users' });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'End Users' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Schedule Manager' })).toHaveAttribute('href', '/schedule-manager?restart=true');
    expect(screen.getByRole('button', { name: /Project: ACME Corp Training Test/ })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('End Users')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(await screen.findByText('stuart@example.com')).toBeInTheDocument();
  });

  test('an MS Access project shows only the MS Access setup link', () => {
    setup({ current: project({ training_data_source: 'access' }) });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Import/Export Training Data (MS Access)' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'End Users' })).not.toBeInTheDocument();
  });

  test('collapsing keeps every link reachable by name, remembers the choice and sets the body class', async () => {
    const user = userEvent.setup();
    setup();
    expect(document.body).toHaveClass('sidebar-open');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(document.body).toHaveClass('sidebar-collapsed');
    expect(localStorage.getItem('sidebarOpen')).toBe('false');
    expect(screen.getByRole('link', { name: 'Courses' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(document.body).toHaveClass('sidebar-open');
  });

  test('a saved collapsed choice is restored', () => {
    localStorage.setItem('sidebarOpen', 'false');
    setup();
    expect(document.body).toHaveClass('sidebar-collapsed');
  });

  test('the project menu lists projects and offers Manage projects', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Change project/ }));
    expect(await screen.findByRole('menuitem', { name: 'Second project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manage projects' })).toBeInTheDocument();
  });

  test('Logout calls the handler', async () => {
    const user = userEvent.setup();
    const { onLogout } = setup();
    await user.click(await screen.findByRole('button', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalled();
  });

  test('the login page gets no sidebar', () => {
    setup({ path: '/login' });
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });
});
