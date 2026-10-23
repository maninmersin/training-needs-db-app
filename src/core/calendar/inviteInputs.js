// What the invite planner needs, built from database rows. Pure.
import { normaliseSession } from './meetingState';

/**
 * Each session of a schedule with the people assigned to it.
 * @param {Array} sessionRows - training_sessions rows
 * @param {Array} assignmentRows - user_assignments rows ({ session_id, end_user_id, user_name, user_email })
 * @param {Map} directory - id -> { name, email }, to fill in what an assignment row does not carry
 * @returns {Array<{ session: Object, people: Array<{ id, name, email }> }>}
 */
export function groupPeopleBySession(sessionRows, assignmentRows, directory = new Map()) {
  const bySession = new Map();
  assignmentRows.forEach((row) => {
    if (!row.session_id) return;
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, new Map());
    const people = bySession.get(row.session_id);
    if (people.has(row.end_user_id)) return;
    const known = directory.get(row.end_user_id) || {};
    people.set(row.end_user_id, {
      id: row.end_user_id,
      name: row.user_name || known.name || '',
      email: row.user_email || known.email || ''
    });
  });

  return sessionRows.map((row) => ({
    session: normaliseSession({ ...row, title: row.session_title || `${row.course_name} - Group ${row.session_number}` }),
    people: [...(bySession.get(row.id)?.values() || [])]
  }));
}

/** The ids of people on assignment rows that carry no email, to look up in the directory. */
export function idsNeedingEmail(assignmentRows) {
  return [...new Set(assignmentRows.filter((row) => row.session_id && !row.user_email).map((row) => row.end_user_id))];
}
