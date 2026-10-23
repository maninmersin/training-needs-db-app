/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AttendanceComplianceDashboard from '../AttendanceComplianceDashboard';
import { useProject } from '@core/contexts/ProjectContext';
import * as service from '../../../services/attendanceService';

jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('../../../services/attendanceService', () => ({
  getAssignmentVsAttendanceStats: jest.fn(),
  getDrillDownStats: jest.fn(),
  getAttendanceGaps: jest.fn(),
  getUnscheduledAreas: jest.fn()
}));

beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const STATS = { overall: { total_assigned: 40, total_attended: 30, compliance_rate: 75, missing_attendance_records: 4 } };
const PROJECT_LEVEL = {
  drillDownData: {
    Finance: { assigned: 20, attended: 19, compliance_rate: 95, missing_records: 0 },
    HR: { assigned: 20, attended: 11, compliance_rate: 55, missing_records: 3 }
  },
  breadcrumb: [{ level: 'project', label: 'Project' }]
};
const AREA_LEVEL = {
  drillDownData: { London: { assigned: 12, attended: 12, compliance_rate: 100, missing_records: 0 } },
  breadcrumb: [{ level: 'project', label: 'Project' }, { level: 'functionalArea', value: 'Finance', label: 'Finance' }]
};
const GAPS = {
  summary: { total_issues: 2, missing_records_count: 1, low_compliance_count: 1 },
  missing_attendance_records: [{ session_id: 's-missing', session_name: 'Ledger Basics - 12/10/2026', training_location: 'London', functional_area: 'Finance', missing_count: 3, assigned_count: 5 }],
  low_compliance_sessions: [{ session_id: 's-low', session_name: 'Stock Counts - 13/10/2026', training_location: 'Leeds', functional_area: 'Operations', compliance_rate: 55, assigned: 10, attended: 5 }]
};

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const NOT_SCHEDULED = [{ functional_area: 'Procurement', people: 38, courses: 2 }, { functional_area: 'Payroll', people: 1, courses: 1 }];

const setup = async ({ drill = PROJECT_LEVEL, gaps = GAPS, unscheduled = [] } = {}) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
  service.getAssignmentVsAttendanceStats.mockResolvedValue(STATS);
  service.getDrillDownStats.mockImplementation(async (projectId, path) => (path.functionalArea ? AREA_LEVEL : drill));
  service.getAttendanceGaps.mockResolvedValue(gaps);
  service.getUnscheduledAreas.mockResolvedValue(unscheduled);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/attendance-compliance']}>
      <Routes>
        <Route path="/attendance-compliance" element={<AttendanceComplianceDashboard />} />
        <Route path="/attendance-tracker" element={<Where />} />
        <Route path="/training-scheduler" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'Attendance Compliance Dashboard' });
  return user;
};

beforeEach(() => jest.clearAllMocks());

