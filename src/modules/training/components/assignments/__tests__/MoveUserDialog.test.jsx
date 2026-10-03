/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoveUserDialog from '../MoveUserDialog';
import { loadMoveContext, saveMove } from '../../../services/assignmentMoveService';

jest.mock('../../../services/assignmentMoveService', () => ({
  loadMoveContext: jest.fn(),
  saveMove: jest.fn()
}));

// user-event updates React outside RTL's act() wrapper here, which only prints a warning (the tests
// still assert on the final DOM). Hide just that one message so real errors stay visible.
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const LOCATION = 'London';
const AREA = 'Supply Chain';

let nextId = 1;
const part = (course_id, session_number, session_part_number, over = {}) => ({
  id: `s${nextId++}`, course_id, course_name: `Course ${course_id}`, session_number, session_part_number,
  session_identifier: `${course_id}-session${session_number}-part${session_part_number}`,
  start_datetime: `2026-10-${String(12 + session_number * 2).padStart(2, '0')}T09:30:00`,
  end_datetime: `2026-10-${String(12 + session_number * 2).padStart(2, '0')}T12:30:00`,
  training_location: LOCATION, functional_area: AREA, classroom_number: session_number,
  max_attendees: 2, instructor_name: 'Priya', ...over
});

const buildContext = ({ fullGroup2 = false, withoutBGroup3 = false } = {}) => {
  nextId = 1;
  const sessions = [];
  for (const n of [1, 2, 3]) {
    sessions.push(part('A', n, 1));
    if (!(withoutBGroup3 && n === 3)) sessions.push(part('B', n, 1));
  }
  const userRows = sessions.filter((s) => s.session_number === 1).map((s) => ({
    id: `row-${s.id}`, end_user_id: 7, session_id: s.id, course_id: s.course_id, user_name: 'Pat Example', user_email: 'pat@example.com'
  }));
  const a2 = sessions.find((s) => s.course_id === 'A' && s.session_number === 2);
  const seatRows = fullGroup2 ? [20, 21].map((id) => ({ session_id: a2.id, end_user_id: id })) : [];
  return { sessions, userRows, seatRows };
};

const baseProps = (overrides = {}) => ({
  isOpen: true,
  onClose: jest.fn(),
  onMoved: jest.fn(),
  userInfo: { userId: 7, name: 'Pat Example' },
  sessionInfo: { course_id: 'A', course_name: 'Course A', sessionNumber: 1, location: LOCATION, functional_area: AREA },
  schedule: { id: 'sched-1', project_id: 'proj-1' },
  projectId: 'proj-1',
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  loadMoveContext.mockResolvedValue(buildContext());
  saveMove.mockResolvedValue([]);
});

describe('MoveUserDialog', () => {
  test('renders nothing when closed', () => {
    const { container } = render(<MoveUserDialog {...baseProps({ isOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
    expect(loadMoveContext).not.toHaveBeenCalled();
  });

  test('loads the sessions for this location and area and lists the other groups of the course', async () => {
    render(<MoveUserDialog {...baseProps()} />);
    expect(await screen.findByText('Group 2')).toBeInTheDocument();
    expect(screen.getByText('Group 3')).toBeInTheDocument();
    expect(loadMoveContext).toHaveBeenCalledWith({
      scheduleId: 'sched-1', endUserId: 7, location: LOCATION, functionalArea: AREA
    });
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled(); // nothing chosen yet
  });

  test('choosing a group and clicking Move saves the plan, refreshes and closes', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MoveUserDialog {...props} />);

    await screen.findByText('Group 2');
    await user.click(screen.getAllByRole('radio', { name: /Group 2/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() => expect(saveMove).toHaveBeenCalledTimes(1));
    const plan = saveMove.mock.calls[0][0];
    expect(plan.deleteIds).toEqual(['row-s1']); // only course A, group 1
    expect(plan.newRows).toHaveLength(1);
    expect(plan.newRows[0]).toMatchObject({ course_id: 'A', group_identifier: 'Group 2', end_user_id: 7, schedule_id: 'sched-1', project_id: 'proj-1' });
    await waitFor(() => expect(props.onMoved).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
  });

  test('a full session is flagged and cannot be chosen until "Move anyway" is ticked', async () => {
    const user = userEvent.setup();
    loadMoveContext.mockResolvedValue(buildContext({ fullGroup2: true }));
    render(<MoveUserDialog {...baseProps()} />);

    await screen.findByText('FULL');
    await user.click(screen.getAllByRole('radio', { name: /Group 2/ })[0]);

    expect(screen.getByText(/already full/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();

    await user.click(screen.getByLabelText('Move anyway'));
    expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
  });

  test('the whole-group view lists groups and disables one that is missing a course', async () => {
    const user = userEvent.setup();
    loadMoveContext.mockResolvedValue(buildContext({ withoutBGroup3: true }));
    render(<MoveUserDialog {...baseProps()} />);

    await screen.findByText('Group 2');
    await user.click(screen.getByLabelText(/Whole group/));

    expect(await screen.findByText(/Not available: this group has no session for Course B/)).toBeInTheDocument();
    const group3 = screen.getAllByRole('radio').find((r) => r.closest('li')?.textContent.includes('Group 3'));
    expect(group3).toBeDisabled();
    const group2 = screen.getAllByRole('radio').find((r) => r.closest('li')?.textContent.includes('Group 2'));
    expect(group2).toBeEnabled();
  });

  test('a failed save shows the error, says nothing changed, and stays open', async () => {
    const user = userEvent.setup();
    saveMove.mockRejectedValue(new Error('Expected to remove 1 assignments but removed 0'));
    const props = baseProps();
    render(<MoveUserDialog {...props} />);

    await screen.findByText('Group 2');
    await user.click(screen.getAllByRole('radio', { name: /Group 2/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(await screen.findByText(/Nothing was changed/)).toBeInTheDocument();
    expect(props.onMoved).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test('says so when there is nowhere else to move to', async () => {
    loadMoveContext.mockResolvedValue({
      sessions: buildContext().sessions.filter((s) => s.session_number === 1),
      userRows: buildContext().userRows, seatRows: []
    });
    render(<MoveUserDialog {...baseProps()} />);
    expect(await screen.findByText(/no other session of this course/i)).toBeInTheDocument();
  });

  test('shows the load error if the sessions cannot be read', async () => {
    loadMoveContext.mockRejectedValue(new Error('network down'));
    render(<MoveUserDialog {...baseProps()} />);
    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  test('Cancel closes without saving', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<MoveUserDialog {...props} />);
    await screen.findByText('Group 2');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalled();
    expect(saveMove).not.toHaveBeenCalled();
  });
});
