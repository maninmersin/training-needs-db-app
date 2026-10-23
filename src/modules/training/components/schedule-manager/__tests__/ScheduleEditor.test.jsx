/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleEditor from '../ScheduleEditor';
import { supabase } from '@core/services/supabaseClient';
import { saveScheduleAs } from '@core/services/scheduleService';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
const mockProject = { id: 'p1' }; // a stable object, like the real context
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: () => ({ currentProject: mockProject }) }));
jest.mock('@core/services/scheduleService', () => ({ saveScheduleAs: jest.fn(), generateStableSessionId: jest.fn() }));
jest.mock('../../calendar/ScheduleCalendar', () => ({ selectionMode }) => <div>calendar {selectionMode ? 'selecting' : 'viewing'}</div>);
jest.mock('../AddCourseToScheduleModal', () => ({ isOpen }) => (isOpen ? <div>add course dialog</div> : null));

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

const session = (id, course) => ({ event_id: id, course: { course_name: course }, course_name: course, start: new Date(2026, 9, 5, 9), end: new Date(2026, 9, 5, 12) });
const SCHEDULE = {
  id: '12345678-aaaa-bbbb-cccc-1234567890ab',
  name: 'Wave One',
  created_at: '2026-10-01T09:00:00Z',
  criteria: {},
  sessions: { Finance: { Dubai: { 'Classroom 1': [session('a', 'Budgeting'), session('b', 'Budgeting')], 'Classroom 2': [session('c', 'Ledger')] } } }
};

const setup = (props = {}) => {
  supabase.from.mockImplementation(() => {
    const query = { select: () => query, eq: () => query, order: () => query, then: (resolve) => resolve({ data: [], error: null }) };
    return query;
  });
  sessionStorage.clear();
  const onBack = jest.fn();
  const onSave = jest.fn();
  const user = userEvent.setup();
  render(<ScheduleEditor schedule={SCHEDULE} onBack={onBack} onSave={onSave} {...props} />);
  return { user, onBack, onSave };
};

beforeEach(() => jest.clearAllMocks());

describe('ScheduleEditor', () => {
  test('shows the schedule, its calendar and its figures', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Edit Schedule: Wave One' })).toBeInTheDocument();
    expect(screen.getByText('calendar viewing')).toBeInTheDocument();
    expect(screen.getByText('Total Sessions:').parentElement).toHaveTextContent('Total Sessions: 3');
    expect(screen.getByText('Unique Courses:').parentElement).toHaveTextContent('Unique Courses: 2');
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeDisabled(); // nothing changed yet
  });

  test('Select turns on selection mode for the calendar', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /^Select/ }));
    expect(screen.getByText('calendar selecting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exit Select/ })).toBeInTheDocument();
  });

  test('Add Course opens the add-course dialog', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /Add Course/ }));
    expect(screen.getByText('add course dialog')).toBeInTheDocument();
  });

  test('Cancel with nothing changed goes straight back', async () => {
    const { user, onBack } = setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('Save As copies the schedule under the new name', async () => {
    saveScheduleAs.mockResolvedValue({ schedule: { name: 'Wave One (Copy)' }, sessionCount: 3, originalScheduleName: 'Wave One' });
    const { user, onSave } = setup();
    await user.click(await screen.findByRole('button', { name: /Save As/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('New Schedule Name *')).toHaveValue('Wave One (Copy)');
    expect(dialog).toHaveTextContent('Sessions to copy: 3');
    await user.click(within(dialog).getByRole('button', { name: 'Create Copy' }));
    await waitFor(() => expect(saveScheduleAs).toHaveBeenCalledWith(SCHEDULE.id, 'Wave One (Copy)', expect.stringContaining('Copy of Wave One')));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  test('Create Copy needs a name', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /Save As/ }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('New Schedule Name *'));
    expect(within(dialog).getByRole('button', { name: 'Create Copy' })).toBeDisabled();
  });

  test('a schedule with no sessions says so', async () => {
    setup({ schedule: { ...SCHEDULE, sessions: {} } });
    expect(await screen.findByText('No Sessions Found')).toBeInTheDocument();
  });
});
