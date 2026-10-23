/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DynamicUserForm from '../DynamicUserForm';
import { TooltipProvider } from '@/components/ui';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { saveAs } from 'file-saver';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

// react-table and Radix update state outside RTL's act(); hide only that warning.
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

const SCHEMA = ['id', 'name', 'email', 'division', 'training_location', 'project_role', 'project_id', 'created_at'].map((column_name) => ({
  column_name,
  data_type: column_name === 'id' ? 'integer' : 'text'
}));

const COURSES = [
  { course_id: 'C10', course_name: 'Advanced Ledger', functional_area: 'Finance' },
  { course_id: 'C2', course_name: 'Stock Counts', functional_area: 'Operations' },
  { course_id: 'C1', course_name: 'Induction', functional_area: 'HR' }
];
const ROLE_MAPPINGS = [
  { project_role_name: 'Buyer', course_id: 'C1' },
  { project_role_name: 'Clerk', course_id: 'C2' }
];
const USER_MAPPINGS = [{ end_user_id: 1, course_id: 'C10' }]; // Amelia has one extra course

const people = () => [
  { id: 1, name: 'Amelia Brown', email: 'amelia@x.com', division: 'Finance', training_location: 'London', project_role: 'Buyer' },
  { id: 2, name: 'Oliver Patel', email: 'oliver@x.com', division: 'HR', training_location: 'Leeds', project_role: 'Buyer' },
  { id: 3, name: 'Isla Walker', email: 'isla@x.com', division: 'Finance', training_location: 'London', project_role: 'Clerk' }
];

// A small fake of the query builder: records writes and answers reads per table.
const installDatabase = ({ rows = people(), existingId = null } = {}) => {
  const log = [];
  supabase.rpc.mockResolvedValue({ data: SCHEMA, error: null });
  supabase.from.mockImplementation((table) => {
    const state = { table, op: 'select' };
    const answer = (single) => {
      if (state.op === 'update') { log.push(['update', state.changes, state.eq]); return { data: [{ ...rows.find((r) => String(r.id) === String(state.eq[1])), ...state.changes }], error: null }; }
      if (state.op === 'insert') { log.push(['insert', state.rows]); return { data: state.rows, error: null }; }
      if (state.op === 'delete') { log.push(['delete', state.eq]); return { error: null }; }
      if (table === 'courses') return { data: COURSES, error: null };
      if (table === 'role_course_mappings') return { data: ROLE_MAPPINGS, error: null };
      if (table === 'user_course_mappings') return { data: USER_MAPPINGS.filter((m) => String(m.end_user_id) === String(state.eqs?.end_user_id)).map((m) => ({ course_id: m.course_id })), error: null };
      if (table === 'project_roles') return { data: [{ project_role_name: 'Buyer' }, { project_role_name: 'Clerk' }], error: null };
      if (table === 'training_locations') return { data: [{ id: 1, name: 'London' }, { id: 2, name: 'Leeds' }], error: null };
      if (single) return { data: existingId !== null && String(state.eq?.[1]) === String(existingId) ? { id: existingId } : null, error: null };
      return { data: rows, error: null };
    };
    const query = {
      select: () => query,
      insert: (r) => { state.op = 'insert'; state.rows = r; return query; },
      update: (c) => { state.op = 'update'; state.changes = c; return query; },
      delete: () => { state.op = 'delete'; return query; },
      eq: (c, v) => { state.eq = [c, v]; state.eqs = { ...state.eqs, [c]: v }; return query; },
      in: (c, v) => { state.eq = [c, v]; return query; },
      order: () => query,
      range: () => query,
      single: () => Promise.resolve(answer(true)),
      then: (resolve, reject) => Promise.resolve(answer(false)).then(resolve, reject)
    };
    return query;
  });
  return log;
};

const setup = async (options) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', name: 'acme', title: 'ACME Corp' } });
  const log = installDatabase(options);
  render(<MemoryRouter><TooltipProvider><DynamicUserForm /></TooltipProvider></MemoryRouter>);
  await screen.findByText('Amelia Brown');
  return log;
};

beforeEach(() => jest.clearAllMocks());

