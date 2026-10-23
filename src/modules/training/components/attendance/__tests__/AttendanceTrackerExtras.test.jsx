/** @jest-environment jsdom */
// Clear and Add walk-in on the Attendance Tracker
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AttendanceTracker from '../AttendanceTracker';
import { useProject } from '@core/contexts/ProjectContext';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import * as service from '../../../services/attendanceService';
import { searchUserDirectory } from '../../../services/userDirectoryService';
import { applyWalkInPlan, loadWalkInContext } from '../../../services/walkInService';

jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@auth/services/simpleAuthService', () => ({ SimpleAuthService: { getCurrentUser: jest.fn() } }));
jest.mock('../../../services/attendanceService', () => ({
  getSessionsForAttendance: jest.fn(),
  getAttendanceStatuses: jest.fn(),
  getSessionAttendees: jest.fn(),
  getSessionAttendanceRecords: jest.fn(),
  getSessionAttendanceSummary: jest.fn(),
  markSingleAttendance: jest.fn(),
  clearAttendanceRecord: jest.fn()
}));
jest.mock('../../../services/userDirectoryService', () => ({ searchUserDirectory: jest.fn() }));
jest.mock('../../../services/walkInService', () => ({ loadWalkInContext: jest.fn(), applyWalkInPlan: jest.fn() }));

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

const T1 = {
  id: 's1', schedule_id: 'sch1', course_id: 'C1', course_name: 'Ledger Basics', session_number: 2, session_part_number: 1, session_identifier: 'C1-2-1',
  start_datetime: '2026-10-14T09:30:00', end_datetime: '2026-10-14T12:30:00', training_location: 'London', functional_area: 'Finance', classroom_number: 2, max_attendees: 2
};
const OLD = { ...T1, id: 'o1', session_number: 1, training_location: 'Leeds', start_datetime: '2026-10-07T09:30:00', end_datetime: '2026-10-07T12:30:00' };
const STATUSES = [
  { id: 1, status_name: 'Present', is_present: true, color_code: '#16a34a' },
  { id: 2, status_name: 'Absent', is_present: false, color_code: '#dc2626' }
];
const AMELIA = { name: 'Amelia Brown', email: 'amelia@x.com' };
const ATTENDEES = [
  { id: 'a1', attendee_id: 1, user: AMELIA },
  { id: 'a2', attendee_id: 2, user: { name: 'Oliver Patel', email: 'oliver@x.com' } }
];
const WANDA = { id: 9, name: 'Wanda Walker', email: 'w@x.com', project_role: 'Buyer', training_location: 'London' };
const NO_BOOKINGS = { existingRows: [], existingSessions: [], targetParts: [T1], seatRows: [] };

const setup = async ({ records = [], attendees = ATTENDEES, summary } = {}) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
  SimpleAuthService.getCurrentUser.mockResolvedValue({ id: 'u1' });
  service.getSessionsForAttendance.mockResolvedValue([T1]);
  service.getAttendanceStatuses.mockResolvedValue(STATUSES);
  service.getSessionAttendees.mockResolvedValue(attendees);
  service.getSessionAttendanceRecords.mockResolvedValue(records);
  service.getSessionAttendanceSummary.mockResolvedValue(summary || { total_registered: 2, total_attended: 0, total_absent: 0, total_walk_ins: 0, attendance_rate: 0 });
  service.markSingleAttendance.mockResolvedValue({});
  service.clearAttendanceRecord.mockResolvedValue(true);
  searchUserDirectory.mockResolvedValue([]);
  loadWalkInContext.mockResolvedValue(NO_BOOKINGS);
  applyWalkInPlan.mockResolvedValue({ assigned: 1, removed: 0, clearedOldMarks: 0 });
  const user = userEvent.setup();
  render(<MemoryRouter><AttendanceTracker /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Attendance Tracker' });
  await user.click(screen.getByRole('combobox', { name: 'Select Training Session' }));
  await user.click(await screen.findByRole('option', { name: /Ledger Basics/ }));
  await screen.findByText('Amelia Brown');
  return user;
};

