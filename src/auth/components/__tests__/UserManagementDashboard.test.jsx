/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagementDashboard from '../UserManagementDashboard';
import { TooltipProvider } from '@/components/ui';
import { supabase } from '@core/services/supabaseClient';
import * as adminUsers from '@core/services/adminUsersApi';
import { useCurrentUser } from '@core/components/shell/useCurrentUser';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@core/services/adminUsersApi', () => ({ createUser: jest.fn(), updateUser: jest.fn(), deleteUser: jest.fn() }));
jest.mock('@core/components/shell/useCurrentUser', () => ({ useCurrentUser: jest.fn() }));

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const ROLES = [
  { id: 'r-admin', name: 'admin', description: 'Full access' },
  { id: 'r-trainer', name: 'trainer', description: 'Runs sessions' }
];
const USERS = [
  { id: 'u-alice', email: 'alice@x.com', is_active: true, created_at: '2026-01-05T10:00:00Z' },
  { id: 'u-bob', email: 'bob@x.com', is_active: false, created_at: '2026-02-05T10:00:00Z' },
  { id: 'u-cara', email: 'cara@y.com', is_active: true, created_at: '2026-03-05T10:00:00Z' }
];
const LINKS = [
  { user_id: 'u-alice', role_id: 'r-admin' },
  { user_id: 'u-bob', role_id: 'r-trainer' },
  { user_id: 'u-cara', role_id: 'r-admin' }
];

// Stateful stand-in for the three tables; every write is logged. `fail` makes a chosen table/operation fail.
const makeDb = ({ users = USERS, links = LINKS, roles = ROLES, fail = {} } = {}) => {
  const state = { users: [...users], links: [...links], roles: [...roles], log: [] };
  supabase.from.mockImplementation((table) => {
    const call = { table, op: 'select', filters: [], rows: null, values: null };
    const run = () => {
      if (fail[`${table}.${call.op}`]) return { data: null, error: fail[`${table}.${call.op}`] };
      if (call.op !== 'select') state.log.push(call);
      const eq = (column) => call.filters.find(([kind, c]) => kind === 'eq' && c === column)?.[2];
      const within = (column) => call.filters.find(([kind, c]) => kind === 'in' && c === column)?.[2];
      if (table === 'auth_users') {
        if (call.op === 'insert') { state.users.push({ created_at: new Date().toISOString(), ...call.rows }); return { error: null }; }
        if (call.op === 'update') { state.users = state.users.map((u) => (u.id === eq('id') ? { ...u, ...call.values } : u)); return { error: null }; }
        if (call.op === 'delete') { state.users = state.users.filter((u) => u.id !== eq('id')); return { error: null }; }
        return { data: state.users.map((u) => ({ ...u, auth_user_roles: state.links.filter((l) => l.user_id === u.id).map((l) => ({ role_id: l.role_id, auth_roles: state.roles.find((r) => r.id === l.role_id) })) })), error: null };
      }
      if (table === 'auth_roles') return { data: state.roles, error: null };
      if (call.op === 'insert') { state.links.push(...call.rows); return { error: null }; }
      if (call.op === 'delete') {
        state.links = state.links.filter((l) => !(l.user_id === eq('user_id') && (!within('role_id') || within('role_id').includes(l.role_id))));
        return { error: null };
      }
      return { data: state.links.filter((l) => l.user_id === eq('user_id')).map((l) => ({ role_id: l.role_id })), error: null };
    };
    const query = {
      select: () => query,
      order: () => query,
      insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
      update: (values) => { call.op = 'update'; call.values = values; return query; },
      delete: () => { call.op = 'delete'; return query; },
      eq: (column, value) => { call.filters.push(['eq', column, value]); return query; },
      in: (column, value) => { call.filters.push(['in', column, value]); return query; },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject)
    };
    return query;
  });
  return state;
};

const setup = async (options = {}, currentUserId = 'u-alice') => {
  const state = makeDb(options);
  useCurrentUser.mockReturnValue({ user: { id: currentUserId, email: 'me@x.com' }, role: 'admin', loading: false });
  adminUsers.createUser.mockResolvedValue({ data: { user: { id: 'u-new' } }, error: null });
  adminUsers.updateUser.mockResolvedValue({ error: null });
  adminUsers.deleteUser.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<TooltipProvider><UserManagementDashboard /></TooltipProvider>);
  await screen.findByRole('heading', { name: 'User Management' });
  return { state, user };
};
const writes = (state) => state.log.map((c) => `${c.op} ${c.table}`);

beforeEach(() => jest.clearAllMocks());