describe('DynamicUserForm', () => {
  test('lists this project\'s people with a count, hiding system columns', async () => {
    await setup();
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'End Users Management' })).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Project Id' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Training Location' })).toBeInTheDocument();
  });

  test('without a project it explains what to do', async () => {
    useProject.mockReturnValue({ currentProject: null });
    installDatabase();
    render(<MemoryRouter><TooltipProvider><DynamicUserForm /></TooltipProvider></MemoryRouter>);
    expect(await screen.findByText('No Project Selected')).toBeInTheDocument();
  });

  test('searching narrows the list and the count', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(screen.getByLabelText('Search users'), 'patel');
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
    expect(screen.queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  test('a column filter keeps only the chosen values, and Clear filters brings everyone back', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /Filter by Division/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'HR' }));
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
    expect(screen.queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(screen.getByText('1 filter(s) active')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Amelia Brown')).toBeInTheDocument();
  });

  test('editing a person saves only what changed, then closes the panel', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Edit user' })[0]);
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('ID 1 - changes apply to this project only')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Id')).toBeDisabled();
    const name = within(panel).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Amelia Green');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log).toEqual([['update', { name: 'Amelia Green' }, ['id', 1]]]);
    expect(screen.getByText('Amelia Green')).toBeInTheDocument();
  });

  test('saving with nothing changed just closes without writing', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByText('Isla Walker'));
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log).toEqual([]);
  });

  test('adding a person needs an ID, then inserts with the project id', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByRole('button', { name: /Add New User/ }));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add user' }));
    expect(within(panel).getByText('Employee ID is required')).toBeInTheDocument();
    expect(log).toEqual([]);

    await user.type(within(panel).getByLabelText('Id'), '99');
    await user.type(within(panel).getByLabelText('Name'), 'New Person');
    await user.click(within(panel).getByRole('button', { name: 'Add user' }));
    await waitFor(() => expect(log).toHaveLength(1));
    expect(log[0][0]).toBe('insert');
    expect(log[0][1][0]).toEqual(expect.objectContaining({ id: '99', name: 'New Person', project_id: 'p1', training_location: 'London' }));
    expect(await screen.findByText('New Person')).toBeInTheDocument();
  });

  test('an ID that already exists is refused inside the panel', async () => {
    const user = userEvent.setup();
    const log = await setup({ existingId: 1 });
    await user.click(screen.getByRole('button', { name: /Add New User/ }));
    const panel = await screen.findByRole('dialog');
    await user.type(within(panel).getByLabelText('Id'), '1');
    await user.click(within(panel).getByRole('button', { name: 'Add user' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Employee ID 1 already exists. Please use a different ID.');
    expect(log).toEqual([]);
  });

  test('deleting asks first, then removes the person', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Delete user' })[1]);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/Are you sure you want to delete user Isla Walker\?/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Isla Walker')).not.toBeInTheDocument());
    expect(log).toEqual([['delete', ['id', 3]]]);
  });

  test('the edit panel has a Delete button that asks first, then removes the person and closes the panel', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByText('Oliver Patel'));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Delete user' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/delete user Oliver Patel\?/)).toBeInTheDocument();
    expect(log).toEqual([]);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Oliver Patel')).not.toBeInTheDocument());
    expect(log).toEqual([['delete', ['id', 2]]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('the Add panel has no Delete button', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /Add New User/ }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument();
  });

  test('cancelling the delete keeps the person', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Delete user' })[0]);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Amelia Brown')).toBeInTheDocument();
    expect(log).toEqual([]);
  });

  test('a load failure is shown without blanking the page', async () => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', name: 'acme', title: 'ACME Corp' } });
    installDatabase();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'schema cache is stale' } });
    render(<MemoryRouter><TooltipProvider><DynamicUserForm /></TooltipProvider></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('schema cache is stale');
    expect(screen.getByRole('heading', { name: 'End Users Management' })).toBeInTheDocument();
  });
});

const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

