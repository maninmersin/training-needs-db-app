/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleCalendar from '../ScheduleCalendar';
import { supabase } from '@core/services/supabaseClient';

// FullCalendar is a large browser library: a stand-in that shows how many events it was given
jest.mock('@fullcalendar/react', () => ({ __esModule: true, default: ({ events }) => <div data-testid="fullcalendar">{events.length} events</div> }));
jest.mock('@fullcalendar/timegrid', () => ({ __esModule: true, default: {} }));
jest.mock('@fullcalendar/daygrid', () => ({ __esModule: true, default: {} }));
jest.mock('@fullcalendar/interaction', () => ({ __esModule: true, default: {} }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../schedule-manager/SessionEditModal', () => () => null);

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const session = (course, day) => ({
  course_id: course, course_name: course, title: `${course} - Group 1`, sessionNumber: 1, functional_area: 'Finance', groupName: 'g',
  start: new Date(2026, 9, day, 9, 30), end: new Date(2026, 9, day, 12, 30), course: { course_name: course }
});
// area > location > classroom > sessions
const SESSIONS = {
  Finance: {
    Leeds: { 'Classroom 1': [session('A', 5)] },
    Dubai: { 'Classroom 1': [session('B', 6), session('C', 7)], 'Classroom 2': [session('D', 8)] },
    Aberdeen: { 'Classroom 1': [session('E', 9)] }
  }
};

const setup = (ordersRows) => {
  supabase.from.mockImplementation(() => ({ select: () => Promise.resolve({ data: ordersRows, error: null }) }));
  const user = userEvent.setup();
  render(<ScheduleCalendar sessions={SESSIONS} onSessionUpdated={() => {}} criteria={{}} />);
  return { user };
};

describe('ScheduleCalendar', () => {
  test('shows one calendar per location and classroom, with the session count', async () => {
    setup([]);
    expect(await screen.findAllByTestId('fullcalendar')).toHaveLength(4);
    expect(screen.getAllByText('Classroom 1')).toHaveLength(3);
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
  });

  test('locations follow the display order from Reference Data, and 0 counts as first', async () => {
    setup([{ name: 'Leeds', display_order: 0 }, { name: 'Dubai', display_order: 2 }, { name: 'Aberdeen', display_order: null }]);
    await screen.findAllByTestId('fullcalendar');
    await screen.findByRole('heading', { name: /Leeds/ });
    const order = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent.trim());
    expect(order).toEqual(['Leeds', 'Dubai', 'Aberdeen']);
  });

  test('the range starts as an auto-detected one, and a week preset replaces it', async () => {
    const { user } = setup([]);
    await screen.findAllByTestId('fullcalendar');
    expect(screen.getByText(/Auto-detected/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '4 Weeks' }));
    expect(screen.queryByText(/Auto-detected/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 Weeks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2 Weeks' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('Auto-Detect goes back to the range of the sessions', async () => {
    const { user } = setup([]);
    await screen.findAllByTestId('fullcalendar');
    await user.click(screen.getByRole('button', { name: '8 Weeks' }));
    await user.click(screen.getByRole('button', { name: /Auto-Detect/ }));
    expect(screen.getByText(/Auto-detected/)).toBeInTheDocument();
  });

  test('Next and Previous Week move the From and To dates by 7 days', async () => {
    const { user } = setup([]);
    await screen.findAllByTestId('fullcalendar');
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    const [fromBefore, toBefore] = [from.value, to.value];
    await user.click(screen.getByRole('button', { name: /Next Week/ }));
    const shift = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
    expect(from.value).toBe(shift(fromBefore, 7));
    expect(to.value).toBe(shift(toBefore, 7));
    await user.click(screen.getByRole('button', { name: /Previous Week/ }));
    expect(from.value).toBe(fromBefore);
  });
});
