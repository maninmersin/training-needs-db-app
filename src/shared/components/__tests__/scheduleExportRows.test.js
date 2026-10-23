import { calendarRows, detailedRows, getDateRange, metadataRows, rowsFor, sortSessions, summaryRows, toExportSession, visualRows } from '../scheduleExportRows';

const row = (id, extra = {}) => ({
  id, course_id: 'c1', course_name: 'Budgeting', session_number: 2, session_title: null, training_location: 'Dubai Office', classroom_number: 3,
  functional_area: 'Finance', group_name: 'Dubai - Classroom 3', duration_hrs: 3, instructor_name: 'Tess', max_attendees: 12, assigned_attendees: 5, notes: '',
  start_datetime: '2026-10-05T09:30:00+00:00', end_datetime: '2026-10-05T12:30:00+00:00', ...extra
});
const schedule = (sessions) => ({ name: 'Wave One', created_at: '2026-10-01T09:00:00Z', version: '20261001090000', criteria: { default: { max_attendees: 10, total_weeks: 5 } }, sessions });

describe('toExportSession', () => {
  test('maps a saved session, keeping the stored wall-clock time', () => {
    const s = toExportSession(row('s1'));
    expect(s).toMatchObject({
      title: 'Budgeting - Group 2', course_name: 'Budgeting', location: 'Dubai Office', classroom: 'Classroom 3', trainer_name: 'Tess',
      max_participants: 12, current_participants: 5, duration: 3
    });
    expect(s.start.getHours()).toBe(9);
    expect(s.start.getMinutes()).toBe(30);
    expect(s.end.getHours()).toBe(12);
  });

  test('uses the saved title when there is one, and copes with missing values', () => {
    const s = toExportSession(row('s2', { session_title: 'Custom', classroom_number: null, instructor_name: null, max_attendees: null, max_participants: null, assigned_attendees: null, start_datetime: null }));
    expect(s).toMatchObject({ title: 'Custom', classroom: '', trainer_name: '', max_participants: '', current_participants: 0, start: null });
  });
});

describe('sheets', () => {
  const schedules = [schedule([toExportSession(row('a')), toExportSession(row('b', { course_name: 'Ledger', start_datetime: '2026-10-06T09:30:00+00:00', end_datetime: '2026-10-06T12:30:00+00:00' }))])];

  test('summary: counts the sessions (it used to say 0), courses, dates and locations', () => {
    expect(summaryRows(schedules)).toEqual([{
      'Schedule Name': 'Wave One', 'Created Date': '01/10/2026', Version: '20261001090000', 'Total Sessions': 2, 'Unique Courses': 2,
      'Date Range': '05/10/2026 - 06/10/2026', Locations: 'Dubai Office'
    }]);
  });

  test('detailed: one row per session with the useful columns', () => {
    const rows = detailedRows(schedules);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      'Schedule Name': 'Wave One', 'Session Title': 'Budgeting - Group 2', 'Course Name': 'Budgeting', 'Start Date': '05/10/2026', 'Start Time': '09:30:00',
      'End Time': '12:30:00', 'Duration (hrs)': 3, Location: 'Dubai Office', Classroom: 'Classroom 3', 'Trainer Name': 'Tess', 'Max Participants': 12, 'Assigned Participants': 5
    });
  });

  test('visual: readable times and participants', () => {
    expect(visualRows(schedules)[0]).toMatchObject({ Time: '09:30:00 - 12:30:00', Duration: '3h', Participants: '5/12', Trainer: 'Tess' });
  });

  test('calendar: Outlook columns, with real line breaks in the description', () => {
    const first = calendarRows(schedules)[0];
    expect(first).toMatchObject({ Subject: 'Budgeting - Group 2', Location: 'Dubai Office - Classroom 3', 'All Day Event': 'False', Categories: 'Finance' });
    expect(first.Description.split('\n')).toEqual(['Course: Budgeting', 'Group: Dubai - Classroom 3', 'Duration: 3 hours', 'Trainer: Tess', 'Max Participants: 12']);
  });

  test('rowsFor picks the sheet by format, detailed by default', () => {
    expect(rowsFor('summary', schedules)).toHaveLength(1);
    expect(rowsFor('calendar', schedules)[0]).toHaveProperty('Subject');
    expect(rowsFor('anything', schedules)[0]).toHaveProperty('Session Title');
  });

  test('a schedule with no sessions gives a summary line and no session rows', () => {
    const empty = [schedule([])];
    expect(summaryRows(empty)[0]).toMatchObject({ 'Total Sessions': 0, 'Date Range': 'N/A', Locations: 'N/A' });
    expect(detailedRows(empty)).toEqual([]);
  });
});

describe('getDateRange and sortSessions', () => {
  test('a single day shows once; no dates gives N/A', () => {
    const day = toExportSession(row('a'));
    expect(getDateRange([day, day])).toBe('05/10/2026');
    expect(getDateRange([])).toBe('N/A');
    expect(getDateRange([{ start: null }])).toBe('N/A');
  });

  test('sessions sort by start time', () => {
    const early = toExportSession(row('e'));
    const late = toExportSession(row('l', { start_datetime: '2026-10-09T09:30:00+00:00' }));
    expect(sortSessions([late, early]).map((s) => s.id)).toEqual(['e', 'l']);
  });
});

describe('metadataRows', () => {
  test('lists the export details and each schedule\'s criteria', () => {
    const rows = metadataRows([schedule([toExportSession(row('a'))])], { exportFormat: 'detailed', fileFormat: 'xlsx', now: new Date('2026-10-23T10:00:00Z') });
    expect(rows.find((r) => r.Property === 'Export Date').Value).toBe('2026-10-23T10:00:00.000Z');
    expect(rows.find((r) => r.Property === 'Total Sessions').Value).toBe(1);
    expect(rows.find((r) => r.Property === '  Max Attendees').Value).toBe(10);
    expect(rows.find((r) => r.Property === '  Daily Hours')).toBeUndefined(); // not set, not listed
  });
});
