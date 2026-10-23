/** @jest-environment jsdom */
// Clear and Add walk-in on the Attendance Tracker
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttendanceTracker from '../AttendanceTracker';
import { useProject } from '@core/contexts/ProjectContext';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import * as service from '../../../services/attendanceService';
import { searchUserDirectory } from '../../../services/userDirectoryService';

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

const SESSIONS = [{ id: 's1', course_name: 'Ledger Basics', start_datetime: '2026-10-12T09:30:00', training_location: 'London', functional_area: 'Finance', classroom_number: 2 }];
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

const setup = async ({ records = [], summary } = {}) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
  SimpleAuthService.getCurrentUser.mockResolvedValue({ id: 'u1' });
  service.getSessionsForAttendance.mockResolvedValue(SESSIONS);
  service.getAttendanceStatuses.mockResolvedValue(STATUSES);
  service.getSessionAttendees.mockResolvedValue(ATTENDEES);
  service.getSessionAttendanceRecords.mockResolvedValue(records);
  service.getSessionAttendanceSummary.mockResolvedValue(summary || { total_registered: 2, total_attended: 0, total_absent: 0, total_walk_ins: 0, attendance_rate: 0 });
  service.markSingleAttendance.mockResolvedValue({});
  service.clearAttendanceRecord.mockResolvedValue(true);
  searchUserDirectory.mockResolvedValue([]);
  const user = userEvent.setup();
  render(<AttendanceTracker />);
  await screen.findByRole('heading', { name: 'Attendance Tracker' });
  await user.click(screen.getByRole('combobox', { name: 'Select Training Session' }));
  await user.click(await screen.findByRole('option', { name: /Ledger Basics/ }));
  await screen.findByText('Amelia Brown');
  return user;
};

const record = (attendee_id, user) => ({ attendee_id, attendance_status_id: 1, marked_at: '2026-10-12T09:40:00', notes: '', user });

beforeEach(() => jest.clearAllMocks());

describe('Clear', () => {
  test('only appears for people who have been marked, and removes the mark', async () => {
    const user = await setup({ records: [record(1, AMELIA)] });
    expect(screen.getByRole('button', { name: 'Clear - Amelia Brown' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear - Oliver Patel' })).not.toBeInTheDocument();
    service.getSessionAttendanceRecords.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Clear - Amelia Brown' }));
    await waitFor(() => expect(service.clearAttendanceRecord).toHaveBeenCalledWith('s1', 'p1', 1));
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
});

describe('walk-ins', () => {
  const openDialog = async (user) => {
    await user.click(screen.getByRole('button', { name: /Add walk-in/ }));
    return screen.findByRole('dialog');
  };

  test('a walk-in already on the records shows as Not assigned, with a Walk-ins tile, and can be cleared', async () => {
    await setup({ records: [record(9, WANDA)], summary: { total_registered: 2, total_attended: 0, total_absent: 0, total_walk_ins: 1, attendance_rate: 0 } });
    expect(await screen.findByText('Wanda Walker')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.getByText('Walk-ins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear - Wanda Walker' })).toHaveAttribute('title', 'Remove this walk-in');
  });

  test('search, pick someone, choose a status: they are recorded without being assigned', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([{ id: 1, ...AMELIA }, WANDA]);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Search people'), 'wan');
    const list = await within(dialog).findByRole('list', { name: 'People found' });
    expect(await within(list).findByText('Wanda Walker')).toBeInTheDocument();
    expect(within(list).queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/1 already on this session's list/)).toBeInTheDocument();
    expect(searchUserDirectory).toHaveBeenLastCalledWith('p1', 'wan');

    await user.click(within(list).getByRole('button', { name: /Wanda Walker/ }));
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveTextContent('Present');
    await user.type(within(dialog).getByLabelText('Comments'), 'Came with the Leeds group');
    service.getSessionAttendanceRecords.mockResolvedValue([record(9, WANDA)]);
    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
    expect(service.markSingleAttendance.mock.calls[0][0]).toBe('s1');
    expect(service.markSingleAttendance.mock.calls[0][2]).toMatchObject({ attendee_id: 9, attendance_status_id: 1, notes: 'Came with the Leeds group', marked_by: 'u1' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Wanda Walker')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
  });

  test('a walk-in that fails to save stays open and shows the reason', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    service.markSingleAttendance.mockRejectedValue(new Error('permission denied'));
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Search people'), 'wan');
    await user.click(await within(dialog).findByRole('button', { name: /Wanda Walker/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add walk-in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('permission denied');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('the dialog asks for at least two letters before searching, and Change goes back to the search', async () => {
    const user = await setup();
    searchUserDirectory.mockResolvedValue([WANDA]);
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText('Type at least two letters to search')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Search people'), 'wan');
    await user.click(await within(dialog).findByRole('button', { name: /Wanda Walker/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(within(dialog).getByLabelText('Search people')).toBeInTheDocument();
  });
});
