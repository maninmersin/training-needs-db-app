import { groupPeopleBySession, idsNeedingEmail } from '../inviteInputs';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, validateSettings } from '../inviteSettings';

describe('groupPeopleBySession', () => {
  const sessions = [
    { id: 's1', course_name: 'Budgeting', session_number: 2, training_location: 'Dubai', classroom_number: 3, instructor_name: 'Tess', start_datetime: '2026-10-05T09:30:00', end_datetime: '2026-10-05T12:30:00' },
    { id: 's2', course_name: 'Ledger', session_number: 1, session_title: 'Custom title', start_datetime: '2026-10-06T09:30:00', end_datetime: '2026-10-06T12:30:00' }
  ];
  const rows = [
    { session_id: 's1', end_user_id: 7, user_name: 'Pat', user_email: 'pat@x.com' },
    { session_id: 's1', end_user_id: 7, user_name: 'Pat', user_email: 'pat@x.com' }, // another row for the same person
    { session_id: 's1', end_user_id: 8, user_name: null, user_email: null },
    { session_id: null, end_user_id: 9 }
  ];

  test('lists each session with its people once, filling names and emails from the directory', () => {
    const result = groupPeopleBySession(sessions, rows, new Map([[8, { name: 'Lee', email: 'lee@x.com' }]]));
    expect(result).toHaveLength(2);
    expect(result[0].session).toMatchObject({ id: 's1', title: 'Budgeting - Group 2', location: 'Dubai', room: 3, trainer: 'Tess', start: '2026-10-05T09:30', end: '2026-10-05T12:30' });
    expect(result[0].people).toEqual([{ id: 7, name: 'Pat', email: 'pat@x.com' }, { id: 8, name: 'Lee', email: 'lee@x.com' }]);
    expect(result[1].session.title).toBe('Custom title');
    expect(result[1].people).toEqual([]);
  });

  test('a person with no email anywhere stays in the list, with an empty email, so they can be reported', () => {
    const result = groupPeopleBySession(sessions, [{ session_id: 's1', end_user_id: 8, user_name: 'Lee' }]);
    expect(result[0].people).toEqual([{ id: 8, name: 'Lee', email: '' }]);
  });

  test('works out who needs an email looked up', () => {
    expect(idsNeedingEmail(rows)).toEqual([8]);
  });
});

describe('invite settings', () => {
  const memory = () => {
    const data = {};
    return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  };

  test('start in test mode, with the signed-in person as defaults, and remember what is saved per project', () => {
    const storage = memory();
    const first = loadSettings('p1', { organizerEmail: 'me@x.com', testEmail: 'me@x.com' }, storage);
    expect(first).toEqual({ ...DEFAULT_SETTINGS, organizerEmail: 'me@x.com', testEmail: 'me@x.com' });
    expect(first.testMode).toBe(true);
    saveSettings('p1', { ...first, organizerName: 'Stuart', testMode: false }, storage);
    expect(loadSettings('p1', {}, storage)).toMatchObject({ organizerName: 'Stuart', testMode: false, organizerEmail: 'me@x.com' });
    expect(loadSettings('p2', {}, storage).organizerName).toBe('');
  });

  test('unreadable saved text is ignored', () => {
    expect(loadSettings('p1', {}, { getItem: () => '{not json' }).testMode).toBe(true);
  });

  test('needs an organiser email, and a test email while in test mode', () => {
    expect(validateSettings({ organizerEmail: '', testMode: true, testEmail: '' })).toEqual({
      organizerEmail: expect.any(String), testEmail: expect.any(String)
    });
    expect(validateSettings({ organizerEmail: 'a@x.com', testMode: false, testEmail: '' })).toEqual({});
    expect(validateSettings({ organizerEmail: 'a@x.com', testMode: true, testEmail: 'nope' }).testEmail).toBeDefined();
    expect(validateSettings({ organizerEmail: 'a@x.com', testMode: true, testEmail: 'b@x.com' })).toEqual({});
  });
});
