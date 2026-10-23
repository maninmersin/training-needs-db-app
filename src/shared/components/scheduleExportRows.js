import { fromLocalDateTime } from '@core/utils/dateTimeUtils';

// Pure builders for the schedule Excel/CSV export. A "schedule" here is a training_schedules row with
// `sessions` = its training_sessions rows (as stored in the database).

const toDate = (value) => {
  try {
    return fromLocalDateTime(value); // keeps the wall-clock time, no time zone shift
  } catch {
    return null;
  }
};
const date = (value) => (value ? value.toLocaleDateString('en-GB') : '');
const time = (value) => (value ? value.toLocaleTimeString('en-GB') : '');

/** A saved session in the shape the export sheets use. */
export function toExportSession(row) {
  const start = toDate(row.start_datetime);
  const end = toDate(row.end_datetime);
  return {
    id: row.id,
    title: row.session_title || `${row.course_name} - Group ${row.session_number}`,
    custom_title: row.session_title || '',
    course_id: row.course_id,
    course_name: row.course_name,
    start,
    end,
    duration: row.duration_hrs,
    location: row.training_location,
    classroom: row.classroom_number ? `Classroom ${row.classroom_number}` : '',
    group_name: row.group_name || '',
    functional_area: row.functional_area,
    session_number: row.session_number,
    trainer_name: row.instructor_name || '',
    max_participants: row.max_attendees ?? row.max_participants ?? '',
    current_participants: row.assigned_attendees || 0,
    notes: row.notes || ''
  };
}

/** Earliest and latest session day, as text. */
export function getDateRange(sessions) {
  const starts = (sessions || []).map((session) => session.start).filter(Boolean).sort((a, b) => a - b);
  if (starts.length === 0) return 'N/A';
  const first = date(starts[0]);
  const last = date(starts[starts.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

const unique = (values) => [...new Set(values.filter(Boolean))];

export function summaryRows(schedules) {
  return schedules.map((schedule) => ({
    'Schedule Name': schedule.name,
    'Created Date': schedule.created_at ? new Date(schedule.created_at).toLocaleDateString('en-GB') : '',
    Version: schedule.version || 'v1.0',
    'Total Sessions': schedule.sessions.length,
    'Unique Courses': unique(schedule.sessions.map((session) => session.course_name)).length,
    'Date Range': getDateRange(schedule.sessions),
    Locations: unique(schedule.sessions.map((session) => session.location)).join(', ') || 'N/A'
  }));
}

const eachSession = (schedules, build) => schedules.flatMap((schedule) => schedule.sessions.map((session) => build(schedule, session)));

export function detailedRows(schedules) {
  return eachSession(schedules, (schedule, session) => ({
    'Schedule Name': schedule.name,
    'Session Title': session.title,
    'Course Name': session.course_name,
    'Start Date': date(session.start),
    'Start Time': time(session.start),
    'End Date': date(session.end),
    'End Time': time(session.end),
    'Duration (hrs)': session.duration,
    Location: session.location || 'TBD',
    Classroom: session.classroom,
    'Group Name': session.group_name,
    'Functional Area': session.functional_area,
    'Group Number': session.session_number,
    'Course ID': session.course_id,
    'Trainer Name': session.trainer_name,
    'Max Participants': session.max_participants,
    'Assigned Participants': session.current_participants,
    Notes: session.notes
  }));
}

export function visualRows(schedules) {
  return eachSession(schedules, (schedule, session) => ({
    Schedule: schedule.name,
    Session: session.title,
    Course: session.course_name,
    Date: date(session.start),
    Time: `${time(session.start)} - ${time(session.end)}`,
    Duration: `${session.duration}h`,
    Location: session.location || 'TBD',
    Classroom: session.classroom,
    Trainer: session.trainer_name || 'Not Assigned',
    Participants: session.max_participants ? `${session.current_participants}/${session.max_participants}` : 'N/A',
    Group: session.group_name,
    Area: session.functional_area,
    Notes: session.notes
  }));
}

/** Columns Outlook's "import a CSV" understands. The description has real line breaks. */
export function calendarRows(schedules) {
  return eachSession(schedules, (schedule, session) => {
    const description = [`Course: ${session.course_name}`, `Group: ${session.group_name || session.session_number}`, `Duration: ${session.duration} hours`];
    if (session.trainer_name) description.push(`Trainer: ${session.trainer_name}`);
    if (session.max_participants) description.push(`Max Participants: ${session.max_participants}`);
    if (session.notes) description.push(`Notes: ${session.notes}`);
    return {
      Subject: session.title,
      'Start Date': date(session.start),
      'Start Time': time(session.start),
      'End Date': date(session.end),
      'End Time': time(session.end),
      Description: description.join('\n'),
      Location: [session.location || 'TBD', session.classroom].filter(Boolean).join(' - '),
      'All Day Event': 'False',
      Categories: session.functional_area || 'Training'
    };
  });
}

/** The extra "Export Metadata" sheet. */
export function metadataRows(schedules, { exportFormat, fileFormat, now = new Date() }) {
  const rows = [
    { Property: 'Export Date', Value: now.toISOString() },
    { Property: 'Export Format', Value: exportFormat },
    { Property: 'File Format', Value: fileFormat },
    { Property: 'Schedules Exported', Value: schedules.length },
    { Property: 'Total Sessions', Value: schedules.reduce((sum, schedule) => sum + schedule.sessions.length, 0) },
    { Property: 'Application', Value: 'Training Needs Analysis' }
  ];
  schedules.forEach((schedule, index) => {
    const criteria = schedule.criteria?.default || schedule.criteria;
    if (!criteria) return;
    rows.push({ Property: '', Value: '' });
    rows.push({ Property: `Schedule ${index + 1} Criteria`, Value: schedule.name });
    [['Max Attendees', criteria.max_attendees], ['Total Weeks', criteria.total_weeks], ['Daily Hours', criteria.daily_hours], ['Days Per Week', criteria.days_per_week], ['Start Date', criteria.start_date]]
      .filter(([, value]) => value)
      .forEach(([label, value]) => rows.push({ Property: `  ${label}`, Value: value }));
  });
  return rows;
}

export const SHEET_NAMES = { summary: 'Schedule Summary', detailed: 'Detailed Sessions', visual: 'Visual Schedule', calendar: 'Calendar Import' };

/** Rows for the chosen export format. */
export function rowsFor(exportFormat, schedules) {
  if (exportFormat === 'summary') return summaryRows(schedules);
  if (exportFormat === 'visual') return visualRows(schedules);
  if (exportFormat === 'calendar') return calendarRows(schedules);
  return detailedRows(schedules);
}

/** A session list is sorted by start so every sheet reads in date order. */
export function sortSessions(sessions) {
  return [...sessions].sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
}
