import { buildMeetingState, meetingUid } from '../meetingState';
import { planInviteChanges } from '../planChanges';
import { buildInviteEmails } from '../inviteFiles';

const ORGANIZER = { name: 'Training Team', email: 'training@acme.example' };
const person = (id, over = {}) => ({ id, name: `Person ${id}`, email: `p${id}@x.com`, ...over });
const session = (id, over = {}) => ({
  id, title: 'Ledger Basics - Group 1', courseName: 'Ledger Basics', location: 'London', room: 2, trainer: 'Priya', functionalArea: 'Finance',
  start: '2026-10-12T09:30', end: '2026-10-12T12:30', ...over
});
const stateOf = (s, people) => buildMeetingState({ session: s, people }).state;
const plan = (sessions, ledger = []) => planInviteChanges({ sessions, ledger }).items;

const decode = (base64Text) => Buffer.from(base64Text.replace(/\s+/g, ''), 'base64').toString('utf8');
const parts = (eml) => {
  const lines = eml.split(/\r\n/);
  const headers = {};
  let i = 0;
  while (lines[i] !== '') { const [k, ...rest] = lines[i].split(': '); headers[k] = rest.join(': '); i += 1; }
  const body = lines.slice(i + 1).join('\n');
  const blocks = body.split(/--[^\n]*\n?/).filter((b) => b.trim());
  const [text, calendar] = blocks.map((block) => {
    const [head, ...content] = block.split('\n\n');
    return { head, text: decode(content.join('')) };
  });
  return { headers, text, calendar };
};

describe('buildInviteEmails', () => {
  const s = session('s1');
  const people = [person(1), person(2)];
  const options = { organizer: ORGANIZER, label: 'Wave One', now: new Date(2026, 9, 1, 8, 0) };

  test('one unsent draft per meeting, addressed to the attendees, with the meeting as a calendar part', () => {
    const { files, error } = buildInviteEmails(plan([{ session: s, people }]), options);
    expect(error).toBeUndefined();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ kind: 'email', count: 1 });
    expect(files[0].filename).toBe('Wave_One_Invite_Ledger_Basics_-_Group_1_1.eml');

    const { headers, text, calendar } = parts(files[0].content);
    expect(headers['X-Unsent']).toBe('1');
    expect(headers.From).toBe('"Training Team" <training@acme.example>');
    expect(headers.To).toBe('"Person 1" <p1@x.com>, "Person 2" <p2@x.com>');
    expect(headers.Subject).toBe('Ledger Basics - Group 1');
    expect(headers['Content-Type']).toMatch(/^multipart\/alternative; boundary=/);
    expect(text.text).toContain('You are invited to: Ledger Basics - Group 1');
    expect(text.text).toContain('When: 12/10/2026 09:30 to 12/10/2026 12:30');
    expect(text.text).toContain('Where: London');
    expect(calendar.head).toContain('text/calendar');
    expect(calendar.head).toContain('method=REQUEST');
    expect(calendar.text).toContain('METHOD:REQUEST');
    expect(calendar.text).toContain(`UID:${meetingUid('s1')}`);
    expect(calendar.text).toContain('p1@x.com');
  });

  test('test mode invites only the test address and marks everything as a test', () => {
    const { files } = buildInviteEmails(plan([{ session: s, people }]), { ...options, testMode: true, testEmail: 'me@x.com' });
    expect(files[0].filename.startsWith('TEST_')).toBe(true);
    const { headers, calendar } = parts(files[0].content);
    expect(headers.To).toBe('"Test recipient" <me@x.com>');
    expect(headers.Subject).toBe('[TEST] Ledger Basics - Group 1');
    expect(calendar.text).toContain('UID:test-');
    expect(calendar.text).not.toContain('p1@x.com');
  });

  test('a cancellation is its own draft, with the CANCEL method, for the people removed', () => {
    const previous = { id: 'i1', session_id: 's1', uid: meetingUid('s1'), sequence: 0, status: 'active', snapshot: stateOf(s, people) };
    const { files } = buildInviteEmails(plan([], [previous]), options);
    expect(files).toHaveLength(1);
    const { headers, calendar } = parts(files[0].content);
    expect(headers.Subject).toBe('Cancelled: Ledger Basics - Group 1');
    expect(calendar.head).toContain('method=CANCEL');
    expect(calendar.text).toContain('METHOD:CANCEL');
    expect(files[0].filename).toContain('_Cancel_');
  });

  test('accented text is encoded so Outlook shows it properly', () => {
    const accented = session('s2', { title: 'Compta générale - Groupe 1' });
    const { files } = buildInviteEmails(plan([{ session: accented, people }]), options);
    const { headers, text } = parts(files[0].content);
    expect(headers.Subject).toMatch(/^=\?UTF-8\?B\?/);
    expect(decode(headers.Subject.replace(/^=\?UTF-8\?B\?|\?=$/g, ''))).toBe('Compta générale - Groupe 1');
    expect(text.text).toContain('Compta générale');
  });

  test('explains what is missing instead of making a draft', () => {
    expect(buildInviteEmails(plan([{ session: s, people }]), { ...options, organizer: { name: 'x', email: '' } }).error).toMatch(/organiser/i);
    expect(buildInviteEmails(plan([{ session: s, people }]), { ...options, testMode: true, testEmail: '' }).error).toMatch(/test email/i);
  });
});