describe('AttendanceComplianceDashboard', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    render(<MemoryRouter><AttendanceComplianceDashboard /></MemoryRouter>);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('shows the totals and a card for each functional area, with its compliance band', async () => {
    await setup();
    expect(screen.getByText('Total Assigned').previousSibling).toHaveTextContent('40');
    expect(screen.getByText('Actually Attended').previousSibling).toHaveTextContent('30');
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Missing Records').previousSibling).toHaveTextContent('4');
    expect(screen.getByRole('heading', { name: 'By Functional Area' })).toBeInTheDocument();
    const finance = screen.getByRole('button', { name: /Finance/ });
    expect(within(finance).getByText('95%')).toBeInTheDocument();
    expect(within(finance).getByText('Excellent')).toBeInTheDocument();
    const hr = screen.getByRole('button', { name: /HR/ });
    expect(within(hr).getByText('Critical')).toBeInTheDocument();
    expect(within(hr).getByText('3 missing attendance records')).toBeInTheDocument();
    expect(within(hr).getByRole('progressbar', { name: 'HR compliance' })).toHaveAttribute('aria-valuenow', '55');
  });

  test('clicking an area drills down, reloads for that area, and the breadcrumb goes back', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Finance/ }));
    expect(await screen.findByRole('heading', { name: 'By Training Location' })).toBeInTheDocument();
    expect(service.getAssignmentVsAttendanceStats).toHaveBeenLastCalledWith('p1', { functionalArea: 'Finance' });
    expect(service.getDrillDownStats).toHaveBeenLastCalledWith('p1', { functionalArea: 'Finance' }, {});
    expect(screen.getByRole('button', { name: /London/ })).toBeInTheDocument();
    const trail = screen.getByRole('navigation', { name: 'Drill-down' });
    expect(within(trail).getByRole('button', { name: 'Finance' })).toBeDisabled();
    await user.click(within(trail).getByRole('button', { name: 'Project' }));
    expect(await screen.findByRole('heading', { name: 'By Functional Area' })).toBeInTheDocument();
  });

  test('a date preset limits the data and shows as pressed', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'This Month' }));
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(service.getAssignmentVsAttendanceStats).toHaveBeenCalledTimes(2));
    const filters = service.getAssignmentVsAttendanceStats.mock.calls[1][1];
    expect(filters.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(filters.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('a custom start date is passed through', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Start date'), '2026-10-01');
    await waitFor(() => expect(service.getAssignmentVsAttendanceStats).toHaveBeenLastCalledWith('p1', { startDate: '2026-10-01' }));
  });

  test('the issues panel lists sessions that need attention, and clicking one opens it in the Attendance Tracker', async () => {
    const user = await setup();
    expect(screen.getByText('2 Total Issues')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Missing Attendance Records/ }));
    await user.click(await screen.findByRole('button', { name: /Ledger Basics - 12\/10\/2026/ }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/attendance-tracker?session=s-missing');
  });

  test('low compliance sessions show their rate and attendance', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Low Compliance Sessions/ }));
    const item = await screen.findByRole('button', { name: /Stock Counts - 13\/10\/2026/ });
    expect(within(item).getByText('55% Compliance')).toBeInTheDocument();
    expect(within(item).getByText(/5 of 10 attended/)).toBeInTheDocument();
  });

  test('with no issues it says so', async () => {
    await setup({ gaps: { summary: { total_issues: 0, missing_records_count: 0, low_compliance_count: 0 }, missing_attendance_records: [], low_compliance_sessions: [] } });
    expect(screen.getByText('No Issues Found')).toBeInTheDocument();
  });

  test('with no training data it says what to do first', async () => {
    await setup({ drill: { drillDownData: {}, breadcrumb: [] } });
    expect(screen.getByText('No Training Data Found')).toBeInTheDocument();
  });

  test('a failed load shows a message and can be dismissed', async () => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
    service.getAssignmentVsAttendanceStats.mockRejectedValue(new Error('boom'));
    service.getDrillDownStats.mockResolvedValue(PROJECT_LEVEL);
    service.getAttendanceGaps.mockResolvedValue(GAPS);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<MemoryRouter><AttendanceComplianceDashboard /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load attendance compliance data');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('areas with training needs but no sessions', () => {
  test('are listed as "Not scheduled yet" with how many people and courses are involved', async () => {
    await setup({ unscheduled: NOT_SCHEDULED });
    expect(screen.getByRole('heading', { name: 'Not scheduled yet (2)' })).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Not scheduled yet' });
    expect(within(section).getByText('Procurement')).toBeInTheDocument();
    expect(within(section).getByText('38', { selector: 'b' }).parentElement).toHaveTextContent('38 people need 2 courses');
    expect(within(section).getByRole('heading', { name: 'Payroll' }).parentElement.parentElement).toHaveTextContent('1 person needs 1 course');
    expect(service.getUnscheduledAreas).toHaveBeenCalledWith('p1', ['Finance', 'HR']);
  });

  test('Create a schedule opens the Schedule Creator', async () => {
    const user = await setup({ unscheduled: NOT_SCHEDULED });
    await user.click(within(screen.getByRole('region', { name: 'Not scheduled yet' })).getAllByRole('button', { name: /Create a schedule/ })[0]);
    expect(await screen.findByTestId('where')).toHaveTextContent('/training-scheduler?restart=true');
  });

  test('nothing is shown when every area has sessions', async () => {
    await setup({ unscheduled: [] });
    expect(screen.queryByRole('region', { name: 'Not scheduled yet' })).not.toBeInTheDocument();
  });

  test('they are hidden once a date range is chosen, because the sessions may just be outside it', async () => {
    const user = await setup({ unscheduled: NOT_SCHEDULED });
    expect(screen.getByRole('region', { name: 'Not scheduled yet' })).toBeInTheDocument();
    service.getUnscheduledAreas.mockClear();
    await user.click(screen.getByRole('button', { name: 'This Month' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Not scheduled yet' })).not.toBeInTheDocument());
    expect(service.getUnscheduledAreas).not.toHaveBeenCalled();
  });

  test('they are hidden when drilled into an area', async () => {
    const user = await setup({ unscheduled: NOT_SCHEDULED });
    await user.click(screen.getByRole('button', { name: /Finance/ }));
    await screen.findByRole('heading', { name: 'By Training Location' });
    expect(screen.queryByRole('region', { name: 'Not scheduled yet' })).not.toBeInTheDocument();
  });

  test('if they cannot be worked out the rest of the dashboard still works', async () => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'ACME Corp' } });
    service.getAssignmentVsAttendanceStats.mockResolvedValue(STATS);
    service.getDrillDownStats.mockResolvedValue(PROJECT_LEVEL);
    service.getAttendanceGaps.mockResolvedValue(GAPS);
    service.getUnscheduledAreas.mockRejectedValue(new Error('function does not exist'));
    render(<MemoryRouter><AttendanceComplianceDashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Finance/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Not scheduled yet' })).not.toBeInTheDocument();
  });
});
