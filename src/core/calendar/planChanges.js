// Working out what invitations need sending: compare each session's meeting now with what was last sent.
// Pure: no database, no React.
import { buildMeetingState, emailKey, meetingUid } from './meetingState';

/** What has to be sent for a meeting. */
export const KIND = {
  NEW: 'new', // never sent: send the invitation
  UPDATE: 'update', // details changed or people added: send an update (same meeting, next version)
  CANCEL_ATTENDEES: 'cancel_attendees', // only people removed: cancel the meeting for them
  CANCEL: 'cancel', // the session is gone or has nobody left: cancel the meeting for everyone
  UNCHANGED: 'unchanged'
};

const DETAIL_FIELDS = [
  ['time', (a, b) => a.start !== b.start || a.end !== b.end],
  ['location', (a, b) => a.location !== b.location],
  ['room', (a, b) => a.room !== b.room],
  ['title', (a, b) => a.title !== b.title],
  ['trainer', (a, b) => a.trainer !== b.trainer]
];

const attendeesOf = (state) => (state && state.attendees) || [];

/**
 * Compare the last-sent meeting with the meeting as it is now.
 * @param {Object|null} previous - the ledger row { status, snapshot, sequence } or null if nothing was sent
 * @param {Object|null} current - the meeting state now, or null if the session no longer exists
 * @returns {{ kind: string, changes: string[], added: Array, removed: Array }}
 */
export function diffMeeting(previous, current) {
  const wasSent = Boolean(previous) && previous.status === 'active';
  const hasPeople = attendeesOf(current).length > 0;

  if (!wasSent) {
    return { kind: current && hasPeople ? KIND.NEW : KIND.UNCHANGED, changes: [], added: attendeesOf(current), removed: [] };
  }
  const before = previous.snapshot;
  if (!current || !hasPeople) return { kind: KIND.CANCEL, changes: [], added: [], removed: attendeesOf(before) };

  const beforeKeys = new Set(attendeesOf(before).map((p) => emailKey(p.email)));
  const nowKeys = new Set(attendeesOf(current).map((p) => emailKey(p.email)));
  const added = attendeesOf(current).filter((p) => !beforeKeys.has(emailKey(p.email)));
  const removed = attendeesOf(before).filter((p) => !nowKeys.has(emailKey(p.email)));
  const changes = DETAIL_FIELDS.filter(([, differs]) => differs(before, current)).map(([name]) => name);

  if (changes.length === 0 && added.length === 0) {
    return { kind: removed.length > 0 ? KIND.CANCEL_ATTENDEES : KIND.UNCHANGED, changes, added, removed };
  }
  return { kind: KIND.UPDATE, changes, added, removed };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line describing an item, for the "pending changes" list. */
export function describeItem(item) {
  const who = plural(item.current ? item.current.attendees.length : item.removed.length, 'attendee');
  switch (item.kind) {
    case KIND.NEW:
      return `New meeting (${who})`;
    case KIND.UPDATE: {
      const parts = [];
      if (item.changes.length) parts.push(`${item.changes.join(', ')} changed`);
      if (item.added.length) parts.push(`${item.added.length} added`);
      if (item.removed.length) parts.push(`${item.removed.length} removed`);
      return `Update: ${parts.join('; ')}`;
    }
    case KIND.CANCEL_ATTENDEES:
      return `Cancel for ${item.removed.map((p) => p.name).join(', ')}`;
    case KIND.CANCEL:
      return `Cancel the meeting for all ${plural(item.removed.length, 'attendee')}`;
    default:
      return 'No change';
  }
}

/**
 * @param {Object} args
 * @param {Array<{ session: Object, people: Array }>} args.sessions - each session (from normaliseSession) with everyone assigned to it
 * @param {Array} args.ledger - calendar_invites rows already sent: { id, session_id, uid, sequence, status, snapshot }
 * @returns {{ items: Array, unchanged: number, missingEmails: Array, counts: Object }}
 *   items need sending; each has { uid, sessionId, inviteId, kind, title, sequence (the version to send), current,
 *   previous, changes, added, removed, description }.
 */
export function planInviteChanges({ sessions, ledger }) {
  const bySession = new Map(ledger.filter((row) => row.session_id).map((row) => [row.session_id, row]));
  const items = [];
  const missingEmails = [];
  let unchanged = 0;
  const handledSessions = new Set();

  sessions.forEach(({ session, people }) => {
    handledSessions.add(session.id);
    const { state, missingEmail } = buildMeetingState({ session, people });
    missingEmail.forEach((person) => missingEmails.push({ sessionId: session.id, title: session.title, ...person }));

    const previous = bySession.get(session.id) || null;
    const { kind, changes, added, removed } = diffMeeting(previous, state);
    if (kind === KIND.UNCHANGED) {
      unchanged += 1;
      return;
    }
    const item = {
      uid: previous ? previous.uid : meetingUid(session.id),
      sessionId: session.id,
      inviteId: previous ? previous.id : null,
      kind,
      title: session.title,
      sequence: previous ? previous.sequence + 1 : 0,
      current: kind === KIND.CANCEL ? null : state,
      previous: previous ? previous.snapshot : null,
      changes,
      added,
      removed
    };
    items.push({ ...item, description: describeItem(item) });
  });

  // Meetings that were sent for sessions that no longer exist: cancel them using what was sent
  ledger.forEach((row) => {
    if (row.status !== 'active' || (row.session_id && handledSessions.has(row.session_id))) return;
    const { removed } = diffMeeting(row, null);
    const item = {
      uid: row.uid,
      sessionId: row.session_id,
      inviteId: row.id,
      kind: KIND.CANCEL,
      title: row.snapshot.title,
      sequence: row.sequence + 1,
      current: null,
      previous: row.snapshot,
      changes: [],
      added: [],
      removed
    };
    items.push({ ...item, description: describeItem(item) });
  });

  const count = (kind) => items.filter((item) => item.kind === kind).length;
  return {
    items,
    unchanged,
    missingEmails,
    counts: {
      new: count(KIND.NEW),
      update: count(KIND.UPDATE),
      cancelAttendees: count(KIND.CANCEL_ATTENDEES),
      cancel: count(KIND.CANCEL),
      total: items.length
    }
  };
}