describe('UserManagementDashboard', () => {
  test('lists users with status and roles', async () => {
    await setup();
    const row = screen.getByText('bob@x.com').closest('tr');
    expect(within(row).getByText('Inactive')).toBeInTheDocument();
    expect(within(row).getByText('trainer')).toBeInTheDocument();
    expect(within(screen.getByText('alice@x.com').closest('tr')).getByText('Active')).toBeInTheDocument();
  });

  test('searching by email and filtering by role narrow the list', async () => {
    const { user } = await setup();
    await user.type(screen.getByLabelText('Search by email'), '@x.com');
    expect(screen.queryByText('cara@y.com')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Filter by role' }));
    await user.click(await screen.findByRole('option', { name: 'trainer' }));
    expect(screen.queryByText('alice@x.com')).not.toBeInTheDocument();
    expect(screen.getByText('bob@x.com')).toBeInTheDocument();
  });

  test('with no users and no roles it says setup is needed, without pointing at Supabase', async () => {
    await setup({ users: [], links: [], roles: [] });
    expect(screen.getByText('Setup Required')).toBeInTheDocument();
    expect(screen.getByText(/npm run db:migrate/)).toBeInTheDocument();
    expect(screen.queryByText(/SQL Editor/)).not.toBeInTheDocument();
  });

  test('a failed load shows a message', async () => {
    makeDb({ fail: { 'auth_roles.select': { code: 'XX', message: 'denied' } } });
    useCurrentUser.mockReturnValue({ user: null });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<TooltipProvider><UserManagementDashboard /></TooltipProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load data');
  });
});

describe('creating a user', () => {
  const open = async (user) => {
    await user.click(screen.getByRole('button', { name: /Create New User/ }));
    return screen.findByRole('dialog');
  };

  test('asks for a valid email and a password of 6 or more characters', async () => {
    const { user, state } = await setup();
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Create User' }));
    expect(within(dialog).getByText('Email is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Password is required')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Email'), 'nope');
    await user.type(within(dialog).getByLabelText('Password'), '123');
    await user.click(within(dialog).getByRole('button', { name: 'Create User' }));
    expect(within(dialog).getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(within(dialog).getByText('Password must be at least 6 characters long')).toBeInTheDocument();
    expect(adminUsers.createUser).not.toHaveBeenCalled();
    expect(state.log).toEqual([]);
  });

  test('creates the login, the record and the chosen roles, and the new user appears', async () => {
    const { user, state } = await setup();
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText('Email'), 'dana@x.com');
    await user.type(within(dialog).getByLabelText('Password'), 'secret123');
    await user.click(within(dialog).getByRole('checkbox', { name: 'trainer' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create User' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminUsers.createUser).toHaveBeenCalledWith({ email: 'dana@x.com', password: 'secret123' });
    expect(writes(state)).toEqual(['insert auth_users', 'insert auth_user_roles']);
    expect(await screen.findByText('dana@x.com')).toBeInTheDocument();
  });

  test('if the record cannot be saved the login is removed again and the reason is shown', async () => {
    const { user } = await setup({ fail: { 'auth_users.insert': { message: 'record refused' } } });
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText('Email'), 'dana@x.com');
    await user.type(within(dialog).getByLabelText('Password'), 'secret123');
    await user.click(within(dialog).getByRole('button', { name: 'Create User' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Failed to create user: record refused');
    expect(adminUsers.deleteUser).toHaveBeenCalledWith('u-new');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('the password can be shown or hidden', async () => {
    const { user } = await setup();
    const dialog = await open(user);
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(within(dialog).getByRole('button', { name: 'Show password' }));
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'text');
  });
});

describe('editing a user', () => {
  const open = async (user, email) => {
    await user.click(screen.getByRole('button', { name: `Edit ${email}` }));
    return screen.findByRole('dialog');
  };

  test('shows their email and roles, and a blank password means keep the current one', async () => {
    const { user } = await setup();
    const dialog = await open(user, 'bob@x.com');
    expect(within(dialog).getByLabelText('Email')).toHaveValue('bob@x.com');
    expect(within(dialog).getByLabelText('New Password')).toHaveValue('');
    expect(within(dialog).getByText('Leave blank to keep the current password')).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'trainer' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'admin' })).not.toBeChecked();
  });

  test('changing only the roles saves only the roles and does not touch the login', async () => {
    const { user, state } = await setup();
    const dialog = await open(user, 'bob@x.com');
    await user.click(within(dialog).getByRole('checkbox', { name: 'admin' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminUsers.updateUser).not.toHaveBeenCalled();
    expect(state.log.find((c) => c.table === 'auth_user_roles' && c.op === 'insert').rows).toEqual([{ user_id: 'u-bob', role_id: 'r-admin' }]);
    await waitFor(() => expect(within(screen.getByText('bob@x.com').closest('tr')).getByText('admin')).toBeInTheDocument());
  });

  test('a new password goes to the login account', async () => {
    const { user } = await setup();
    const dialog = await open(user, 'bob@x.com');
    await user.type(within(dialog).getByLabelText('New Password'), 'brandnew1');
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    await waitFor(() => expect(adminUsers.updateUser).toHaveBeenCalledWith('u-bob', { password: 'brandnew1' }));
  });

  test('needs at least one role and a password of 6 or more if one is typed', async () => {
    const { user, state } = await setup();
    const dialog = await open(user, 'bob@x.com');
    await user.click(within(dialog).getByRole('checkbox', { name: 'trainer' }));
    await user.type(within(dialog).getByLabelText('New Password'), '123');
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    expect(within(dialog).getByText('At least one role must be assigned')).toBeInTheDocument();
    expect(within(dialog).getByText('Password must be at least 6 characters long')).toBeInTheDocument();
    expect(state.log).toEqual([]);
  });

  test('the administrator role cannot be taken from the only administrator', async () => {
    const { user, state } = await setup({ users: USERS.slice(0, 2), links: [LINKS[0], LINKS[1]] });
    const dialog = await open(user, 'alice@x.com');
    await user.click(within(dialog).getByRole('checkbox', { name: 'admin' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'trainer' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    expect(within(dialog).getByText(/only administrator, so the administrator role cannot be removed/)).toBeInTheDocument();
    expect(state.log).toEqual([]);
  });

  test('with a second administrator the role can be removed', async () => {
    const { user } = await setup({}, 'u-cara');
    const dialog = await open(user, 'alice@x.com');
    await user.click(within(dialog).getByRole('checkbox', { name: 'admin' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'trainer' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('a failure to save shows the reason and keeps the dialog open', async () => {
    const { user } = await setup();
    adminUsers.updateUser.mockResolvedValue({ error: new Error('auth server refused') });
    const dialog = await open(user, 'bob@x.com');
    await user.clear(within(dialog).getByLabelText('Email'));
    await user.type(within(dialog).getByLabelText('Email'), 'bobby@x.com');
    await user.click(within(dialog).getByRole('button', { name: 'Update User' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Failed to update user: auth server refused');
  });
});

describe('deleting a user', () => {
  const open = async (user, email) => {
    await user.click(screen.getByRole('button', { name: `Delete ${email}` }));
    return screen.findByRole('alertdialog');
  };

  test('asks first, naming the user, and does nothing if cancelled', async () => {
    const { user, state } = await setup();
    const dialog = await open(user, 'bob@x.com');
    expect(within(dialog).getByText('bob@x.com')).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(state.log).toEqual([]);
    expect(screen.getByText('bob@x.com')).toBeInTheDocument();
  });

  test('confirming removes their roles, their record and their login', async () => {
    const { user, state } = await setup();
    await user.click(screen.getByRole('button', { name: 'Delete bob@x.com' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete User' }));
    await waitFor(() => expect(screen.queryByText('bob@x.com')).not.toBeInTheDocument());
    expect(writes(state)).toEqual(['delete auth_user_roles', 'delete auth_users']);
    expect(adminUsers.deleteUser).toHaveBeenCalledWith('u-bob');
  });

  test('you cannot delete your own account', async () => {
    const { user, state } = await setup({}, 'u-bob');
    const dialog = await open(user, 'bob@x.com');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('You cannot delete your own account.');
    expect(within(dialog).getByRole('button', { name: 'Delete User' })).toBeDisabled();
    expect(state.log).toEqual([]);
  });

  test('the only administrator cannot be deleted', async () => {
    const { user } = await setup({ users: USERS.slice(0, 2), links: [LINKS[0], LINKS[1]] }, 'u-bob');
    const dialog = await open(user, 'alice@x.com');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('This is the only administrator');
    expect(within(dialog).getByRole('button', { name: 'Delete User' })).toBeDisabled();
  });

  test('a database failure is shown (it used to be ignored) and the user stays', async () => {
    const { user } = await setup({ fail: { 'auth_users.delete': { message: 'still referenced' } } });
    await user.click(screen.getByRole('button', { name: 'Delete bob@x.com' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete User' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete user: still referenced');
    expect(adminUsers.deleteUser).not.toHaveBeenCalled();
    expect(screen.getByText('bob@x.com')).toBeInTheDocument();
  });
});
