/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScheduleManager from '../ScheduleManager';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
const mockProject = { id: 'p1', name: 'proj' }; // a stable object, like the real context
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: () => ({ currentProject: mockProject }) }));
jest.mock('../ScheduleEditor', () => ({ schedule, onBack }) => <div>editor for {schedule.name}<button onClick={onBack}>Back to list</button></div>);
jest.mock('@shared/components/ExcelExportDialog', () => ({ selectedSchedules }) => <div>export {selectedSchedules.length}</div>);

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

const SCHEDULES = [
  { id: 's1', name: 'Wave One', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-02T09:00:00Z', session_count: [{ count: 12 }] },
  { id: 's2', name: 'Pilot', created_at: '2026-10-03T09:00:00Z', updated_at: '2026-10-03T09:00:00Z', session_count: [{ count: 3 }] }
];

// A small stand-in: the list query, one schedule, its sessions, and deletes (logged)
const setupDb = ({ deleteError = null } = {}) => {
  const log = [];
  supabase.from.mockImplementation((table) => {
    const call = { table, op: 'select', filters: [] };
    const result = () => {
      if (call.op === 'delete') { log.push(call); return { error: deleteError }; }
      if (table === 'training_schedules') return call.single ? { data: { id: 's1', name: 'Wave One' }, error: null } : { data: SCHEDULES, error: null };
      return { data: [], error: null };
    };
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      in: (column, value) => { call.filters.push([column, value]); return query; },
      delete: () => { call.op = 'delete'; return query; },
      single: () => { call.single = true; return query; },
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
    };
    return query;
  });
  return log;
};

const setup = async (options) => {
  const log = setupDb(options);
  const user = userEvent.setup();
  render(<MemoryRouter><ScheduleManager /></MemoryRouter>);
  await screen.findByText('Wave One');
  return { log, user };
};

beforeEach(() => jest.clearAllMocks());

describe('ScheduleManager', () => {
  test('lists the schedules with their session counts', async () => {
    await setup();
    expect(screen.getByText('12 sessions')).toBeInTheDocument();
    expect(screen.getByText('3 sessions')).toBeInTheDocument();
  });

  test('search narrows the list', async () => {
    const { user } = await setup();
    await user.type(screen.getByLabelText('Search schedules'), 'pil');
    expect(screen.queryByText('Wave One')).not.toBeInTheDocument();
    expect(screen.getByText('Pilot')).toBeInTheDocument();
  });

  test('Export and Delete need a selection, which they count', async () => {
    const { user } = await setup();
    expect(screen.getByRole('button', { name: /Export \(0\)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete \(0\)/ })).toBeDisabled();
    await user.click(within(screen.getByText('Wave One').closest('tr')).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /Export \(1\)/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Export \(1\)/ }));
    expect(screen.getByText('export 1')).toBeInTheDocument();
  });

  test('Edit opens the editor for that schedule, and Back returns to the list', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Edit Wave One' }));
    expect(await screen.findByText(/editor for Wave One/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(await screen.findByText('Wave One')).toBeInTheDocument();
  });

  test('Delete asks first, and only deletes the selected schedules when confirmed', async () => {
    const { user, log } = await setup();
    await user.click(within(screen.getByText('Pilot').closest('tr')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Delete \(1\)/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete 1 schedule?');
    expect(dialog).toHaveTextContent('lose their assignments');
    expect(log).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log).toHaveLength(1));
    expect(log[0].filters).toEqual([['id', ['s2']]]);
  });

  test('cancelling the confirmation deletes nothing', async () => {
    const { user, log } = await setup();
    await user.click(within(screen.getByText('Pilot').closest('tr')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Delete \(1\)/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(log).toHaveLength(0);
  });

  test('a failed load shows the error with Retry', async () => {
    supabase.from.mockImplementation(() => {
      const query = { select: () => query, eq: () => query, order: () => query, then: (resolve) => resolve({ data: null, error: { message: 'no access' } }) };
      return query;
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<MemoryRouter><ScheduleManager /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('no access');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
