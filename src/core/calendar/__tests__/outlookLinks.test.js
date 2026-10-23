import { DEFAULT_OUTLOOK_BASE, LONG_LINK, outlookComposeLink } from '../outlookLinks';

const item = (attendees = [{ id: 1, name: 'Pat', email: 'pat@x.com' }, { id: 2, name: 'Lee', email: 'lee@x.com' }]) => ({
  current: {
    title: 'Ledger Basics - Group 1', location: 'London', room: '2', trainer: 'Priya', functionalArea: 'Finance',
    start: '2026-10-12T09:30', end: '2026-10-12T12:30', attendees
  }
});
const params = (url) => Object.fromEntries(new URL(url).searchParams.entries());

describe('outlookComposeLink', () => {
  test('opens the new-meeting form on Outlook on the web with everything filled in', () => {
    const { url, people, tooLong } = outlookComposeLink(item());
    expect(url.startsWith(`${DEFAULT_OUTLOOK_BASE}/calendar/0/deeplink/compose?`)).toBe(true);
    const p = params(url);
    expect(p).toMatchObject({
      path: '/calendar/action/compose', rru: 'addevent', subject: 'Ledger Basics - Group 1',
      startdt: '2026-10-12T09:30:00', enddt: '2026-10-12T12:30:00', location: 'London - Room 2', to: 'pat@x.com;lee@x.com'
    });
    expect(p.body).toContain('Trainer: Priya');
    expect(p.body).toContain('Room: 2');
    expect(people).toBe(2);
    expect(tooLong).toBe(false);
  });

  test('spaces are %20, not +, so Outlook reads them back correctly', () => {
    expect(outlookComposeLink(item()).url).toContain('subject=Ledger%20Basics%20-%20Group%201');
    expect(outlookComposeLink(item()).url).not.toMatch(/subject=[^&]*\+/);
  });

  test('test mode invites only the test address and says so', () => {
    const { url, people } = outlookComposeLink(item(), { testMode: true, testEmail: ' me@x.com ' });
    const p = params(url);
    expect(p.to).toBe('me@x.com');
    expect(p.subject).toBe('[TEST] Ledger Basics - Group 1');
    expect(p.body).toContain('TEST');
    expect(url).not.toContain('pat%40x.com');
    expect(people).toBe(1);
  });

  test('a personal account uses its own address, and a trailing slash does not matter', () => {
    expect(outlookComposeLink(item(), { base: 'https://outlook.live.com/' }).url.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?')).toBe(true);
  });

  test('a very long list of people is flagged', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ id: i, name: `P${i}`, email: `person.number.${i}@example-company.com` }));
    const result = outlookComposeLink(item(many));
    expect(result.length).toBeGreaterThan(LONG_LINK);
    expect(result.tooLong).toBe(true);
  });

  test('a meeting without a room or location still makes a valid link', () => {
    const bare = item();
    bare.current.room = '';
    bare.current.location = '';
    expect(params(outlookComposeLink(bare).url).location).toBe('');
  });
});
