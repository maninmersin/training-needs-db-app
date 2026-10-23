/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReferenceDataManager from '../ReferenceDataManager';
import { TooltipProvider } from '@/components/ui';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';

jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

// react-table and Radix update state outside RTL's act(); hide only that warning.
beforeAll(() => {
  // jsdom has no ResizeObserver, which the Switch component uses
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const PROJECT = { id: 'p1', name: 'acme', title: 'ACME Corp' };
const tables = () => ({
  project_roles: [{ id: 1, project_role_name: 'Buyer', created_at: '2026-01-05T10:00:00Z' }, { id: 2, project_role_name: 'Clerk', created_at: '2026-01-06T10:00:00Z' }],
  functional_areas: [{ id: 10, name: 'Finance', description: 'Money', display_order: 1, active: true, created_at: '2026-01-05T10:00:00Z' }],
  training_locations: [
    { id: 20, name: 'London', description: null, capacity: 20, classrooms_count: 3, display_order: 1, active: true, created_at: '2026-01-05T10:00:00Z' },
    { id: 21, name: 'Leeds', description: null, capacity: 10, classrooms_count: 2, display_order: 2, active: false, created_at: '2026-01-05T10:00:00Z' }
  ]
});

// A small fake of the query builder: records writes and answers reads per table.
const installDatabase = ({ missingAreasTable = false } = {}) => {
  const log = [];
  const rows = tables();
  supabase.from.mockImplementation((table) => {
    const state = { op: 'select' };
    const answer = () => {
      if (state.op === 'update') { log.push(['update', table, state.changes, state.eq]); return { error: null }; }
      if (state.op === 'insert') { log.push(['insert', table, state.rows]); return { data: [{ id: 99, ...state.rows[0] }], error: null }; }
      if (state.op === 'delete') { log.push(['delete', table, state.eq]); return { error: null }; }
      if (missingAreasTable && table === 'functional_areas') return { data: null, error: { message: 'relation "functional_areas" does not exist' } };
      return { data: rows[table], error: null };
    };
    const query = {
      select: () => query,
      insert: (r) => { state.op = 'insert'; state.rows = r; return query; },
      update: (c) => { state.op = 'update'; state.changes = c; return query; },
      delete: () => { state.op = 'delete'; return query; },
      eq: (c, v) => { state.eq = [c, v]; return query; },
      order: () => query,
      then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject)
    };
    return query;
  });
  return log;
};

const setup = async (options) => {
  useProject.mockReturnValue({ currentProject: PROJECT });
  const log = installDatabase(options);
  render(<TooltipProvider><ReferenceDataManager /></TooltipProvider>);
  await screen.findByText('Buyer');
  return log;
};

beforeEach(() => jest.clearAllMocks());

describe('ReferenceDataManager', () => {
  test('starts on Project Roles; tabs show counts and switch lists', async () => {
    const user = userEvent.setup();
    await setup();
    expect(screen.getByRole('tab', { name: 'Project Roles (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Functional Areas (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Training Locations (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Training Locations (2)' }));
    expect(await screen.findByText('London')).toBeInTheDocument();
    expect(screen.queryByText('Buyer')).not.toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add New Training Location/ })).toBeInTheDocument();
  });

  test('without a project it explains what to do', async () => {
    useProject.mockReturnValue({ currentProject: null });
    installDatabase();
    render(<TooltipProvider><ReferenceDataManager /></TooltipProvider>);
    expect(await screen.findByText('No Project Selected')).toBeInTheDocument();
  });

  test('a project without the optional areas table still loads the rest', async () => {
    await setup({ missingAreasTable: true });
    expect(screen.getByRole('tab', { name: 'Functional Areas (0)' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('searching only affects the list you are on', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(screen.getByLabelText('Search project roles'), 'clerk');
    expect(screen.queryByText('Buyer')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Training Locations (2)' }));
    expect(await screen.findByText('London')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Project Roles (2)' }));
    expect(await screen.findByLabelText('Search project roles')).toHaveValue('clerk');
  });

  test('adding a role needs a name, then inserts with the project id', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByRole('button', { name: /Add New Project Role/ }));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add Project Role' }));
    expect(within(panel).getByText('Role Name is required')).toBeInTheDocument();
    expect(log).toEqual([]);
    await user.type(within(panel).getByLabelText('Role Name *'), 'Supervisor');
    await user.click(within(panel).getByRole('button', { name: 'Add Project Role' }));
    await waitFor(() => expect(log).toHaveLength(1));
    expect(log[0]).toEqual(['insert', 'project_roles', [{ project_role_name: 'Supervisor', project_id: 'p1' }]]);
    expect(await screen.findByText('Supervisor')).toBeInTheDocument();
  });

  test('editing a location saves only what changed, and 0 is kept as 0', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByRole('tab', { name: 'Training Locations (2)' }));
    await user.click((await screen.findAllByRole('button', { name: 'Edit item' }))[0]);
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('ID 20 - changes apply to this project only')).toBeInTheDocument();
    const capacity = within(panel).getByLabelText('Capacity');
    await user.clear(capacity);
    await user.type(capacity, '0');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log).toEqual([['update', 'training_locations', { capacity: 0 }, ['id', 20]]]);
  });

  test('bad numbers are refused in the panel', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByRole('tab', { name: 'Training Locations (2)' }));
    await user.click(await screen.findByText('Leeds'));
    const panel = await screen.findByRole('dialog');
    const classrooms = within(panel).getByLabelText('Classrooms');
    await user.clear(classrooms);
    await user.type(classrooms, '2.5');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(within(panel).getByText('Enter a whole number (0 or more)')).toBeInTheDocument();
    expect(log).toEqual([]);
  });

  test('deleting asks first with the item name, and the panel can delete too', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Delete item' })[1]);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Are you sure you want to delete "Clerk"?')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Clerk')).not.toBeInTheDocument());
    expect(log).toEqual([['delete', 'project_roles', ['id', 2]]]);

    await user.click(screen.getByText('Buyer'));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(log).toHaveLength(1);
    expect(screen.getByText('Buyer')).toBeInTheDocument();
  });
});
