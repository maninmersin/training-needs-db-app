import { buildMeetingState, meetingUid } from '../meetingState';
import { planInviteChanges } from '../planChanges';
import { buildInviteFiles, isValidTimeZone, validateOrganizer, wallClockToUtc } from '../inviteFiles';

const ORGANIZER = { name: 'Training Team', email: 'training@acme.example' };
const person = (id, over = {}) => ({ id, name: `Person ${id}`, email: `p${id}@x.com`, ...over });
const session = (id, over = {}) => ({
  id, title: 'Ledger Basics - Group 1', courseName: 'Ledger Basics', location: 'London', room: 2, trainer: 'Priya', functionalArea: 'Finance',
  start: '2026-10-12T09:30', end: '2026-10-12T12:30', ...over
});
const stateOf = (s, people) => buildMeetingState({ session: s, people }).state;
const sent = (s, people, over = {}) => ({ id: `inv-${s.id}`, session_id: s.id, uid: meetingUid(s.id), sequence: 0, status: 'active', snapshot: stateOf(s, people), ...over });
const unfold = (text) => text.replace(/\r?\n[ \t]/g, '');
const lines = (text, name) => unfold(text).split(/\r?\n/).filter((line) => line.startsWith(name));
const plan = (sessions, ledger = []) => planInviteChanges({ sessions, ledger }).items;
const build = (items, options = {}) => buildInviteFiles(items, { organizer: ORGANIZER, now: new Date(2026, 9, 14), ...options });

