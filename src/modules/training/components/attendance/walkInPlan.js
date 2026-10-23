// What happens to a person's bookings when they turn up to a session. Pure: no React, no database.
//
// Three situations, decided from the person's existing assignments for THIS course in the schedule:
//  - no booking on the course anywhere  -> a true walk-in: assign them to this session, tagged 'walk-in'
//  - booked on the same course in another session group -> offer to MOVE them here (the safe default), keep
//    both bookings (ALSO), or record attendance only
//  - already booked on this session group -> nothing special (assign any missing part, or attendance only)
//
// Assignments are one row per person per session PART per course; "Group N" is the session number.
import { buildSessionGroups, describeGroupSeats } from '../assignments/moveUserAssignments';

export const CHOICE = { MOVE: 'move', ASSIGN: 'assign', ALSO: 'also', ATTENDANCE_ONLY: 'attendance' };

export const WALK_IN_METHOD = 'walk-in'; // assignment_method written on rows created for true walk-ins

const groupKey = (s) => [s.course_id, s.session_number, s.training_location, s.functional_area].join('|');

/**
 * The person's bookings on this course that are NOT in the session group being attended, grouped by session group.
 * @param {Object} args
 * @param {Array} args.existingRows - the person's user_assignments rows for this course in the schedule
 * @param {Array} args.existingSessions - training_sessions rows for those assignments
 * @param {Object} args.targetSession - the session being attended
 * @returns {Array<{ key, sessionNumber, location, functionalArea, courseName, firstStart, rowIds, sessionIds }>}
 */
export function findOtherBookings({ existingRows, existingSessions, targetSession }) {
  const sessionById = new Map(existingSessions.map((s) => [s.id, s]));
  const targetKey = groupKey(targetSession);
  const groups = new Map();
  existingRows.forEach((row) => {
    if (row.course_id !== targetSession.course_id) return;
    const session = sessionById.get(row.session_id);
    if (!session) return;
    const key = groupKey(session);
    if (key === targetKey) return;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sessionNumber: session.session_number,
        location: session.training_location,
        functionalArea: session.functional_area,
        courseName: session.course_name || session.course_id,
        firstStart: session.start_datetime,
        rowIds: [],
        sessionIds: []
      });
    }
    const group = groups.get(key);
    group.rowIds.push(row.id);
    if (!group.sessionIds.includes(session.id)) group.sessionIds.push(session.id);
    if (session.start_datetime < group.firstStart) group.firstStart = session.start_datetime;
  });
  return [...groups.values()].sort((a, b) => String(a.firstStart).localeCompare(String(b.firstStart)));
}

/** The choices to offer, best one first. */
export function availableChoices(otherBookings) {
  if (otherBookings.length > 0) {
    return [
      { value: CHOICE.MOVE, label: 'Move them to this session', description: 'Free their old seat and book them on this session (all its parts).' },
      { value: CHOICE.ALSO, label: 'Attend this one as well', description: 'Keep their original booking and also add this session.' },
      { value: CHOICE.ATTENDANCE_ONLY, label: 'Attendance only', description: 'Record that they were here and change no bookings.' }
    ];
  }
  return [
    { value: CHOICE.ASSIGN, label: 'Assign them to this session', description: 'Book them on this session, tagged as a walk-in, so they have a training record.' },
    { value: CHOICE.ATTENDANCE_ONLY, label: 'Attendance only', description: 'Record that they were here and do not assign them.' }
  ];
}

/** Seats in the group being attended, for the "session is full" warning. */
export function targetSeats(targetParts, seatRows) {
  const group = buildSessionGroups(targetParts).values().next().value;
  return group ? describeGroupSeats(group, seatRows) : null;
}

const assignmentRow = ({ part, groupNumber, person, schedule, method, source, note, stamp }) => ({
  schedule_id: schedule.id,
  project_id: schedule.project_id,
  end_user_id: person.id,
  user_name: person.name || null,
  user_email: person.email || null,
  session_id: part.id,
  course_id: part.course_id,
  session_identifier: part.session_identifier,
  training_location: part.training_location,
  functional_area: part.functional_area,
  group_identifier: `Group ${groupNumber}`,
  assignment_level: 'session',
  assignment_status: 'enrolled',
  assignment_type: 'standard',
  completion_status: 'pending',
  assignment_source: source,
  assignment_method: method,
  assigned_at: stamp,
  notes: note
});

/**
 * The exact changes for a choice.
 * @returns {{ deleteIds: string[], newRows: Object[], oldSessionIds: string[], summary: string }}
 */
export function buildWalkInPlan({ choice, session, targetParts, person, schedule, otherBookings = [], existingRows = [], now = new Date() }) {
  const stamp = now.toISOString();
  const day = stamp.slice(0, 10);
  const none = { deleteIds: [], newRows: [], oldSessionIds: [], summary: 'Attendance only: no bookings change.' };
  if (choice === CHOICE.ATTENDANCE_ONLY) return none;

  const haveSession = new Set(existingRows.map((row) => row.session_id));

  if (choice === CHOICE.ASSIGN || choice === CHOICE.ALSO) {
    const newRows = haveSession.has(session.id)
      ? []
      : [assignmentRow({
          part: session, groupNumber: session.session_number, person, schedule, method: WALK_IN_METHOD, source: 'attendance',
          note: `Added as a walk-in on ${day} (attended without being assigned)`, stamp
        })];
    return { ...none, newRows, summary: `Assign to Group ${session.session_number}: adding ${newRows.length} session row(s).` };
  }

  if (choice === CHOICE.MOVE) {
    if (otherBookings.length === 0) throw new Error('This person has no other booking on this course, so there is nothing to move.');
    const group = buildSessionGroups(targetParts).values().next().value;
    if (!group) throw new Error('Could not find the other parts of this session.');
    const from = otherBookings[0];
    const note = `Moved from Group ${from.sessionNumber} (${from.location}) to Group ${group.sessionNumber} (${group.location}) on ${day} - attended this session instead`;
    return {
      deleteIds: otherBookings.flatMap((booking) => booking.rowIds),
      newRows: group.parts
        .filter((part) => !haveSession.has(part.id))
        .map((part) => assignmentRow({ part, groupNumber: group.sessionNumber, person, schedule, method: 'manual', source: 'manual', note, stamp })),
      oldSessionIds: otherBookings.flatMap((booking) => booking.sessionIds),
      summary: note
    };
  }
  throw new Error(`Unknown choice: ${choice}`);
}
