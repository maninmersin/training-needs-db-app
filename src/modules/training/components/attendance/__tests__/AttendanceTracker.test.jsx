/** @jest-environment jsdom */
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

const SESSIONS = [
  { id: 's1', course_name: 'Ledger Basics', start_datetime: '2026-10-12T09:30:00', training_location: 'London', functional_area: 'Finance', classroom_number: 2 },
  { id: 's2', course_name: 'Stock Counts', start_datetime: '2026-10-13T09:30:00', training_location: 'Leeds', functional_area: 'Operations', classroom_number: 1 }
];
const STATUSES = [
  { id: 1, status_name: 'Present', is_present: true, color_code: '#16a34a' },
  { id: 2, status_name: 'Absent', is_present: false, color_code: '#dc2626' }
];
const ATTENDEES = [
  { id: 'a1', attendee_id: 1, user: { name: 'Amelia Brown', email: 'amelia@x.com' } },
  { id: 'a2', attendee_id: 2, user: { name: 'Oliver Patel', email: 'oliver@x.com' } }
];

const setup = async () => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
  SimpleAuthService.getCurrentUser.mockResolvedValue({ id: 'u1' });
  service.getSessionsForAttendance.mockResolvedValue(SESSIONS);
  service.getAttendanceStatuses.mockResolvedValue(STATUSES);
  service.getSessionAttendees.mockResolvedValue(ATTENDEES);
  service.getSessionAttendanceRecords.mockResolvedValue([]);
  service.getSessionAttendanceSummary.mockResolvedValue({ total_registered: 2, total_attended: 1, total_absent: 0, attendance_rate: 50 });
  service.markSingleAttendance.mockResolvedValue({});
  service.clearAttendanceRecord.mockResolvedValue(true);
  searchUserDirectory.mockResolvedValue([]);
  const user = userEvent.setup();
  render(<AttendanceTracker />);
  await screen.findByRole('heading', { name: 'Attendance Tracker' });
  return user;
};

const choose = async (user, name) => {
  await user.click(screen.getByRole('combobox', { name: 'Select Training Session' }));
  await user.click(await screen.findByRole('option', { name }));
};

beforeEach(() => jest.clearAllMocks());

describe('AttendanceTracker', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    SimpleAuthService.getCurrentUser.mockResolvedValue({ id: 'u1' });
    render(<AttendanceTracker />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('asks you to choose a session first', async () => {
    await setup();
    expect(screen.getByText('Choose a session')).toBeInTheDocument();
  });

  test('a failed load shows the same message as before', async () => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
    SimpleAuthService.getCurrentUser.mockResolvedValue({ id: 'u1' });
    service.getSessionsForAttendance.mockRejectedValue(new Error('boom'));
    service.getAttendanceStatuses.mockResolvedValue(STATUSES);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AttendanceTracker />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load sessions and attendance data');
  });

  test('choosing a session shows its attendees and the summary tiles', async () => {
    const user = await setup();
    await choose(user, /Ledger Basics/);
    expect(await screen.findByText('Amelia Brown')).toBeInTheDocument();
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
    expect(screen.getByText('Attendance for Ledger Basics')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(service.getSessionAttendees).toHaveBeenCalledWith('s1', 'p1');
    expect(screen.getAllByText('Not Marked')).toHaveLength(2);
  });

  test('the session filter narrows the choices', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Filter Sessions:'), 'leeds');
    await user.click(screen.getByRole('combobox', { name: 'Select Training Session' }));
    expect(await screen.findByRole('option', { name: /Stock Counts/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ledger Basics/ })).not.toBeInTheDocument();
  });

  test('marking someone sends their status, their comment and who marked, then refreshes and clears the comment', async () => {
    const user = await setup();
    await choose(user, /Ledger Basics/);
    await screen.findByText('Amelia Brown');
    service.getSessionAttendanceRecords.mockResolvedValue([{ attendee_id: 1, attendance_status_id: 1, marked_at: '2026-10-12T09:40:00', notes: 'Arrived early' }]);
    await user.type(screen.getByLabelText('Comments for Amelia Brown'), 'Arrived early');
    await user.click(screen.getByRole('button', { name: 'Present - Amelia Brown' }));
    await waitFor(() => expect(service.markSingleAttendance).toHaveBeenCalledTimes(1));
    const [sessionId, projectId, data] = service.markSingleAttendance.mock.calls[0];
    expect([sessionId, projectId]).toEqual(['s1', 'p1']);
    expect(data).toMatchObject({ attendee_id: 1, attendance_status_id: 1, notes: 'Arrived early', marked_by: 'u1' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Present - Amelia Brown' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByLabelText('Comments for Amelia Brown')).toHaveValue('');
    expect(screen.getByText(/Arrived early/)).toBeInTheDocument();
  });

  test('a failure to mark shows the message and keeps the screen', async () => {
    const user = await setup();
    await choose(user, /Ledger Basics/);
    await screen.findByText('Amelia Brown');
    service.markSingleAttendance.mockRejectedValue(new Error('nope'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Absent - Oliver Patel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to mark attendance. Please try again.');
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
  });

  test('searching attendees narrows the list', async () => {
    const user = await setup();
    await choose(user, /Ledger Basics/);
    await screen.findByText('Amelia Brown');
    await user.type(screen.getByLabelText('Search attendees'), 'patel');
    expect(screen.queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(screen.getByText('Oliver Patel')).toBeInTheDocument();
  });

  test('a session with nobody assigned says so', async () => {
    const user = await setup();
    service.getSessionAttendees.mockResolvedValue([]);
    await choose(user, /Ledger Basics/);
    expect(await screen.findByText('No attendees assigned to this session')).toBeInTheDocument();
  });
});