describe('time zones', () => {
  test('knows which names are valid', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  test('09:30 on a wall clock becomes the right UTC time, allowing for daylight saving', () => {
    expect(wallClockToUtc([2026, 10, 12, 9, 30], 'Europe/London')).toEqual([2026, 10, 12, 8, 30]); // summer time, UTC+1
    expect(wallClockToUtc([2026, 12, 1, 9, 30], 'Europe/London')).toEqual([2026, 12, 1, 9, 30]); // winter, UTC+0
    expect(wallClockToUtc([2026, 10, 12, 9, 30], 'America/New_York')).toEqual([2026, 10, 12, 13, 30]);
    expect(wallClockToUtc([2026, 10, 12, 9, 30], 'Asia/Dubai')).toEqual([2026, 10, 12, 5, 30]);
  });

  test('the date can roll over when the zone is ahead of UTC', () => {
    expect(wallClockToUtc([2026, 10, 12, 1, 0], 'Asia/Tokyo')).toEqual([2026, 10, 11, 16, 0]);
  });

  test('the day the clocks change still gives the right answer on both sides', () => {
    expect(wallClockToUtc([2026, 3, 29, 0, 30], 'Europe/London')).toEqual([2026, 3, 29, 0, 30]); // before the change: UTC+0
    expect(wallClockToUtc([2026, 3, 29, 3, 0], 'Europe/London')).toEqual([2026, 3, 29, 2, 0]); // after: UTC+1
  });
});

describe('validateOrganizer', () => {
  test('needs a full email address', () => {
    expect(validateOrganizer(ORGANIZER)).toBeNull();
    expect(validateOrganizer(null)).toMatch(/Set an organiser email/);
    expect(validateOrganizer({ name: 'x', email: '  ' })).toMatch(/Set an organiser email/);
    expect(validateOrganizer({ name: 'x', email: 'nope' })).toMatch(/not a full address/);
  });
});

describe('invitations', () => {
  const S = session('s1');

  test('a new meeting is a REQUEST with its permanent id, version 0, the organiser and everyone invited', () => {
    const { files, error } = build(plan([{ session: S, people: [person(1), person(2)] }]));
    expect(error).toBeUndefined();
    expect(files).toHaveLength(1);
    const [file] = files;
    expect(file.kind).toBe('invites');
    expect(file.filename).toBe('Training_Invites_2026-10-14.ics');
    expect(lines(file.content, 'METHOD')).toEqual(['METHOD:REQUEST']);
    expect(lines(file.content, 'UID')).toEqual(['UID:training-s1@training-system']);
    expect(lines(file.content, 'SEQUENCE')).toEqual(['SEQUENCE:0']);
    expect(lines(file.content, 'ORGANIZER')[0]).toContain('MAILTO:training@acme.example');
    expect(lines(file.content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['p1@x.com', 'p2@x.com']);
    expect(lines(file.content, 'LOCATION')).toEqual(['LOCATION:London']);
  });

  test('the same plan produces the same meeting id every time (no duplicates when re-exported)', () => {
    const first = build(plan([{ session: S, people: [person(1)] }])).files[0].content;
    const second = build(plan([{ session: S, people: [person(1)] }])).files[0].content;
    expect(lines(first, 'UID')).toEqual(lines(second, 'UID'));
  });

  test('an update keeps the id, uses the next version, says what changed and lists everyone', () => {
    const items = plan([{ session: session('s1', { room: 5 }), people: [person(1), person(3)] }], [sent(S, [person(1)], { sequence: 2 })]);
    const [file] = build(items).files;
    expect(lines(file.content, 'UID')).toEqual(['UID:training-s1@training-system']);
    expect(lines(file.content, 'SEQUENCE')).toEqual(['SEQUENCE:3']);
    expect(unfold(file.content)).toContain('Updated: room changed');
    expect(lines(file.content, 'ATTENDEE')).toHaveLength(2);
  });

  test('floating local times when the location has no time zone', () => {
    const { content } = build(plan([{ session: S, people: [person(1)] }])).files[0];
    expect(lines(content, 'DTSTART')).toEqual(['DTSTART:20261012T093000']);
    expect(lines(content, 'DTEND')).toEqual(['DTEND:20261012T123000']);
  });

  test('real UTC times when the location has a time zone', () => {
    const { content, } = build(plan([{ session: S, people: [person(1)] }]), { timeZones: { London: 'Europe/London' } }).files[0];
    expect(lines(content, 'DTSTART')).toEqual(['DTSTART:20261012T083000Z']);
    expect(lines(content, 'DTEND')).toEqual(['DTEND:20261012T113000Z']);
  });

  test('an invalid time zone is ignored with a warning rather than breaking the file', () => {
    const result = build(plan([{ session: S, people: [person(1)] }]), { timeZones: { London: 'Mars/Olympus' } });
    expect(lines(result.files[0].content, 'DTSTART')).toEqual(['DTSTART:20261012T093000']);
    expect(result.warnings).toEqual(['"Mars/Olympus" is not a valid time zone for London; its times were left as local times.']);
  });

  test('nothing to send gives no files', () => {
    expect(build([]).files).toEqual([]);
  });
});

describe('cancellations', () => {
  const S = session('s1');

  test('someone removed gets a CANCEL addressed only to them, with the meeting id and a higher version', () => {
    const items = plan([{ session: S, people: [person(1)] }], [sent(S, [person(1), person(2)], { sequence: 1 })]);
    const result = build(items);
    expect(result.files.map((f) => f.kind)).toEqual(['cancellations']);
    const [file] = result.files;
    expect(file.filename).toBe('Training_Cancellations_2026-10-14.ics');
    expect(lines(file.content, 'METHOD')).toEqual(['METHOD:CANCEL']);
    expect(lines(file.content, 'STATUS')).toEqual(['STATUS:CANCELLED']);
    expect(lines(file.content, 'UID')).toEqual(['UID:training-s1@training-system']);
    expect(lines(file.content, 'SEQUENCE')).toEqual(['SEQUENCE:2']);
    expect(lines(file.content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['p2@x.com']);
  });

  test('a deleted session cancels for everyone who was invited, using the times that were sent', () => {
    const ledger = [sent(S, [person(1), person(2)], { session_id: null })];
    const [file] = build(plan([], ledger)).files;
    expect(lines(file.content, 'ATTENDEE')).toHaveLength(2);
    expect(lines(file.content, 'DTSTART')).toEqual(['DTSTART:20261012T093000']);
    expect(unfold(file.content)).toContain('This meeting has been cancelled.');
  });

  test('an update that also removes someone makes both files: the update, and the cancel for that person', () => {
    const items = plan([{ session: session('s1', { room: 9 }), people: [person(1)] }], [sent(S, [person(1), person(2)])]);
    const result = build(items);
    expect(result.files.map((f) => f.kind)).toEqual(['invites', 'cancellations']);
    expect(lines(result.files[0].content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['p1@x.com']);
    expect(lines(result.files[1].content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['p2@x.com']);
  });
});

describe('test mode', () => {
  const S = session('s1');
  const items = () => plan([{ session: S, people: [person(1), person(2)] }]);

  test('only the test address is invited, the title says TEST, and the meeting id is different from the real one', () => {
    const [file] = build(items(), { testMode: true, testEmail: 'me@acme.example' }).files;
    expect(file.filename).toBe('TEST_Training_Invites_2026-10-14.ics');
    expect(lines(file.content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['me@acme.example']);
    expect(lines(file.content, 'SUMMARY')).toEqual(['SUMMARY:[TEST] Ledger Basics - Group 1']);
    expect(lines(file.content, 'UID')).toEqual(['UID:test-training-s1@training-system']);
    expect(unfold(file.content)).not.toContain('p1@x.com');
  });

  test('refuses to run without a test address, so nothing can reach real people by accident', () => {
    const result = build(items(), { testMode: true, testEmail: '' });
    expect(result.error).toMatch(/Test mode needs a test email address/);
    expect(result.files).toEqual([]);
  });

  test('cancellations in test mode also go only to the test address', () => {
    const cancelItems = plan([{ session: S, people: [] }], [sent(S, [person(1), person(2)])]);
    const [file] = build(cancelItems, { testMode: true, testEmail: 'me@acme.example' }).files;
    expect(lines(file.content, 'ATTENDEE').map((l) => l.split('mailto:')[1])).toEqual(['me@acme.example']);
    expect(lines(file.content, 'UID')).toEqual(['UID:test-training-s1@training-system']);
  });
});

describe('organiser', () => {
  test('files are refused until the organiser has an email address', () => {
    const result = buildInviteFiles(plan([{ session: session('s1'), people: [person(1)] }]), { organizer: { name: 'Team', email: '' } });
    expect(result.error).toMatch(/Set an organiser email/);
    expect(result.files).toEqual([]);
  });
});
