import { buildMeetingState, meetingUid, normaliseSession, wallClock } from '../meetingState';
import { KIND, diffMeeting, planInviteChanges } from '../planChanges';

const person = (id, over = {}) => ({ id, name: `Person ${id}`, email: `p${id}@x.com`, ...over });
const session = (id, over = {}) => ({
  id, title: 'Ledger Basics - Group 1', courseName: 'Ledger Basics', location: 'London', room: 2, trainer: 'Priya', functionalArea: 'Finance',
  start: '2026-10-12T09:30', end: '2026-10-12T12:30', ...over
});
const stateOf = (s, people) => buildMeetingState({ session: s, people }).state;
// A ledger row as stored after the meeting was sent
const sent = (s, people, over = {}) => ({ id: `inv-${s.id}`, session_id: s.id, uid: meetingUid(s.id), sequence: 0, status: 'active', snapshot: stateOf(s, people), ...over });

describe('wallClock and normaliseSession', () => {
  test('reads a Date by its local fields, and rejects an invalid one', () => {
    expect(wallClock(new Date(2026, 9, 12, 9, 5))).toBe('2026-10-12T09:05');
    expect(wallClock('not a date')).toBeNull();
  });

  test('understands the assignment screen shape', () => {
    const s = normaliseSession({ event_id: 'e1', title: 'Course A - Group 2', location: 'Leeds', classroom_number: 3, trainer_name: 'Sam', start: new Date(2026, 9, 12, 9, 30), end: new Date(2026, 9, 12, 12, 30) });
    expect(s).toMatchObject({ id: 'e1', title: 'Course A - Group 2', location: 'Leeds', room: 3, trainer: 'Sam', start: '2026-10-12T09:30', end: '2026-10-12T12:30' });
  });

  test('understands a training_sessions row', () => {
    const s = normaliseSession({ id: 'd1', course_name: 'Ledger', training_location: 'London', classroom_number: 1, instructor_name: 'Priya', functional_area: 'Finance', start_datetime: new Date(2026, 9, 12, 9, 30), end_datetime: new Date(2026, 9, 12, 10, 30) });
    expect(s).toMatchObject({ id: 'd1', title: 'Ledger', location: 'London', trainer: 'Priya', functionalArea: 'Finance' });
  });
});

describe('buildMeetingState', () => {
  test('invites each email once (ignoring case and spaces), in a fixed order', () => {
    const { state } = buildMeetingState({ session: session('s1'), people: [person(2, { email: 'B@x.com' }), person(1, { email: 'a@x.com' }), person(3, { email: ' b@X.com ' })] });
    expect(state.attendees.map((p) => p.email)).toEqual(['a@x.com', 'B@x.com']);
  });

  test('people with no email address cannot be invited and are listed separately', () => {
    const { state, missingEmail } = buildMeetingState({ session: session('s1'), people: [person(1), person(2, { email: '  ' }), person(3, { email: null })] });
    expect(state.attendees).toHaveLength(1);
    expect(missingEmail.map((p) => p.id)).toEqual([2, 3]);
  });

  test('the room is stored as text so 2 and "2" are the same', () => {
    expect(stateOf(session('s1', { room: 2 }), []).room).toBe('2');
    expect(stateOf(session('s1', { room: null }), []).room).toBe('');
  });
});

describe('diffMeeting', () => {
  const S = session('s1');
  const A = [person(1), person(2)];

  test('nothing sent yet: a meeting with people is new; one with nobody is nothing', () => {
    expect(diffMeeting(null, stateOf(S, A)).kind).toBe(KIND.NEW);
    expect(diffMeeting(null, stateOf(S, [])).kind).toBe(KIND.UNCHANGED);
  });

  test('the same as last sent is unchanged', () => {
    expect(diffMeeting(sent(S, A), stateOf(S, A)).kind).toBe(KIND.UNCHANGED);
  });

  test.each([
    ['time', { start: '2026-10-12T10:00' }],
    ['time', { end: '2026-10-12T13:00' }],
    ['location', { location: 'Leeds' }],
    ['room', { room: 5 }],
    ['title', { title: 'Renamed' }],
    ['trainer', { trainer: 'Sam' }]
  ])('a changed %s is an update', (name, over) => {
    const result = diffMeeting(sent(S, A), stateOf(session('s1', over), A));
    expect(result.kind).toBe(KIND.UPDATE);
    expect(result.changes).toEqual([name]);
  });

  test('someone added is an update that names them', () => {
    const result = diffMeeting(sent(S, A), stateOf(S, [...A, person(3)]));
    expect(result).toMatchObject({ kind: KIND.UPDATE, changes: [] });
    expect(result.added.map((p) => p.id)).toEqual([3]);
  });

  test('only people removed means cancel for them, not a new invitation to everyone', () => {
    const result = diffMeeting(sent(S, A), stateOf(S, [person(1)]));
    expect(result.kind).toBe(KIND.CANCEL_ATTENDEES);
    expect(result.removed.map((p) => p.id)).toEqual([2]);
  });

  test('a change and a removal together is an update that also lists who to cancel', () => {
    const result = diffMeeting(sent(S, A), stateOf(session('s1', { room: 9 }), [person(1)]));
    expect(result.kind).toBe(KIND.UPDATE);
    expect(result.removed.map((p) => p.id)).toEqual([2]);
  });

  test('a swap (one out, one in) is an update with both', () => {
    const result = diffMeeting(sent(S, A), stateOf(S, [person(1), person(3)]));
    expect(result.kind).toBe(KIND.UPDATE);
    expect([result.added.map((p) => p.id), result.removed.map((p) => p.id)]).toEqual([[3], [2]]);
  });

  test('everyone removed, or the session gone, cancels the whole meeting', () => {
    expect(diffMeeting(sent(S, A), stateOf(S, [])).kind).toBe(KIND.CANCEL);
    const gone = diffMeeting(sent(S, A), null);
    expect(gone.kind).toBe(KIND.CANCEL);
    expect(gone.removed).toHaveLength(2);
  });

  test('after a cancellation, people booked again means a new invitation', () => {
    expect(diffMeeting(sent(S, A, { status: 'cancelled' }), stateOf(S, A)).kind).toBe(KIND.NEW);
  });

  test('a person whose email changed is one removed and one added', () => {
    const result = diffMeeting(sent(S, [person(1)]), stateOf(S, [person(1, { email: 'new@x.com' })]));
    expect(result.kind).toBe(KIND.UPDATE);
    expect(result.removed[0].email).toBe('p1@x.com');
    expect(result.added[0].email).toBe('new@x.com');
  });
});

