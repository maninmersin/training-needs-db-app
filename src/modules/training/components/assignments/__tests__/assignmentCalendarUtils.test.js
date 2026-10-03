jest.mock('@core/utils/calendarInviteGenerator', () => ({
  generateTrainingCalendar: jest.fn(),
  downloadCalendarFile: jest.fn()
}));
jest.mock('@core/utils/consoleUtils', () => ({ debugLog: () => {}, debugWarn: () => {}, debugError: () => {} }));

import { generateTrainingCalendar, downloadCalendarFile } from '@core/utils/calendarInviteGenerator';
import { handleGenerateAssignmentCalendar } from '../assignmentCalendarUtils';

const sessions = [{ event_id: 'u1', title: 'Course A - Group 1' }];
const assignments = [{ end_user_id: 1, session_id: 'u1' }];

const run = async (schedule, projectId) => {
  const setGenerating = jest.fn();
  const setError = jest.fn();
  await handleGenerateAssignmentCalendar(schedule, sessions, assignments, setGenerating, setError, projectId);
  return { setGenerating, setError };
};

beforeEach(() => {
  jest.clearAllMocks();
  generateTrainingCalendar.mockResolvedValue({ success: true, content: 'ICS', filename: 'x.ics', eventCount: 1, userCount: 1 });
});

describe('handleGenerateAssignmentCalendar', () => {
  test('passes the project id on to the generator (the missing argument caused "Project ID is required")', async () => {
    await run({ id: 's1', name: 'Sched', project_id: 'proj-from-schedule' }, 'proj-from-panel');
    expect(generateTrainingCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }), sessions, assignments, 'proj-from-schedule'
    );
  });

  test('uses the project the panel is working in when the schedule record has none', async () => {
    await run({ id: 's1', name: 'Sched' }, 'proj-from-panel');
    expect(generateTrainingCalendar.mock.calls[0][3]).toBe('proj-from-panel');
  });

  test('downloads the file and reports success', async () => {
    const { setError } = await run({ id: 's1', name: 'Sched', project_id: 'p' });
    expect(downloadCalendarFile).toHaveBeenCalledWith('ICS', 'x.ics');
    expect(setError).toHaveBeenCalledWith(expect.stringContaining('Calendar downloaded: 1 sessions, 1 users'));
  });

  test('shows the generator\'s error instead of downloading', async () => {
    generateTrainingCalendar.mockResolvedValue({ success: false, error: 'No users with email addresses found for assignments' });
    const { setError, setGenerating } = await run({ id: 's1', name: 'Sched', project_id: 'p' });
    expect(downloadCalendarFile).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('No users with email addresses found for assignments');
    expect(setGenerating).toHaveBeenLastCalledWith(false);
  });
});
