/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import RolePermissionsEditor from '../RolePermissionsEditor';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

describe('AdminDashboard', () => {
  test('links to Projects, User Management and Roles & Permissions', () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'System Administration' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: /User Management/ })).toHaveAttribute('href', '/user-management');
    expect(screen.getByRole('link', { name: /Roles & Permissions/ })).toHaveAttribute('href', '/role-permissions');
  });
});

// An in-memory stand-in for the three tables: writes change what later reads return, and every write is logged.
const makeDb = ({ roles = [], permissions = [], links = [], selectError = {} } = {}) => {
  const state = { roles: [...roles], permissions: [...permissions], links: [...links], log: [], nextId: 100 };
  supabase.from.mockImplementation((table) => {
    const call = { table, op: 'select', filters: [], rows: null, options: null };
    const run = () => {
      const failure = selectError[table];
      if (call.op === 'select' && failure) return { data: null, error: failure };
      state.log.push({ table, op: call.op, rows: call.rows, filters: call.filters, options: call.options });
      if (table === 'auth_roles') {
        if (call.op === 'insert') { state.roles.push({ id: `r${state.nextId++}`, ...call.rows }); return { error: null }; }
        if (call.op === 'delete') { state.roles = state.roles.filter((r) => r.id !== call.filters[0][1]); state.links = state.links.filter((l) => l.role_id !== call.filters[0][1]); return { error: null }; }
        return { data: [...state.roles].sort((a, b) => a.name.localeCompare(b.name)), error: null };
      }
      if (table === 'auth_permissions') {
        if (call.op === 'insert') { state.permissions.push({ id: state.nextId++, ...call.rows }); return { error: null }; }
        if (call.op === 'upsert') {
          call.rows.forEach((row) => { if (!state.permissions.some((p) => p.name === row.name)) state.permissions.push({ id: state.nextId++, ...row }); });
          return { error: null };
        }
        return { data: [...state.permissions].sort((a, b) => a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action)), error: null };
      }
      if (call.op === 'insert') { state.links.push({ ...call.rows }); return { error: null }; }
      if (call.op === 'delete') {
        const get = (column) => call.filters.find(([c]) => c === column)[1];
        state.links = state.links.filter((l) => !(l.role_id === get('role_id') && l.permission_id === get('permission_id')));
        return { error: null };
      }
      return { data: state.links.map((l) => ({ ...l, auth_permissions: state.permissions.find((p) => p.id === l.permission_id) })), error: null };
    };
    const query = {
      select: () => query,
      order: () => query,
      insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
      upsert: (rows, options) => { call.op = 'upsert'; call.rows = rows; call.options = options; return query; },
      delete: () => { call.op = 'delete'; return query; },
      eq: (column, value) => { call.filters.push([column, value]); return query; },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject)
    };
    return query;
  });
  return state;
};

const ROLES = [
  { id: 'r-admin', name: 'admin', description: 'Full access' },
  { id: 'r-trainer', name: 'trainer', description: 'Runs sessions' }
];
const PERMS = [
  { id: 1, name: 'users:read', resource: 'users', action: 'read', description: 'View user information' },
  { id: 2, name: 'users:create', resource: 'users', action: 'create', description: 'Create new users' },
  { id: 3, name: 'courses:read', resource: 'courses', action: 'read', description: 'View courses' }
];
const LINKS = [{ role_id: 'r-trainer', permission_id: 3 }];

const setup = async (data) => {
  const state = makeDb({ roles: ROLES, permissions: PERMS, links: LINKS, ...data });
  const user = userEvent.setup();
  render(<RolePermissionsEditor />);
  await screen.findByRole('heading', { name: 'Role & Permissions Management' });
  return { state, user };
};

const writes = (state) => state.log.filter((entry) => entry.op !== 'select');

beforeEach(() => jest.clearAllMocks());

