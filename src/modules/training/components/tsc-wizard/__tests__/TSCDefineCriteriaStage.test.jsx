/** @jest-environment jsdom */
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TSCDefineCriteriaStage from '../TSCDefineCriteriaStage';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: () => ({ currentProject: { id: 'p1' } }) }));

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = jest.fn();
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const row = (id, user, course, location, area, hours = 4) => ({
  id, user_id: user, user_name: `Person ${user}`, user_email: `${user}@x.com`, training_location: location, user_project_role: 'R',
  course_id: course, course_name: `Course ${course}`, functional_area: area, duration_hrs: hours, course_priority: 1
});
const ROWS = [row(1, 'u1', 'c1', 'Dubai', 'Finance'), row(2, 'u2', 'c1', 'Dubai', 'Finance'), row(3, 'u3', 'c2', 'Leeds', 'HR')];

// The view: a count query and paged selects
const fakeView = (rows) => {
  const query = { select: (_cols, options) => { query.head = options?.head; return query; }, eq: () => query, order: () => query, range: (a, b) => ({ then: (r) => r({ data: rows.slice(a, b + 1), error: null }) }), then: (resolve) => resolve({ count: rows.length, data: null, error: null }) };
  return query;
};

const Harness = ({ onNext, onEndUsers }) => {
  const [criteria, setCriteria] = useState({});
  return <TSCDefineCriteriaStage criteria={criteria} setCriteria={setCriteria} onNextStage={onNext} setEndUsers={onEndUsers} setGroupingKeys={() => {}} />;
};

const setup = async () => {
  supabase.rpc.mockImplementation((name) => Promise.resolve({
    data: name === 'get_distinct_functional_areas' ? [{ functional_area: 'Finance' }, { functional_area: 'HR' }] : [{ training_location: 'Dubai' }, { training_location: 'Leeds' }],
    error: null
  }));
  supabase.from.mockImplementation(() => fakeView(ROWS));
  const onNext = jest.fn();
  const onEndUsers = jest.fn();
  const user = userEvent.setup();
  render(<Harness onNext={onNext} onEndUsers={onEndUsers} />);
  await screen.findByRole('checkbox', { name: 'Finance' });
  return { user, onNext, onEndUsers };
};

beforeEach(() => jest.clearAllMocks());

describe('Define Criteria', () => {
  test('lists the functional areas and locations from the data', async () => {
    await setup();
    ['Finance', 'HR', 'Dubai', 'Leeds'].forEach((name) => expect(screen.getByRole('checkbox', { name })).toBeInTheDocument());
    expect(screen.getByText(/0 users across 0 courses/)).toBeInTheDocument();
  });

  test('Next without a scope shows what is missing and does not continue', async () => {
    const { user, onNext } = await setup();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('At least one Functional Area must be selected');
    expect(alert).toHaveTextContent('At least one Training Location must be selected');
    expect(onNext).not.toHaveBeenCalled();
  });

  test('choosing a scope previews people and courses, passes the rows on and shows the classroom estimate', async () => {
    const { user, onEndUsers } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'Finance' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dubai' }));
    await screen.findByText(/2 users across 1 courses/);
    await waitFor(() => expect(onEndUsers).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'u1', course_id: 'c1' }), expect.objectContaining({ id: 'u2' })])));
    expect(screen.getByText(/Estimated classroom requirements/)).toBeInTheDocument();
    expect(screen.getByText(/1 classroom$/)).toBeInTheDocument();
  });

  test('the All boxes select everything and clear again', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'All Functional Areas' }));
    expect(screen.getByRole('checkbox', { name: 'Finance' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'HR' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'All Functional Areas' }));
    expect(screen.getByRole('checkbox', { name: 'Finance' })).not.toBeChecked();
  });

  test('with a scope chosen, Next continues', async () => {
    const { user, onNext } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'All Functional Areas' }));
    await user.click(screen.getByRole('checkbox', { name: 'All Training Locations' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('Morning Only hides the afternoon times and explains itself', async () => {
    const { user } = await setup();
    expect(screen.getByLabelText('Afternoon Time start')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Morning Only' }));
    expect(screen.queryByLabelText('Afternoon Time start')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Morning Time start')).toBeInTheDocument();
    expect(screen.getByText('Schedule training sessions only in the morning hours.')).toBeInTheDocument();
  });

  test('scheduling days can be switched off', async () => {
    const { user } = await setup();
    expect(screen.getByRole('checkbox', { name: 'Friday' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Friday' }));
    expect(screen.getByRole('checkbox', { name: 'Friday' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Saturday' })).not.toBeChecked();
  });

  test('a failed load says so', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'no access' } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness onNext={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no access');
  });
});
