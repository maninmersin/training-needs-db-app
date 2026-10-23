/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainerManagement from '../TrainerManagement';
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
const trainers = () => [
  { id: 't1', name: 'Alice Smith', email: 'alice@x.com', phone: '0123', specializations: ['Safety Training', 'Leadership'], bio: '', active: true },
  { id: 't2', name: 'Bob Jones', email: null, phone: null, specializations: [], bio: null, active: false }
];

// A small fake of the query builder: records writes and answers reads. Reads reflect earlier writes.
const installDatabase = ({ failLoadOnce = false } = {}) => {
  const log = [];
  let rows = trainers();
  let failNext = failLoadOnce;
  supabase.from.mockImplementation(() => {
    const state = { op: 'select' };
    const answer = () => {
      if (state.op === 'update') {
        log.push(['update', state.changes, state.eq]);
        rows = rows.map((r) => (r.id === state.eq[1] ? { ...r, ...state.changes } : r));
        return { error: null };
      }
      if (state.op === 'insert') { log.push(['insert', state.rows]); rows = [...rows, { id: 'new', ...state.rows[0] }]; return { error: null }; }
      if (state.op === 'delete') { log.push(['delete', state.eq]); rows = rows.filter((r) => r.id !== state.eq[1]); return { error: null }; }
      if (failNext) { failNext = false; return { data: null, error: { message: 'connection lost' } }; }
      return { data: rows, error: null };
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
  render(<TooltipProvider><TrainerManagement /></TooltipProvider>);
  return log;
};

beforeEach(() => jest.clearAllMocks());

describe('TrainerManagement', () => {
  test('lists trainers with status badges and specialization tags', async () => {
    await setup();
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Safety Training')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });

  test('without a project it explains what to do', async () => {
    useProject.mockReturnValue({ currentProject: null });
    installDatabase();
    render(<TooltipProvider><TrainerManagement /></TooltipProvider>);
    expect(await screen.findByText('No Project Selected')).toBeInTheDocument();
  });

  test('searching narrows the list', async () => {
    const user = userEvent.setup();
    await setup();
    await screen.findByText('Alice Smith');
    await user.type(screen.getByLabelText('Search trainers'), 'bob');
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  test('adding needs a name and a full email, then saves with the project id and a specializations list', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: /Add New Trainer/ }));
    const panel = await screen.findByRole('dialog');
    await user.type(within(panel).getByLabelText('Email'), 'nope@x');
    await user.click(within(panel).getByRole('button', { name: 'Add Trainer' }));
    expect(within(panel).getByText('Name is required')).toBeInTheDocument();
    expect(within(panel).getByText('Enter a full email address')).toBeInTheDocument();
    expect(log).toEqual([]);

    await user.type(within(panel).getByLabelText('Name *'), 'Dana Fox');
    await user.clear(within(panel).getByLabelText('Email'));
    await user.type(within(panel).getByLabelText('Specializations (comma-separated)'), 'IT, Safety ,');
    await user.click(within(panel).getByRole('button', { name: 'Add Trainer' }));
    await waitFor(() => expect(log).toHaveLength(1));
    expect(log[0][1][0]).toEqual({ name: 'Dana Fox', email: '', phone: '', specializations: ['IT', 'Safety'], bio: '', active: true, project_id: 'p1' });
    expect(await screen.findByText('Dana Fox')).toBeInTheDocument();
  });

  test('editing updates the trainer and refreshes the list', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click((await screen.findAllByRole('button', { name: 'Edit trainer' }))[0]);
    const panel = await screen.findByRole('dialog');
    const phone = within(panel).getByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, '9999');
    await user.click(within(panel).getByRole('button', { name: 'Update Trainer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log[0][0]).toBe('update');
    expect(log[0][1]).toEqual(expect.objectContaining({ name: 'Alice Smith', phone: '9999', specializations: ['Safety Training', 'Leadership'] }));
    expect(log[0][2]).toEqual(['id', 't1']);
    expect(await screen.findByText('9999')).toBeInTheDocument();
  });

  test('Activate / Deactivate flips the status straight from the table', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await screen.findByText('Alice Smith');
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(log).toEqual([['update', { active: false }, ['id', 't1']]]));
    expect(await screen.findAllByRole('button', { name: 'Activate' })).toHaveLength(2);
  });

  test('deleting asks first, and says sessions are kept', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click((await screen.findAllByRole('button', { name: 'Delete trainer' }))[1]);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/delete trainer Bob Jones\? Sessions that used them are kept/)).toBeInTheDocument();
    expect(log).toEqual([]);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument());
    expect(log).toEqual([['delete', ['id', 't2']]]);
  });

  test('the edit panel can delete too, and cancelling keeps the trainer', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(await screen.findByText('Alice Smith'));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Delete trainer' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(log).toEqual([]);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  test('a failed load shows the reason with Retry, and Retry loads the list', async () => {
    const user = userEvent.setup();
    await setup({ failLoadOnce: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Error loading trainers: connection lost');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('Export to CSV downloads the filtered list', async () => {
    const user = userEvent.setup();
    await setup();
    await screen.findByText('Alice Smith');
    window.URL.createObjectURL = jest.fn(() => 'blob:x');
    window.URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: /Export to CSV/ }));
    expect(click).toHaveBeenCalled();
    const blob = window.URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv');
    click.mockRestore();
  });
});
