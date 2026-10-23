/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleSelector from '../ScheduleSelector';
import { progressState, scheduleStatsFrom } from '../scheduleSelectorLogic';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

describe('scheduleStatsFrom', () => {
  const sessions = [
    { course_id: 'c1', course_name: 'Budgeting', training_location: 'Dubai', functional_area: 'Finance' },
    { course_id: 'c1', course_name: 'Budgeting', training_location: 'Leeds', functional_area: 'Finance' },
    { course_id: 'c2', course_name: null, training_location: 'Leeds', functional_area: 'HR' },
    { course_id: 'c3', course_name: 'Ledger', training_location: 'Leeds', functional_area: 'HR' }
  ];

  test('counts courses, sessions, locations and areas, and the share of sessions with people', () => {
    const stats = scheduleStatsFrom(sessions, [{ session_identifier: 'a' }, { session_identifier: 'a' }, { session_identifier: 'b' }]);
    expect(stats).toMatchObject({ uniqueCourses: 3, totalSessions: 4, locations: 2, functionalAreas: 2, assignedSessions: 2, assignmentPercentage: 50 });
    expect(stats.locationNames).toEqual(['Dubai', 'Leeds']);
  });

  test('no sessions means 0%, not a division by zero', () => {
    expect(scheduleStatsFrom([], [{ session_identifier: 'a' }])).toMatchObject({ totalSessions: 0, assignmentPercentage: 0 });
    expect(scheduleStatsFrom(undefined, undefined).totalSessions).toBe(0);
  });

  test('progress is complete, partial or empty', () => {
    expect(progressState(100)).toBe('complete');
    expect(progressState(40)).toBe('partial');
    expect(progressState(0)).toBe('empty');
  });
});

describe('ScheduleSelector', () => {
  const SCHEDULES = [
    { id: 's1', name: 'Wave One', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' },
    { id: 's2', name: 'Pilot', created_at: '2026-10-03T09:00:00Z' }
  ];

  const setupDb = () => {
    supabase.from.mockImplementation((table) => {
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        then: (resolve) => resolve({
          data: table === 'training_sessions'
            ? [{ course_id: 'c1', course_name: 'Budgeting', training_location: 'Dubai', functional_area: 'Finance' }, { course_id: 'c2', course_name: 'Ledger', training_location: 'Dubai', functional_area: 'Finance' }]
            : [{ session_identifier: 'x' }],
          error: null
        })
      };
      return query;
    });
  };

  test('lists the schedules with figures and a progress percentage', async () => {
    setupDb();
    render(<ScheduleSelector schedules={SCHEDULES} onScheduleSelect={() => {}} onRefresh={() => {}} />);
    const row = screen.getByText('Wave One').closest('tr');
    await waitFor(() => expect(within(row).getByText('50%')).toBeInTheDocument()); // 1 of 2 sessions has people
    expect(within(row).getAllByText('2').length).toBeGreaterThan(0);
  });

  test('Assign Users picks that schedule', async () => {
    setupDb();
    const onScheduleSelect = jest.fn();
    const user = userEvent.setup();
    render(<ScheduleSelector schedules={SCHEDULES} onScheduleSelect={onScheduleSelect} onRefresh={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Assign Users to Pilot' }));
    expect(onScheduleSelect).toHaveBeenCalledWith(SCHEDULES[1]);
  });

  test('search narrows the list, and Refresh calls back', async () => {
    setupDb();
    const onRefresh = jest.fn();
    const user = userEvent.setup();
    render(<ScheduleSelector schedules={SCHEDULES} onScheduleSelect={() => {}} onRefresh={onRefresh} />);
    await user.type(screen.getByLabelText('Search schedules'), 'pilot');
    expect(screen.queryByText('Wave One')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(onRefresh).toHaveBeenCalled();
  });

  test('with no schedules it says how to get one', () => {
    render(<ScheduleSelector schedules={[]} onScheduleSelect={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('No Schedules Found')).toBeInTheDocument();
    expect(screen.getByText(/Create a schedule using the Training Scheduler Wizard/)).toBeInTheDocument();
  });
});
