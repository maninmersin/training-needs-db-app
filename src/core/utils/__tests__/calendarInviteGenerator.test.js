// Stand-in for the database client: end_users lookups return whatever the test sets
let mockEndUsers = [];
let mockEndUsersError = null;
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        in: (_column, ids) => { query.ids = ids; return query; },
        then: (resolve) => resolve({
          data: mockEndUsersError ? null : mockEndUsers.filter((u) => query.ids.includes(u.id)),
          error: mockEndUsersError
        })
      };
      return query;
    }
  }
}));
// consoleUtils reads Vite-only settings, which Jest can't load
jest.mock('@core/utils/consoleUtils', () => ({ debugLog: () => {}, debugError: () => {}, debugWarn: () => {} }));

import { generateTrainingCalendar } from '../calendarInviteGenerator';

const PROJECT = 'proj-1';
const SCHEDULE = { id: 'sched-1', name: 'Test Schedule', project_id: PROJECT };

// A session as the assignment screen holds it: the database id is event_id (there is no id)
const session = (n, over = {}) => ({
  event_id: `uuid-${n}`,
  eventId: `A-session${n}-london-finance`,
  course_id: 'A',
  course_name: 'Course A',
  title: `Course A - Group ${n}`,
  functional_area: 'Finance',
  location: 'London',
  training_location: 'London',
  start: new Date(2026, 9, 12, 9, 30),
  end: new Date(2026, 9, 12, 12, 30),
  max_participants: 6,
  ...over
});

// An assignment row as stored: points at the session by its database id
const assignment = (userId, sessionUuid, over = {}) => ({
  id: `row-${userId}-${sessionUuid}`,
  end_user_id: userId,
  session_id: sessionUuid,
  assignment_level: 'session',
  session_identifier: 'something-that-does-not-match-the-event-id',
  user_name: `Person ${userId}`,
  user_email: `person${userId}@example.com`,
  ...over
});

// ICS text with its 75-character line folding undone, so values can be matched whole
const unfold = (content) => content.replace(/\r?\n[ \t]/g, '');

beforeEach(() => {
  mockEndUsers = [];
  mockEndUsersError = null;
});

describe('generateTrainingCalendar', () => {
  test('refuses to run without a project id (the error you saw when the screen forgot to pass it)', async () => {
    await expect(generateTrainingCalendar(SCHEDULE, [session(1)], [assignment(1, 'uuid-1')]))
      .rejects.toThrow('Project ID is required for calendar generation');
  });

  test('builds an event per session that has people, with the right attendees only', async () => {
    mockEndUsers = [1, 2, 3].map((id) => ({ id, name: `Person ${id}`, email: `person${id}@example.com`, project_role: 'Clerk' }));
    const sessions = [session(1), session(2), session(3)];
    const assignments = [assignment(1, 'uuid-1'), assignment(2, 'uuid-1'), assignment(3, 'uuid-2')]; // session 3 has nobody

    const result = await generateTrainingCalendar(SCHEDULE, sessions, assignments, PROJECT);

    expect(result.success).toBe(true);
    expect(result.eventCount).toBe(2); // session 3 has no attendees, so no event
    const ics = unfold(result.content);
    const event1 = ics.split('BEGIN:VEVENT').find((e) => e.includes('Course A - Group 1'));
    const event2 = ics.split('BEGIN:VEVENT').find((e) => e.includes('Course A - Group 2'));
    expect(event1).toMatch(/mailto:person1@example.com/);
    expect(event1).toMatch(/mailto:person2@example.com/);
    expect(event1).not.toMatch(/mailto:person3@example.com/);
    expect(event2).toMatch(/mailto:person3@example.com/);
    expect(event2).not.toMatch(/mailto:person1@example.com/);
  });

  test('matches people to a session by its database id (event_id), not only by name-like identifiers', async () => {
    mockEndUsers = [{ id: 1, name: 'Person 1', email: 'person1@example.com' }];
    const result = await generateTrainingCalendar(SCHEDULE, [session(1)], [assignment(1, 'uuid-1')], PROJECT);
    expect(result.success).toBe(true);
    expect(result.eventCount).toBe(1);
  });

  test('times are exported as local wall-clock times, not converted to UTC', async () => {
    mockEndUsers = [{ id: 1, name: 'Person 1', email: 'person1@example.com' }];
    const result = await generateTrainingCalendar(SCHEDULE, [session(1)], [assignment(1, 'uuid-1')], PROJECT);
    const ics = unfold(result.content);
    expect(ics).toMatch(/^DTSTART:20261012T093000\s*$/m);
    expect(ics).toMatch(/^DTEND:20261012T123000\s*$/m);
    expect(ics).not.toMatch(/^DT(START|END):.*Z\s*$/m);
  });

  test('the description has real line breaks, not a doubled backslash', async () => {
    mockEndUsers = [{ id: 1, name: 'Person 1', email: 'person1@example.com', project_role: 'Clerk' }];
    const result = await generateTrainingCalendar(SCHEDULE, [session(1, { trainer_name: 'Priya' })], [assignment(1, 'uuid-1')], PROJECT);
    const description = unfold(result.content).match(/^DESCRIPTION:(.*)$/m)[1];
    expect(description).toContain('Course: Course A\\nTrainer: Priya\\nDepartment: Finance');
    expect(description).not.toContain('\\\\n');
  });

  test('people not in end_users (MS Access projects) are found from the assignment rows', async () => {
    mockEndUsers = []; // an Access project has no end_users rows
    const assignments = [assignment(1, 'uuid-1'), assignment(2, 'uuid-1')];
    const result = await generateTrainingCalendar(SCHEDULE, [session(1)], assignments, PROJECT);
    expect(result.success).toBe(true);
    expect(result.userCount).toBe(2);
    const ics = unfold(result.content);
    expect(ics).toMatch(/CN="Person 1":mailto:person1@example.com/);
  });

  test('end_users wins when a person is in both, and a failed lookup falls back to the assignment rows', async () => {
    mockEndUsers = [{ id: 1, name: 'Real Name', email: 'real@example.com' }];
    let result = await generateTrainingCalendar(SCHEDULE, [session(1)], [assignment(1, 'uuid-1')], PROJECT);
    expect(unfold(result.content)).toMatch(/mailto:real@example.com/);
    expect(unfold(result.content)).not.toMatch(/mailto:person1@example.com/);

    mockEndUsersError = { message: 'boom' };
    result = await generateTrainingCalendar(SCHEDULE, [session(1)], [assignment(1, 'uuid-1')], PROJECT);
    expect(result.success).toBe(true);
    expect(unfold(result.content)).toMatch(/mailto:person1@example.com/);
  });

  test('people with no email anywhere are left out, and it says so if nobody has one', async () => {
    const noEmail = assignment(1, 'uuid-1', { user_email: null });
    const result = await generateTrainingCalendar(SCHEDULE, [session(1)], [noEmail], PROJECT);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No users with email addresses/);
  });

  test('reports a clear error when the schedule has no sessions', async () => {
    const result = await generateTrainingCalendar(SCHEDULE, [], [assignment(1, 'uuid-1')], PROJECT);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No sessions found/);
  });
});
