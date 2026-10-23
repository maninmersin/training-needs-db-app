// Describing one training session as a calendar meeting. Pure: no database, no React.
//
// A "meeting state" is a small plain object (safe to store as JSON) with exactly what an invitation says:
// title, place, room, trainer, wall-clock start and end, and the invited people. The last state that was sent
// is remembered, and the next one is compared with it to find out what changed.

/** The meeting's permanent identity in people's calendars. Built from the session id, so it never changes. */
export const meetingUid = (sessionId) => `training-${sessionId}@training-system`;

const pad = (n) => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DDTHH:mm' for a Date or date text, using the same local-field reading as the screens (a session at
 * 09:30 is 09:30 wherever the training is). Returns null for an invalid date.
 */
export function wallClock(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * One session from either shape the app uses: a training_sessions row (id, course_name, start_datetime,
 * classroom_number...) or the assignment screen's calendar session (event_id, title, start, end, trainer_name...).
 */
export function normaliseSession(raw) {
  const id = raw.event_id || raw.id;
  return {
    id,
    title: raw.title || raw.session_title || raw.course_name || 'Training Session',
    courseName: raw.course_name || '',
    location: raw.location || raw.training_location || '',
    room: raw.classroom_number ?? raw.classroom ?? '',
    trainer: raw.trainer_name || raw.instructor_name || '',
    functionalArea: raw.functional_area || '',
    start: wallClock(raw.start ?? raw.start_datetime),
    end: wallClock(raw.end ?? raw.end_datetime)
  };
}

const emailKey = (email) => String(email || '').trim().toLowerCase();

/**
 * @param {Object} args
 * @param {Object} args.session - from normaliseSession
 * @param {Array<{id, name, email}>} args.people - everyone assigned to the session
 * @returns {{ state: Object, missingEmail: Array }} people without an email address cannot be invited and are
 *   listed separately; each email is invited once, in a fixed order.
 */
export function buildMeetingState({ session, people }) {
  const seen = new Set();
  const attendees = [];
  const missingEmail = [];
  (people || []).forEach((person) => {
    const key = emailKey(person.email);
    if (!key) {
      missingEmail.push({ id: person.id, name: person.name || `Person ${person.id}` });
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    attendees.push({ id: person.id, name: person.name || key, email: String(person.email).trim() });
  });
  attendees.sort((a, b) => emailKey(a.email).localeCompare(emailKey(b.email)));

  return {
    state: {
      title: session.title,
      location: session.location,
      room: session.room === null || session.room === undefined ? '' : String(session.room),
      trainer: session.trainer,
      functionalArea: session.functionalArea,
      start: session.start,
      end: session.end,
      attendees
    },
    missingEmail
  };
}

export { emailKey };