const record = (attendee_id, user) => ({ attendee_id, attendance_status_id: 1, marked_at: '2026-10-14T09:40:00', notes: '', user });

beforeEach(() => jest.clearAllMocks());

describe('Clear', () => {
  test('only appears for people who have been marked, and removes the mark', async () => {
    const user = await setup({ records: [record(1, AMELIA)] });
    expect(screen.getByRole('button', { name: 'Clear - Amelia Brown' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear - Oliver Patel' })).not.toBeInTheDocument();
    service.getSessionAttendanceRecords.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Clear - Amelia Brown' }));
    await waitFor(() => expect(service.clearAttendanceRecord).toHaveBeenCalledWith('s1', 'p1', 1, { removeWalkInAssignment: false }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear - Amelia Brown' })).not.toBeInTheDocument());
    expect(screen.getAllByText('Not Marked')).toHaveLength(2);
  });

  test('a failure to clear shows a message', async () => {
    const user = await setup({ records: [record(1, AMELIA)] });
    service.clearAttendanceRecord.mockRejectedValue(new Error('denied'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Clear - Amelia Brown' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to clear attendance. Please try again.');
  });

  test('clearing someone who was added to the session as a walk-in also removes the booking made for them', async () => {
    const booked = { id: 'a3', attendee_id: 9, added_as_walk_in: true, user: WANDA };
    const user = await setup({ attendees: [...ATTENDEES, booked], records: [record(9, WANDA)] });
    expect(screen.getByText('Walk-in')).toBeInTheDocument();
    const clear = screen.getByRole('button', { name: 'Clear - Wanda Walker' });
    expect(clear).toHaveAttribute('title', 'Remove this walk-in and the booking made for them');
    await user.click(clear);
    await waitFor(() => expect(service.clearAttendanceRecord).toHaveBeenCalledWith('s1', 'p1', 9, { removeWalkInAssignment: true }));
  });
});

describe('walk-ins', () => {
  const openDialog = async (user) => {
    await user.click(screen.getByRole('button', { name: /Add walk-in/ }));
    return screen.findByRole('dialog');
  };
  const pick = async (user, dialog, name = /Wanda Walker/) => {
    await user.type(within(dialog).getByLabelText('Search people'), 'wan');
    await user.click(await within(dialog).findByRole('button', { name }));
  };

  test('someone with a record but no booking shows as Not assigned, with a Walk-ins tile', async () => {
    await setup({ records: [record(9, WANDA)], summary: { total_registered: 2, total_attended: 0, total_absent: 0, total_walk_ins: 1, attendance_rate: 0 } });
    expect(await screen.findByText('Wanda Walker')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.getByText('Walk-ins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear - Wanda Walker' })).toHaveAttribute('title', 'Remove this walk-in');
  });

  test('someone not booked anywhere is assigned to the session, tagged as a walk-in, then marked', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([{ id: 1, ...AMELIA }, WANDA]);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Search people'), 'wan');
    const list = await within(dialog).findByRole('list', { name: 'People found' });
    expect(await within(list).findByText('Wanda Walker')).toBeInTheDocument();
    expect(within(list).queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/1 already on this session's list/)).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: /Wanda Walker/ }));
    expect(loadWalkInContext).toHaveBeenCalledWith({ session: expect.objectContaining({ id: 's1', schedule_id: 'sch1' }), endUserId: 9 });
    expect(await within(dialog).findByRole('radio', { name: /Assign them to this session/ })).toBeChecked();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveTextContent('Present');
    await user.type(within(dialog).getByLabelText('Comments'), 'Came with the Leeds group');
    service.getSessionAttendanceRecords.mockResolvedValue([record(9, WANDA)]);
    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));

    await waitFor(() => expect(applyWalkInPlan).toHaveBeenCalledTimes(1));
    const { plan, projectId, endUserId, absentStatusIds } = applyWalkInPlan.mock.calls[0][0];
    expect([projectId, endUserId, absentStatusIds]).toEqual(['p1', 9, [2]]);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.newRows).toHaveLength(1);
    expect(plan.newRows[0]).toMatchObject({ end_user_id: 9, session_id: 's1', assignment_method: 'walk-in', assignment_source: 'attendance' });
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
    expect(service.markSingleAttendance.mock.calls[0][2]).toMatchObject({ attendee_id: 9, attendance_status_id: 1, notes: 'Came with the Leeds group', marked_by: 'u1' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('someone booked on the same course at another session is offered a move, and the move is the default', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    loadWalkInContext.mockResolvedValue({ existingRows: [{ id: 'r1', session_id: 'o1', course_id: 'C1' }], existingSessions: [OLD], targetParts: [T1], seatRows: [] });
    const dialog = await openDialog(user);
    await pick(user, dialog);
    expect(await within(dialog).findByText(/Wanda Walker is booked on Ledger Basics, Group 1 \(.*, Leeds\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Move them to this session/ })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /Attend this one as well/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Attendance only/ })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));
    await waitFor(() => expect(applyWalkInPlan).toHaveBeenCalledTimes(1));
    const { plan } = applyWalkInPlan.mock.calls[0][0];
    expect(plan.deleteIds).toEqual(['r1']);
    expect(plan.oldSessionIds).toEqual(['o1']);
    expect(plan.newRows.map((row) => row.session_id)).toEqual(['s1']);
    expect(plan.newRows[0].assignment_method).toBe('manual');
    expect(plan.newRows[0].notes).toMatch(/Moved from Group 1 \(Leeds\) to Group 2 \(London\)/);
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
  });

  test('"Attendance only" records the person without touching any booking', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    const dialog = await openDialog(user);
    await pick(user, dialog);
    await user.click(await within(dialog).findByRole('radio', { name: /Attendance only/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
    expect(applyWalkInPlan).not.toHaveBeenCalled();
  });

  test('a full session gets a warning but can still be chosen', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    loadWalkInContext.mockResolvedValue({ ...NO_BOOKINGS, seatRows: [{ session_id: 's1', end_user_id: 1 }, { session_id: 's1', end_user_id: 2 }] });
    const dialog = await openDialog(user);
    await pick(user, dialog);
    expect(await within(dialog).findByText(/This session is already full \(2 of 2 seats\)\. They will be added anyway\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add walk-in' })).toBeEnabled();
    await user.click(within(dialog).getByRole('radio', { name: /Attendance only/ }));
    expect(within(dialog).queryByText(/already full/)).not.toBeInTheDocument();
  });

  test('if bookings cannot be checked, they can still be recorded as attendance only', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    loadWalkInContext.mockRejectedValue(new Error('This session is not part of a schedule, so bookings cannot be checked'));
    const dialog = await openDialog(user);
    await pick(user, dialog);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not check their bookings');
    expect(within(dialog).queryByRole('radio', { name: /Move them/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Attendance only/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
    expect(applyWalkInPlan).not.toHaveBeenCalled();
  });

  test('if the booking cannot be saved, the dialog stays open, shows why, and nothing is marked', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    applyWalkInPlan.mockRejectedValue(new Error('Expected to remove 1 assignments but removed 0'));
    const dialog = await openDialog(user);
    await pick(user, dialog);
    await user.click(await within(dialog).findByRole('button', { name: 'Add walk-in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Expected to remove 1 assignments but removed 0');
    expect(service.markSingleAttendance).not.toHaveBeenCalled();
  });

  test('if the booking is saved but the mark fails, the message says so', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    service.markSingleAttendance.mockRejectedValue(new Error('network down'));
    const dialog = await openDialog(user);
    await pick(user, dialog);
    await user.click(await within(dialog).findByRole('button', { name: 'Add walk-in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Wanda Walker's booking was updated, but their attendance could not be saved");
  });

  test('the dialog asks for at least two letters before searching, and Change goes back to the search', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText('Type at least two letters to search')).toBeInTheDocument();
    await pick(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(within(dialog).getByLabelText('Search people')).toBeInTheDocument();
  });
});