describe('RolePermissionsEditor', () => {
  test('lists the roles with how many permissions each has', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'trainer' })).toBeInTheDocument();
    expect(screen.getByText('Runs sessions')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'trainer' }).closest('div').parentElement).getByText('1 permissions')).toBeInTheDocument();
    expect(screen.getByText('0 permissions')).toBeInTheDocument();
  });

  test('the built-in admin role cannot be deleted, the others can', async () => {
    await setup();
    expect(screen.queryByRole('button', { name: 'Delete admin' })).not.toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete trainer' })).toBeInTheDocument();
  });

  test('deleting a role asks first, names the role, and does nothing if cancelled', async () => {
    const { state, user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Delete trainer' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/delete the role "trainer"\? This will remove all its permissions and user assignments\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(writes(state)).toEqual([]);
    expect(screen.getByRole('heading', { name: 'trainer' })).toBeInTheDocument();
  });

  test('confirming deletes that role only', async () => {
    const { state, user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Delete trainer' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'trainer' })).not.toBeInTheDocument());
    expect(writes(state)).toEqual([expect.objectContaining({ table: 'auth_roles', op: 'delete', filters: [['id', 'r-trainer']] })]);
    expect(screen.getByRole('heading', { name: 'admin' })).toBeInTheDocument();
  });

  test('creating a role needs a name that is not taken, then saves it with a trimmed name', async () => {
    const { state, user } = await setup();
    await user.click(screen.getByRole('button', { name: /Create Role/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create Role' }));
    expect(within(dialog).getByText('Role name is required')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Role Name'), 'Trainer');
    await user.click(within(dialog).getByRole('button', { name: 'Create Role' }));
    expect(within(dialog).getByText('A role with that name already exists')).toBeInTheDocument();
    expect(writes(state)).toEqual([]);

    await user.clear(within(dialog).getByLabelText('Role Name'));
    await user.type(within(dialog).getByLabelText('Role Name'), '  Auditor ');
    await user.type(within(dialog).getByLabelText('Description'), 'Reads reports');
    await user.click(within(dialog).getByRole('button', { name: 'Create Role' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(state)[0].rows).toEqual({ name: 'Auditor', description: 'Reads reports' });
    expect(await screen.findByRole('heading', { name: 'Auditor' })).toBeInTheDocument();
  });

  test('creating a permission tidies the words, refuses duplicates, and saves resource:action', async () => {
    const { state, user } = await setup();
    await user.click(screen.getByRole('button', { name: /Create Permission/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Resource'), 'users');
    await user.type(within(dialog).getByLabelText('Action'), 'READ');
    await user.click(within(dialog).getByRole('button', { name: 'Create Permission' }));
    expect(within(dialog).getByText('That permission already exists')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Action'));
    await user.type(within(dialog).getByLabelText('Action'), ' Export ');
    await user.type(within(dialog).getByLabelText('Description'), 'Export users');
    await user.click(within(dialog).getByRole('button', { name: 'Create Permission' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(state)[0].rows).toEqual({ name: 'users:export', description: 'Export users', resource: 'users', action: 'export' });
  });

  test('Manage Permissions lists them by resource with the role\'s current ones ticked', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Manage permissions for trainer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Permissions for trainer')).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Courses' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Users' })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Courses: read' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Users: read' })).not.toBeChecked();
  });

  test('ticking adds the permission to the role and unticking removes it, saved as you go', async () => {
    const { state, user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Manage permissions for trainer' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Users: read' }));
    await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: 'Users: read' })).toBeChecked());
    expect(writes(state)[0]).toMatchObject({ table: 'auth_role_permissions', op: 'insert', rows: { role_id: 'r-trainer', permission_id: 1 } });

    await user.click(within(dialog).getByRole('checkbox', { name: 'Courses: read' }));
    await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: 'Courses: read' })).not.toBeChecked());
    expect(writes(state)[1]).toMatchObject({ op: 'delete', filters: [['role_id', 'r-trainer'], ['permission_id', 3]] });

    await user.click(within(dialog).getByText('Close', { selector: 'button' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByText('1 permissions').length).toBeGreaterThan(0); // trainer: users:read only
  });

  test('with no permissions yet, the default ones can be created in one go', async () => {
    const { state, user } = await setup({ permissions: [], links: [] });
    await user.click(screen.getByRole('button', { name: 'Initialize Default Permissions' }));
    await waitFor(() => expect(writes(state)).toHaveLength(1));
    expect(writes(state)[0]).toMatchObject({ table: 'auth_permissions', op: 'upsert', options: { onConflict: 'name', ignoreDuplicates: true } });
    expect(writes(state)[0].rows).toHaveLength(24);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Initialize Default Permissions' })).not.toBeInTheDocument());
  });

  test('a database without the permissions tables still opens, offering to set them up', async () => {
    await setup({ selectError: { auth_permissions: { code: '42P01', message: 'missing' }, auth_role_permissions: { code: '42P01', message: 'missing' } } });
    expect(screen.getByRole('button', { name: 'Initialize Default Permissions' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a failure to load shows a message', async () => {
    makeDb({ selectError: { auth_roles: { code: 'XX', message: 'denied' } } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<RolePermissionsEditor />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load data');
  });
});
