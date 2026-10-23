import { fromLocalDateTime } from '@core/utils/dateTimeUtils';

// Pure rules for the Schedule Manager list and for opening a schedule in the editor.

/** Sessions in a schedule: the count from the list query ([{ count }]), or the loaded sessions when editing. */
export function sessionCountOf(schedule) {
  const counted = schedule.session_count;
  if (Array.isArray(counted) && counted.length > 0) return counted[0].count || 0;
  if (!schedule.sessions) return 0;
  return Array.isArray(schedule.sessions) ? schedule.sessions.length : 0;
}

/** Search by name (any case) and, optionally, by the day it was created (YYYY-MM-DD). */
export function filterSchedules(schedules, searchTerm, filterDate) {
  const term = (searchTerm || '').toLowerCase();
  return schedules.filter((schedule) => {
    const matchesSearch = (schedule.name || '').toLowerCase().includes(term);
    const matchesDate = !filterDate || (schedule.created_at || '').startsWith(filterDate);
    return matchesSearch && matchesDate;
  });
}

export function deleteSummary(count) {
  return `${count} schedule${count === 1 ? '' : 's'}`;
}

/**
 * Shape the saved sessions the way the editor and calendar expect them:
 * functional area > training location > "Classroom N" > [sessions].
 */
export function groupSessionsForEditor(sessions) {
  const grouped = {};
  (sessions || []).forEach((session) => {
    const area = session.functional_area;
    const location = session.training_location;
    const classroomKey = `Classroom ${session.classroom_number}`;
    grouped[area] = grouped[area] || {};
    grouped[area][location] = grouped[area][location] || {};
    grouped[area][location][classroomKey] = grouped[area][location][classroomKey] || [];

    grouped[area][location][classroomKey].push({
      course_id: session.course_id,
      course_name: session.course_name,
      sessionNumber: session.session_number,
      group_type: [],
      groupName: `${location} - Classroom ${session.classroom_number}`,
      // fromLocalDateTime keeps the wall-clock time (no time zone shift)
      start: fromLocalDateTime(session.start_datetime),
      end: fromLocalDateTime(session.end_datetime),
      duration: session.duration_hours || 1,
      functional_area: area,
      location,
      title: session.session_title || `${session.course_name} - Group ${session.session_number}`,
      custom_title: session.session_title || '',
      trainer_id: session.instructor_id || '',
      trainer_name: session.instructor_name || '',
      color: null, // the calendar picks colours
      text_color: null,
      background_color: null,
      notes: session.notes || '',
      max_participants: session.max_attendees,
      current_participants: session.current_attendees,
      event_id: session.id, // the database id, used to match assignments
      eventId: `${session.course_id}-session${session.session_number}-${String(location).replace(/\s+/g, '-').toLowerCase()}-${String(area).replace(/\s+/g, '-').toLowerCase()}`,
      calendarInstance: `${location} - Classroom ${session.classroom_number}-${area}`,
      totalParts: session.total_parts || 1,
      totalDays: session.course_day_sequence || 1,
      daySequence: session.course_day_sequence || 1,
      isMultiDay: session.is_multi_day_course || false,
      course: {
        id: session.course_id,
        course_id: session.course_id,
        course_name: session.course_name,
        duration_hrs: session.duration_hours || 1
      }
    });
  });
  return grouped;
}

/** Every session in the area > location > classroom structure, as one list. */
export function flattenSessions(sessionsByArea) {
  try {
    return Object.values(sessionsByArea || {})
      .flatMap((locations) => Object.values(locations || {}))
      .flatMap((classrooms) => Object.values(classrooms || {}))
      .flatMap((sessions) => sessions || []);
  } catch {
    return [];
  }
}

/** The figures under the editor: sessions, functional areas and different courses. */
export function editorStats(sessionsByArea) {
  const sessions = flattenSessions(sessionsByArea);
  const courses = new Set(sessions.map((session) => session.course?.course_name || session.course_name || 'Unknown Course'));
  return { totalSessions: sessions.length, functionalAreas: Object.keys(sessionsByArea || {}).length, uniqueCourses: courses.size };
}

/**
 * Tells the user when a course is longer than one morning or afternoon block and will be split.
 * `criteria` may be the saved object or its JSON text. Returns null for a single session.
 */
export function multiDayNote(durationHrs, criteria) {
  const parsed = typeof criteria === 'string' ? JSON.parse(criteria) : criteria || {};
  const amHours = ((parsed.am_end_hour || 12) + (parsed.am_end_min || 30) / 60) - ((parsed.am_start_hour || 9) + (parsed.am_start_min || 30) / 60);
  const pmHours = ((parsed.pm_end_hour || 16) + (parsed.pm_end_min || 30) / 60) - ((parsed.pm_start_hour || 13) + (parsed.pm_start_min || 30) / 60);
  if (durationHrs <= amHours || durationHrs <= pmHours) return null;
  if (durationHrs <= amHours + pmHours) return 'This course will be split into 2 parts (AM + PM same day)';
  const totalParts = Math.ceil(durationHrs / (amHours + pmHours)) * 2;
  return `This course will be split into ${totalParts} parts across ${Math.ceil(totalParts / 2)} days`;
}
