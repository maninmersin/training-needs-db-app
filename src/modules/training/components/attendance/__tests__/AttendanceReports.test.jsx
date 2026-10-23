/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import AttendanceReports from '../AttendanceReports';
import { useProject } from '@core/contexts/ProjectContext';
import * as service from '../../../services/attendanceService';
import { searchUserDirectory } from '../../../services/userDirectoryService';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('../../../services/attendanceService', () => ({
  getAttendanceStatistics: jest.fn(),
  exportAttendanceData: jest.fn(),
  getSessionsForAttendance: jest.fn(),
  getSessionAttendanceRecords: jest.fn(),
  getAttendeeHistory: jest.fn()
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

const STATS = {
  overall: { total_records: 20, total_present: 15, total_absent: 5, attendance_rate: 75 },
  by_functional_area: { Finance: { total: 12, present: 11, attendance_rate: 91.67 }, HR: { total: 8, present: 4, attendance_rate: 50 } }
};
const SESSIONS = [
  { id: 's1', course_name: 'Ledger Basics', start_datetime: '2026-10-12T09:30:00', training_location: 'London', classroom_number: 2, functional_area: 'Finance' },
  { id: 's2', course_name: 'Onboarding', start_datetime: '2026-10-14T13:30:00', training_location: 'Leeds', classroom_number: 1, functional_area: 'HR' }
];
const PRESENT = { status_name: 'Present', is_present: true, color_code: '#16a34a' };
const ABSENT = { status_name: 'Absent', is_present: false, color_code: '#dc2626' };
const WANDA = { id: 9, name: 'Wanda Walker', email: 'w@x.com', project_role: 'Buyer', training_location: 'London' };

const setup = async ({ stats = STATS } = {}) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
  service.getAttendanceStatistics.mockResolvedValue(stats);
  service.getSessionsForAttendance.mockResolvedValue(SESSIONS);
  service.getSessionAttendanceRecords.mockResolvedValue([
    { id: 'r1', attendee_id: 1, status: PRESENT, notes: 'On time', user: { name: 'Amelia Brown' } },
    { id: 'r2', attendee_id: 2, status: ABSENT, notes: '', user: { name: 'Oliver Patel' } }
  ]);
  service.getAttendeeHistory.mockResolvedValue([
    { id: 'h1', status: PRESENT, notes: '', session: { course_name: 'Ledger Basics', start_datetime: '2026-10-12T09:30:00', training_location: 'London' } },
    { id: 'h2', status: ABSENT, notes: 'Sick', session: { course_name: 'Onboarding', start_datetime: '2026-10-14T13:30:00', training_location: 'Leeds' } }
  ]);
  service.exportAttendanceData.mockResolvedValue([{ Name: 'Amelia Brown', Status: 'Present' }]);
  searchUserDirectory.mockResolvedValue([WANDA]);
  const user = userEvent.setup();
  render(<AttendanceReports />);
  await screen.findByRole('heading', { name: 'Attendance Reports & Analytics' });
  return user;
};

const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

beforeEach(() => jest.clearAllMocks());

describe('AttendanceReports', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    render(<AttendanceReports />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('the overview shows the totals and a card per functional area with its band', async () => {
    await setup();
    expect(screen.getByText('Total Records').previousSibling).toHaveTextContent('20');
    // the totals tiles come before the area cards, which repeat the words Present and Absent
    expect(screen.getAllByText('Present')[0].previousSibling).toHaveTextContent('15');
    expect(screen.getAllByText('Absent')[0].previousSibling).toHaveTextContent('5');
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'Finance attendance' })).toHaveAttribute('aria-valuenow', '92');
    expect(screen.getByRole('progressbar', { name: 'HR attendance' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  test('when there is no attendance at all it says so instead of showing empty cards', async () => {
    await setup({ stats: { totalRecords: 0, totalPresent: 0, totalAbsent: 0, overallAttendanceRate: 0 } });
    expect(screen.getByText('No Attendance Data Available')).toBeInTheDocument();
  });

  test('a failed load shows a message and can be dismissed', async () => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
    service.getAttendanceStatistics.mockRejectedValue(new Error('boom'));
    service.getSessionsForAttendance.mockResolvedValue([]);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AttendanceReports />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load attendance reports');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('changing a filter reloads the statistics with it, and Reset clears it', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Start Date'), '2026-10-01');
    await waitFor(() => expect(service.getAttendanceStatistics).toHaveBeenLastCalledWith('p1', expect.objectContaining({ startDate: '2026-10-01' })));
    await user.click(screen.getByRole('button', { name: 'Reset Filters' }));
    await waitFor(() => expect(service.getAttendanceStatistics).toHaveBeenLastCalledWith('p1', { startDate: '', endDate: '', functionalArea: '', trainingLocation: '' }));
  });

  test('the area filter lists the areas from the sessions and is passed on', async () => {
    const user = await setup();
    await user.click(screen.getByRole('combobox', { name: 'Functional Area' }));
    await user.click(await screen.findByRole('option', { name: 'HR' }));
    await waitFor(() => expect(service.getAttendanceStatistics).toHaveBeenLastCalledWith('p1', expect.objectContaining({ functionalArea: 'HR' })));
  });

  test('By Session lists the sessions, follows the filters, and View Details shows who attended with their names and status', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'By Session' }));
    expect(await screen.findByText('Ledger Basics')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Training Location' }));
    await user.click(await screen.findByRole('option', { name: 'Leeds' }));
    await waitFor(() => expect(screen.queryByText('Ledger Basics')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'View details - Onboarding' }));
    const dialog = await screen.findByRole('dialog');
    expect(service.getSessionAttendanceRecords).toHaveBeenCalledWith('s2', 'p1');
    expect(await within(dialog).findByText('Amelia Brown')).toBeInTheDocument();
    expect(within(dialog).getByText('Oliver Patel')).toBeInTheDocument();
    expect(within(dialog).getByText('On time')).toBeInTheDocument();
    expect(within(dialog).getByText('Absent')).toBeInTheDocument();
  });

  test('Individual: search for a person, pick them, and see their numbers and history', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Individual' }));
    expect(await screen.findByText('Type at least two letters to search')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search for an attendee'), 'wan');
    await user.click(await screen.findByRole('button', { name: /Wanda Walker/ }));
    expect(service.getAttendeeHistory).toHaveBeenCalledWith(9, 'p1', { startDate: '', endDate: '' });
    expect(await screen.findByText('Sessions Attended')).toBeInTheDocument();
    expect(screen.getByText('Attendance Rate').previousSibling).toHaveTextContent('50%');
    expect(screen.getByText('Sessions Attended').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Sessions Missed').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Sick')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change person' }));
    expect(screen.getByLabelText('Search for an attendee')).toBeInTheDocument();
  });

  test('Export CSV downloads the report data', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toMatch(/^attendance-report-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await readBlob(saveAs.mock.calls[0][0])).toBe('Name,Status\r\nAmelia Brown,Present');
  });

  test('Export Excel downloads an .xlsx file', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Excel (.xlsx)' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toMatch(/\.xlsx$/);
  });

  test('exporting with nothing to export downloads nothing', async () => {
    const user = await setup();
    service.exportAttendanceData.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    await waitFor(() => expect(service.exportAttendanceData).toHaveBeenCalled());
    expect(saveAs).not.toHaveBeenCalled();
  });

  test('a failed export shows a message', async () => {
    const user = await setup();
    service.exportAttendanceData.mockRejectedValue(new Error('nope'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to export attendance data');
  });
});

