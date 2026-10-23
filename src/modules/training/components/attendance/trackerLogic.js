// Pure rules for the Attendance Tracker screen: which sessions and attendees to show. No React, no database.

/** Sessions matching the search text (course, location or functional area), ignoring case. */
export function filterSessions(sessions, searchTerm) {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return sessions;
  return sessions.filter((session) =>
    [session.course_name, session.training_location, session.functional_area].some((value) => String(value ?? '').toLowerCase().includes(needle))
  );
}

export const recordFor = (records, attendeeId) => records.find((record) => record.attendee_id === attendeeId);

/**
 * Attendees to show: people we have details for, matching the search (name or email) and the status filter
 * ('all' | 'unmarked' | 'present' | 'absent'). "Absent" means marked with a status that is not a present one.
 */
export function filterAttendees(attendees, records, statuses, searchTerm, filter) {
  const needle = searchTerm.trim().toLowerCase();
  const statusOf = (id) => statuses.find((status) => status.id === id);
  return attendees.filter((attendee) => {
    if (!attendee.user) return false;
    if (needle && !(attendee.user.name?.toLowerCase().includes(needle) || attendee.user.email?.toLowerCase().includes(needle))) return false;
    if (filter === 'all') return true;
    const record = recordFor(records, attendee.attendee_id);
    if (filter === 'unmarked') return !record;
    if (filter === 'present') return Boolean(record && statusOf(record.attendance_status_id)?.is_present);
    if (filter === 'absent') return Boolean(record && !statusOf(record.attendance_status_id)?.is_present);
    return true;
  });
}

export const FILTER_OPTIONS = [
  { value: 'all', label: 'All Attendees' },
  { value: 'unmarked', label: 'Not Marked' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' }
];

export const formatDateTime = (dateString) =>
  new Date(dateString).toLocaleString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const sessionLabel = (session) => `${session.course_name} - ${formatDateTime(session.start_datetime)} - ${session.training_location}`;