describe('planInviteChanges', () => {
  const S1 = session('s1');
  const S2 = session('s2', { title: 'Ledger Basics - Group 2', start: '2026-10-19T09:30', end: '2026-10-19T12:30' });

  test('the first time everything is new, with version 0 and a permanent id built from the session', () => {
    const plan = planInviteChanges({ sessions: [{ session: S1, people: [person(1)] }, { session: S2, people: [person(2)] }], ledger: [] });
    expect(plan.items.map((i) => [i.kind, i.sequence, i.uid])).toEqual([[KIND.NEW, 0, 'training-s1@training-system'], [KIND.NEW, 0, 'training-s2@training-system']]);
    expect(plan.counts).toEqual({ new: 2, update: 0, cancelAttendees: 0, cancel: 0, total: 2 });
    expect(plan.items[0].description).toBe('New meeting (1 attendee)');
  });

  test('exporting again with nothing changed finds nothing to send', () => {
    const ledger = [sent(S1, [person(1)]), sent(S2, [person(2)])];
    const plan = planInviteChanges({ sessions: [{ session: S1, people: [person(1)] }, { session: S2, people: [person(2)] }], ledger });
    expect(plan.items).toEqual([]);
    expect(plan.unchanged).toBe(2);
  });

  test('a change finds only that meeting and bumps its version', () => {
    const ledger = [sent(S1, [person(1)], { sequence: 3 }), sent(S2, [person(2)])];
    const plan = planInviteChanges({ sessions: [{ session: session('s1', { room: 7 }), people: [person(1)] }, { session: S2, people: [person(2)] }], ledger });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ sessionId: 's1', kind: KIND.UPDATE, sequence: 4, uid: 'training-s1@training-system', inviteId: 'inv-s1' });
    expect(plan.items[0].description).toBe('Update: room changed');
  });

  test('moving a person between sessions updates one meeting and cancels for them on the other', () => {
    const ledger = [sent(S1, [person(1), person(5)]), sent(S2, [person(2)])];
    const plan = planInviteChanges({ sessions: [{ session: S1, people: [person(1)] }, { session: S2, people: [person(2), person(5)] }], ledger });
    const byId = Object.fromEntries(plan.items.map((i) => [i.sessionId, i]));
    expect(byId.s1.kind).toBe(KIND.CANCEL_ATTENDEES);
    expect(byId.s1.description).toBe('Cancel for Person 5');
    expect(byId.s2.kind).toBe(KIND.UPDATE);
    expect(byId.s2.description).toBe('Update: 1 added');
  });

  test('a session that was deleted is cancelled from what was sent, even though its id is gone', () => {
    const ledger = [sent(S1, [person(1), person(2)], { session_id: null, sequence: 1 })];
    const plan = planInviteChanges({ sessions: [], ledger });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ kind: KIND.CANCEL, sequence: 2, title: 'Ledger Basics - Group 1', current: null });
    expect(plan.items[0].removed).toHaveLength(2);
    expect(plan.items[0].description).toBe('Cancel the meeting for all 2 attendees');
  });

  test('a meeting already cancelled is not cancelled again', () => {
    expect(planInviteChanges({ sessions: [], ledger: [sent(S1, [person(1)], { session_id: null, status: 'cancelled' })] }).items).toEqual([]);
  });

  test('people without an email are reported with their session, and a session with nobody and nothing sent is skipped', () => {
    const plan = planInviteChanges({ sessions: [{ session: S1, people: [person(1), person(2, { email: '' })] }, { session: S2, people: [] }], ledger: [] });
    expect(plan.missingEmails).toEqual([{ sessionId: 's1', title: 'Ledger Basics - Group 1', id: 2, name: 'Person 2' }]);
    expect(plan.items).toHaveLength(1);
    expect(plan.unchanged).toBe(1);
  });

  test('re-inviting after a cancellation keeps the same meeting id with a higher version', () => {
    const ledger = [sent(S1, [person(1)], { status: 'cancelled', sequence: 4 })];
    const plan = planInviteChanges({ sessions: [{ session: S1, people: [person(1)] }], ledger });
    expect(plan.items[0]).toMatchObject({ kind: KIND.NEW, sequence: 5, uid: 'training-s1@training-system' });
  });
});