describe('AttendanceReports breakdowns', () => {
  const group = (total, present) => ({ total, present, attendance_rate: (present / total) * 100 });
  const ONE_AREA = {
    overall: { total_records: 20, total_present: 15, total_absent: 5, attendance_rate: 75 },
    by_functional_area: { 'Supply Chain': group(20, 15) },
    by_training_location: { London: group(12, 10), Manchester: group(8, 5) },
    by_course: { 'Inventory Mgt': group(10, 8), Outbound: group(10, 7) }
  };

  test('with only one functional area it opens on a breakdown that actually splits the numbers', async () => {
    await setup({ stats: ONE_AREA });
    expect(screen.getByRole('heading', { name: 'Attendance by Training Location' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'London attendance' })).toHaveAttribute('aria-valuenow', '83');
    expect(screen.getByRole('progressbar', { name: 'Manchester attendance' })).toHaveAttribute('aria-valuenow', '63');
    expect(screen.getByRole('button', { name: 'Training Location' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the buttons switch between functional area, location and course', async () => {
    const user = await setup({ stats: ONE_AREA });
    await user.click(screen.getByRole('button', { name: 'Course' }));
    expect(screen.getByRole('heading', { name: 'Attendance by Course' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Inventory Mgt attendance' })).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByRole('progressbar', { name: 'Outbound attendance' })).toHaveAttribute('aria-valuenow', '70');
    await user.click(screen.getByRole('button', { name: 'Functional Area' }));
    expect(screen.getByRole('heading', { name: 'Attendance by Functional Area' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Supply Chain attendance' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'London attendance' })).not.toBeInTheDocument();
  });

  test('a choice you made is kept when the filters reload the numbers', async () => {
    const user = await setup({ stats: ONE_AREA });
    await user.click(screen.getByRole('button', { name: 'Course' }));
    await user.type(screen.getByLabelText('Start Date'), '2026-10-01');
    await waitFor(() => expect(service.getAttendanceStatistics).toHaveBeenLastCalledWith('p1', expect.objectContaining({ startDate: '2026-10-01' })));
    expect(screen.getByRole('heading', { name: 'Attendance by Course' })).toBeInTheDocument();
  });

  test('the empty statistics from the service show the no-data message', async () => {
    const { EMPTY_STATISTICS } = require('../../../services/attendanceGroups');
    await setup({ stats: EMPTY_STATISTICS });
    expect(screen.getByText('No Attendance Data Available')).toBeInTheDocument();
  });
});
