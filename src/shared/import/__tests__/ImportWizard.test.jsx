/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import ImportWizard from '../ImportWizard';
import { peopleAdapter, assignmentsAdapter } from '../adapters';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// react-table and Radix update state outside RTL's act(); hide only that warning.
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const PEOPLE = [
  { id: 1, project_id: 'p1', name: 'Amelia Brown', email: 'a@x.com', division: 'Finance', training_location: 'London', project_role: 'Buyer' },
  { id: 2, project_id: 'p1', name: 'Oliver Patel', email: 'o@x.com', division: 'HR', training_location: 'Leeds', project_role: 'Clerk' }
];

// A small fake database: answers the lookups, records the writes, can make a write fail.
const fakeDb = ({ failWhen = null } = {}) => {
  const log = [];
  const db = {
    from: (table) => {
      const state = { table, op: 'select', filters: [] };
      const query = {
        select: () => query,
        insert: (rows) => { state.op = 'insert'; state.rows = rows; return query; },
        update: (values) => { state.op = 'update'; state.values = values; return query; },
        delete: () => { state.op = 'delete'; return query; },
        eq: (c, v) => { state.filters.push([c, v]); return query; },
        in: (c, v) => { state.filters.push([c, v]); return query; },
        order: () => query,
        range: () => query,
        then: (resolve, reject) => {
          const answer = () => {
            if (state.op !== 'select') {
              log.push({ table, op: state.op, rows: state.rows, values: state.values, filters: state.filters });
              const message = failWhen && failWhen(state);
              return message ? { error: { message } } : { error: null, data: [{ id: 1 }] };
            }
            if (table === 'training_locations') return { data: [{ name: 'London' }, { name: 'Leeds' }], error: null };
            if (table === 'project_roles') return { data: [{ project_role_name: 'Buyer' }, { project_role_name: 'Clerk' }], error: null };
            if (table === 'end_users') return { data: PEOPLE, error: null };
            return { data: [], error: null };
          };
          return Promise.resolve(answer()).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { db, log };
};

const csv = (...lines) => new File([lines.join('\n')], 'people.csv', { type: 'text/csv' });

const setup = (props = {}) => {
  const { db, log } = fakeDb(props.dbOptions);
  const onClose = jest.fn();
  const onApplied = jest.fn();
  const user = userEvent.setup();
  render(<ImportWizard open adapter={peopleAdapter} db={db} projectId="p1" onClose={onClose} onApplied={onApplied} {...props.wizard} />);
  return { log, onClose, onApplied, user };
};

const upload = async (user, file) => user.upload(screen.getByLabelText('Choose a file'), file);

beforeEach(() => jest.clearAllMocks());

describe('ImportWizard', () => {
  test('renders nothing when closed', () => {
    const { container } = render(<ImportWizard open={false} adapter={peopleAdapter} db={fakeDb().db} projectId="p1" onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('starts with the upload step, the file help and template downloads', async () => {
    const { user } = setup();
    expect(screen.getByRole('heading', { name: 'Import people' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is saved until you press Apply.')).toBeInTheDocument();
    expect(screen.getByText(/One row per person/)).toBeInTheDocument();
    expect(screen.getByText('Upload file').closest('li')).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByRole('button', { name: /Download template \(Excel\)/ }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs.mock.calls[0][1]).toBe('end_users_template.xlsx');
    await user.click(screen.getByRole('button', { name: 'CSV' }));
    expect(saveAs.mock.calls[1][1]).toBe('end_users_template.csv');
  });

  test('a good file is checked and previewed first; nothing is written yet', async () => {
    const { user, log } = setup();
    await upload(user, csv('id,name,email', '50,New Person,n@x.com', '1,Amelia Green,'));
    expect(await screen.findByText('people.csv')).toBeInTheDocument();
    expect(screen.getByText('2 rows read')).toBeInTheDocument();
    expect(screen.getByText('Check').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('New people to add')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Will change/ }));
    expect(await screen.findByText('New person')).toBeInTheDocument();
    expect(screen.getByText('Already exists - will update: name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 2 changes' })).toBeEnabled();
    expect(log).toEqual([]);
  });

  test('rows with problems are explained, left out, and do not block the good rows', async () => {
    const { user } = setup();
    await upload(user, csv('id,name,email', '50,Good Person,g@x.com', '51,Bad Email,nope', ',No Id,n@x.com'));
    expect(await screen.findByText('Enter a full email address')).toBeInTheDocument();
    expect(screen.getByText('ID is required')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Problems 2' })).toBeInTheDocument();
    expect(screen.getByText('2 rows left out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Download problems/ }));
    const blob = saveAs.mock.calls[0][0];
    expect(saveAs.mock.calls[0][1]).toBe('people_import_report.csv');
    expect(blob.type).toMatch(/text\/csv/);
  });

  test('a file with no ID column is refused with a clear message and cannot be applied', async () => {
    const { user } = setup();
    await upload(user, csv('name,email', 'Pat,p@x.com'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The file needs an "id" column');
    expect(screen.queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
  });

  test('an empty file is rejected on the upload step', async () => {
    const { user } = setup();
    await upload(user, csv(''));
    expect(await screen.findByRole('alert')).toHaveTextContent('The file is empty');
    expect(screen.getByText('Upload file').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  test('deletes are held back until "Allow deletes" is ticked, which re-checks the file', async () => {
    const { user } = setup();
    await upload(user, csv('change_type,id,name,email', 'Delete,2,,', 'Add,50,N,n@x.com'));
    expect(await screen.findByText(/Held back: tick "Allow deletes"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeEnabled();
    await user.click(screen.getByRole('checkbox', { name: /Allow deletes/ }));
    expect(await screen.findByRole('button', { name: 'Apply 2 changes' })).toBeEnabled();
  });

  test('Apply saves the ready rows, shows the result, refreshes the screen and offers a report', async () => {
    const { user, log, onApplied } = setup();
    await upload(user, csv('id,name,email', '50,New Person,n@x.com', '1,Amelia Green,', '51,Bad Email,nope'));
    await user.click(await screen.findByRole('button', { name: 'Apply 2 changes' }));
    expect(await screen.findByText('Every change was applied (2 changes).')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(log.map((entry) => entry.op)).toEqual(['insert', 'update']);
    expect(log[0].rows[0]).toMatchObject({ id: 50, project_id: 'p1', name: 'New Person' });
    expect(log[1].values).toEqual({ name: 'Amelia Green' });
    await user.click(screen.getByRole('button', { name: /Download report/ }));
    expect(saveAs).toHaveBeenCalled();
  });

  test('a row that fails to save is listed with the reason while the others still go through', async () => {
    const { user, log } = setup({ dbOptions: { failWhen: (state) => (state.op === 'update' ? 'permission denied' : null) } });
    await upload(user, csv('id,name,email', '50,New Person,n@x.com', '1,Amelia Green,'));
    await user.click(await screen.findByRole('button', { name: 'Apply 2 changes' }));
    expect(await screen.findByText('1 change applied, 1 failed.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Failed rows' });
    expect(within(table).getByText('permission denied')).toBeInTheDocument();
    expect(log.map((entry) => entry.op)).toEqual(['insert', 'update']);
  });

  test('Choose a different file goes back to the upload step', async () => {
    const { user } = setup();
    await upload(user, csv('id,name,email', '50,N,n@x.com'));
    await user.click(await screen.findByRole('button', { name: 'Choose a different file' }));
    expect(screen.getByLabelText('Choose a file')).toBeInTheDocument();
  });

  test('Cancel closes without writing anything', async () => {
    const { user, onClose, log } = setup();
    await upload(user, csv('id,name,email', '50,N,n@x.com'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  test('the assignments importer offers the "only add" option and shows per-person changes', async () => {
    const { user } = setup({ wizard: { adapter: assignmentsAdapter } });
    expect(screen.getByRole('heading', { name: 'Import course assignments' })).toBeInTheDocument();
    await upload(user, csv('UserID,Name,Email,Role,Location,CourseID', '1,Amelia Brown,a@x.com,,,C1'));
    expect(await screen.findByText(/not found in this project: C1/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Only add courses/ })).not.toBeChecked();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply 0 changes' })).toBeDisabled());
  });
});