describe('DynamicUserForm import and export', () => {
  const renderAt = async (path) => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', name: 'acme', title: 'ACME Corp' } });
    installDatabase();
    render(<MemoryRouter initialEntries={[path]}><TooltipProvider><DynamicUserForm /></TooltipProvider></MemoryRouter>);
    await screen.findByText('Amelia Brown');
  };

  test('the Import menu opens the people importer or the course assignments importer', async () => {
    const user = userEvent.setup();
    await renderAt('/dynamic-users');
    await user.click(screen.getByRole('button', { name: /Import/ }));
    await user.click(await screen.findByRole('menuitem', { name: /People/ }));
    expect(await screen.findByRole('heading', { name: 'Import people' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Import people' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Import/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Course assignments/ }));
    expect(await screen.findByRole('heading', { name: 'Import course assignments' })).toBeInTheDocument();
  });

  test.each([
    ['/dynamic-users?import=people', 'Import people'],
    ['/dynamic-users?import=assignments', 'Import course assignments']
  ])('the old link %s opens the importer straight away', async (path, heading) => {
    await renderAt(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  test('Export people downloads only the people currently shown, in a file that can be imported back', async () => {
    const user = userEvent.setup();
    await renderAt('/dynamic-users');
    await user.type(screen.getByLabelText('Search users'), 'patel');
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'People - CSV' }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs.mock.calls[0][1]).toBe('end_users_export.csv');
    const text = await readBlob(saveAs.mock.calls[0][0]);
    expect(text.split(String.fromCharCode(13, 10))[0]).toBe('id,name,email,job_title,country,division,sub_division,location_name,training_location,project_role');
    expect(text).toContain('Oliver Patel');
    expect(text).not.toContain('Amelia Brown');
  });
});

describe('DynamicUserForm - courses in the edit panel', () => {
  const openAmelia = async (user) => {
    await user.click(screen.getAllByRole('button', { name: 'Edit user' })[0]);
    const panel = await screen.findByRole('dialog');
    await within(panel).findByRole('list', { name: 'Courses from the role' });
    return panel;
  };

  test("shows the courses from the person's role and their extra courses", async () => {
    const user = userEvent.setup();
    await setup();
    const panel = await openAmelia(user);
    expect(within(within(panel).getByRole('list', { name: 'Courses from the role' })).getByText('C1')).toBeInTheDocument();
    expect(within(within(panel).getByRole('list', { name: 'Extra courses' })).getByText('C10')).toBeInTheDocument();
    expect(within(panel).getByText(/From the role \(Buyer\)/)).toBeInTheDocument();
  });

  test('changing the role updates the role courses straight away', async () => {
    const user = userEvent.setup();
    await setup();
    const panel = await openAmelia(user);
    await user.click(within(panel).getByRole('combobox', { name: 'Project Role' }));
    await user.click(await screen.findByRole('option', { name: 'Clerk' }));
    const list = await within(panel).findByRole('list', { name: 'Courses from the role' });
    expect(within(list).getByText('C2')).toBeInTheDocument();
    expect(within(list).queryByText('C1')).not.toBeInTheDocument();
  });

  test('adding and removing extra courses is saved with Save changes, adding first', async () => {
    const user = userEvent.setup();
    const log = await setup();
    const panel = await openAmelia(user);
    await user.click(within(panel).getByRole('button', { name: 'Add course' }));
    expect(screen.queryByRole('button', { name: /^C1\b/ })).not.toBeInTheDocument(); // a role course is not offered
    await user.click(await screen.findByRole('button', { name: /C2/ }));
    await user.click(within(panel).getByRole('button', { name: 'Remove C10' }));
    expect(log).toEqual([]);
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log.map((entry) => entry[0])).toEqual(['insert', 'delete']);
    expect(log[0][1][0]).toMatchObject({ project_id: 'p1', end_user_id: 1, course_id: 'C2', assigned_by: 'admin' });
    expect(log[1][1]).toEqual(['course_id', ['C10']]);
  });

  test('closing without saving writes nothing', async () => {
    const user = userEvent.setup();
    const log = await setup();
    const panel = await openAmelia(user);
    await user.click(within(panel).getByRole('button', { name: 'Remove C10' }));
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(log).toEqual([]);
  });

  test('a new person shows that extra courses wait until they are saved', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /Add New User/ }));
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText(/Extra courses can be added once the person has been saved/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Add course' })).not.toBeInTheDocument();
  });
});
