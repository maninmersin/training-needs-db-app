/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoleCourseMappingsEditor from '../RoleCourseMappingsEditor';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';

jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

// react-table and Radix update state outside RTL's act(); hide only that warning.
beforeAll(() => {
  // jsdom lacks these browser features, which the dropdown (Radix Select) uses
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

const PROJECT = { id: 'p1', name: 'acme', title: 'ACME Corp' };
const ROLES = [{ id: 1, project_role_name: 'Buyer' }, { id: 2, project_role_name: 'Clerk' }];
const COURSES = [
  { course_id: 'C10', course_name: 'Advanced Ledger', functional_area: 'Finance', duration_hrs: 3, application: 'ERP' },
  { course_id: 'C2', course_name: 'Stock Counts', functional_area: 'Operations', duration_hrs: 2, application: 'WMS' },
  { course_id: 'C1', course_name: 'Induction', functional_area: 'HR', duration_hrs: 1, application: '' }
];
const MAPPINGS = { Buyer: ['C1', 'C2'], Clerk: [] };

// A small fake of the query builder: records writes and answers reads per table.
const installDatabase = ({ insertError = null } = {}) => {
  const log = [];
  supabase.from.mockImplementation((table) => {
    const state = { op: 'select', filters: {} };
    const answer = () => {
      if (state.op === 'insert') { log.push(['insert', state.rows]); return { error: insertError }; }
      if (state.op === 'delete') { log.push(['delete', state.filters]); return { error: null }; }
      if (table === 'project_roles') return { data: ROLES, error: null };
      if (table === 'courses') return { data: COURSES, error: null };
      return { data: (MAPPINGS[state.filters.project_role_name] || []).map((course_id) => ({ course_id })), error: null };
    };
    const query = {
      select: () => query,
      insert: (r) => { state.op = 'insert'; state.rows = r; return query; },
      delete: () => { state.op = 'delete'; return query; },
      eq: (c, v) => { state.filters[c] = v; return query; },
      in: (c, v) => { state.filters[c] = v; return query; },
      then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject)
    };
    return query;
  });
  return log;
};

const setup = async (options) => {
  useProject.mockReturnValue({ currentProject: PROJECT });
  const log = installDatabase(options);
  const user = userEvent.setup();
  render(<RoleCourseMappingsEditor />);
  await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('courses'));
  return { log, user };
};

const chooseRole = async (user, name) => {
  await user.click(screen.getByRole('combobox', { name: 'Select Project Role:' }));
  await user.click(await screen.findByRole('option', { name }));
};

beforeEach(() => jest.clearAllMocks());

describe('RoleCourseMappingsEditor', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    installDatabase();
    render(<RoleCourseMappingsEditor />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('before a role is chosen it prompts for one', async () => {
    await setup();
    expect(screen.getByText('Select a role to edit its courses')).toBeInTheDocument();
  });

  test('choosing a role shows its courses in ID order with the saved ones ticked', async () => {
    const { user } = await setup();
    await chooseRole(user, 'Buyer');
    expect(await screen.findByText('Edit Courses for Buyer')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual(['C1', 'C2', 'C10']);
    expect(screen.getByRole('checkbox', { name: 'Select C1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select C2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select C10' })).not.toBeChecked();
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  test('saving inserts the newly ticked courses and deletes the unticked ones, only', async () => {
    const { log, user } = await setup();
    await chooseRole(user, 'Buyer');
    await user.click(await screen.findByRole('checkbox', { name: 'Select C10' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select C1' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(log).toHaveLength(2));
    expect(log[0]).toEqual(['insert', [{ project_role_name: 'Buyer', course_id: 'C10', project_id: 'p1' }]]);
    expect(log[1]).toEqual(['delete', { project_role_name: 'Buyer', project_id: 'p1', course_id: ['C1'] }]);
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  test('Cancel puts the ticks back to what is saved', async () => {
    const { log, user } = await setup();
    await chooseRole(user, 'Buyer');
    await user.click(await screen.findByRole('checkbox', { name: 'Select C10' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('checkbox', { name: 'Select C10' })).not.toBeChecked();
    expect(log).toEqual([]);
  });

  test('a failed save shows the reason and keeps the ticks', async () => {
    const { user } = await setup({ insertError: new Error('permission denied') });
    await chooseRole(user, 'Clerk');
    await user.click(await screen.findByRole('checkbox', { name: 'Select C2' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error saving changes: permission denied');
    expect(screen.getByRole('checkbox', { name: 'Select C2' })).toBeChecked();
  });

  test('search narrows the list; Select all shown ticks only those', async () => {
    const { user } = await setup();
    await chooseRole(user, 'Clerk');
    await user.type(await screen.findByLabelText('Search courses'), 'ledger');
    expect(screen.queryByText('Stock Counts')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select all shown' }));
    expect(screen.getByRole('checkbox', { name: 'Select C10' })).toBeChecked();
    expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();
  });

  test('switching role with unsaved changes asks first; keeping editing stays put', async () => {
    const { user } = await setup();
    await chooseRole(user, 'Buyer');
    await user.click(await screen.findByRole('checkbox', { name: 'Select C10' }));
    await chooseRole(user, 'Clerk');
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/unsaved course changes for Buyer/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByText('Edit Courses for Buyer')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select C10' })).toBeChecked();
  });

  test('discarding switches to the other role and loads its own courses', async () => {
    const { user } = await setup();
    await chooseRole(user, 'Buyer');
    await user.click(await screen.findByRole('checkbox', { name: 'Select C10' }));
    await chooseRole(user, 'Clerk');
    await user.click(await screen.findByRole('button', { name: 'Discard and switch' }));
    expect(await screen.findByText('Edit Courses for Clerk')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('0 of 3 selected')).toBeInTheDocument());
  });
});
