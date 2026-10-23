let mockCalls = [];
let mockResults = {};
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const call = { table, op: 'select', filters: [], rows: null, options: null };
      mockCalls.push(call);
      const answer = () => (typeof mockResults[table] === 'function' ? mockResults[table](call) : mockResults[table]) || { data: [], error: null };
      const query = {
        select: () => query,
        upsert: (rows, options) => { call.op = 'upsert'; call.rows = rows; call.options = options; return query; },
        insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
        eq: (column, value) => { call.filters.push([column, value]); return query; },
        order: () => query,
        limit: () => query,
        range: () => Promise.resolve(answer()),
        then: (resolve) => resolve(answer())
      };
      return query;
    }
  }
}));

import { buildMeetingState, meetingUid } from '../meetingState';
import { planInviteChanges } from '../planChanges';
import { recordSent } from '../ledger';
import { loadLedger, loadSendLog, saveSent } from '../../services/calendarInviteService';

beforeEach(() => {
  mockCalls = [];
  mockResults = {};
});

const person = (id) => ({ id, name: `Person ${id}`, email: `p${id}@x.com` });
const session = (id, over = {}) => ({ id, title: 'Ledger Basics', courseName: '', location: 'London', room: 1, trainer: '', functionalArea: '', start: '2026-10-12T09:30', end: '2026-10-12T12:30', ...over });
const stateOf = (s, people) => buildMeetingState({ session: s, people }).state;
const NOW = new Date('2026-10-14T10:00:00Z');
const CONTEXT = { projectId: 'p1', scheduleId: 'sch1', userId: 'u1', now: NOW };

describe('recordSent', () => {
  test('a new meeting is remembered at version 0 with exactly what was sent, and logged', () => {
    const { items } = planInviteChanges({ sessions: [{ session: session('s1'), people: [person(1), person(2)] }], ledger: [] });
    const { invites, logs } = recordSent(items, CONTEXT);
    expect(invites).toEqual([{
      project_id: 'p1', schedule_id: 'sch1', session_id: 's1', uid: meetingUid('s1'), sequence: 0, status: 'active',
      snapshot: items[0].current, last_sent_at: NOW.toISOString(), last_sent_by: 'u1'
    }]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ project_id: 'p1', uid: meetingUid('s1'), action: 'request', sequence: 0, provider: 'ics', test_mode: false, sent_by: 'u1' });
  });

  test('after recording, planning again finds nothing (so the same change is never sent twice)', () => {
    const sessions = [{ session: session('s1'), people: [person(1)] }];
    const { invites } = recordSent(planInviteChanges({ sessions, ledger: [] }).items, CONTEXT);
    const ledger = invites.map((row, i) => ({ ...row, id: `inv${i}` }));
    expect(planInviteChanges({ sessions, ledger }).items).toEqual([]);
  });

  test('an update keeps the new snapshot and version; one that also removes someone logs both actions', () => {
    const old = { id: 'inv1', session_id: 's1', uid: meetingUid('s1'), sequence: 2, status: 'active', snapshot: stateOf(session('s1'), [person(1), person(2)]) };
    const { items } = planInviteChanges({ sessions: [{ session: session('s1', { room: 9 }), people: [person(1)] }], ledger: [old] });
    const { invites, logs } = recordSent(items, CONTEXT);
    expect(invites[0]).toMatchObject({ sequence: 3, status: 'active' });
    expect(invites[0].snapshot.room).toBe('9');
    expect(invites[0].snapshot.attendees).toHaveLength(1);
    expect(logs.map((l) => l.action)).toEqual(['update', 'cancel_attendees']);
  });

  test('a cancellation marks the meeting cancelled and keeps what was sent, so it is not cancelled again', () => {
    const old = { id: 'inv1', session_id: null, uid: meetingUid('s1'), sequence: 1, status: 'active', snapshot: stateOf(session('s1'), [person(1)]) };
    const { items } = planInviteChanges({ sessions: [], ledger: [old] });
    const { invites, logs } = recordSent(items, CONTEXT);
    expect(invites[0]).toMatchObject({ status: 'cancelled', sequence: 2, session_id: null, snapshot: old.snapshot });
    expect(logs[0].action).toBe('cancel');
    expect(planInviteChanges({ sessions: [], ledger: [{ ...invites[0], id: 'inv1' }] }).items).toEqual([]);
  });

  test('a test send is logged as a test but never changes what is remembered', () => {
    const { items } = planInviteChanges({ sessions: [{ session: session('s1'), people: [person(1)] }], ledger: [] });
    const { invites, logs } = recordSent(items, { ...CONTEXT, testMode: true });
    expect(invites).toEqual([]);
    expect(logs[0].test_mode).toBe(true);
  });
});

describe('calendarInviteService', () => {
  test('loadLedger reads this schedule\'s meetings for this project, and needs a project', async () => {
    mockResults.calendar_invites = { data: [{ id: 'i1', uid: 'u' }], error: null };
    expect(await loadLedger('p1', 'sch1')).toEqual([{ id: 'i1', uid: 'u' }]);
    expect(mockCalls[0].filters).toEqual([['project_id', 'p1'], ['schedule_id', 'sch1']]);
    await expect(loadLedger(null, 'sch1')).rejects.toThrow(/Project ID is required/);
  });

  test('saving remembers the meetings first, then logs each send against its meeting', async () => {
    mockResults.calendar_invites = { data: [{ id: 'inv-a', uid: 'uid-a' }], error: null };
    await saveSent({
      invites: [{ project_id: 'p1', uid: 'uid-a' }],
      logs: [{ project_id: 'p1', uid: 'uid-a', action: 'request' }, { project_id: 'p1', uid: 'uid-other', action: 'cancel' }]
    });
    expect(mockCalls.map((c) => `${c.table} ${c.op}`)).toEqual(['calendar_invites upsert', 'calendar_send_log insert']);
    expect(mockCalls[0].options).toEqual({ onConflict: 'project_id,uid' });
    expect(mockCalls[1].rows.map((r) => r.invite_id)).toEqual(['inv-a', null]);
  });

  test('if remembering fails, nothing is logged as sent', async () => {
    mockResults.calendar_invites = { data: null, error: new Error('denied') };
    await expect(saveSent({ invites: [{ uid: 'a' }], logs: [{ uid: 'a' }] })).rejects.toThrow('denied');
    expect(mockCalls.some((c) => c.table === 'calendar_send_log')).toBe(false);
  });

  test('a test send only writes log rows', async () => {
    await saveSent({ invites: [], logs: [{ project_id: 'p1', uid: 'x', action: 'request', test_mode: true }] });
    expect(mockCalls.map((c) => c.table)).toEqual(['calendar_send_log']);
  });

  test('loadSendLog returns the history, and raises errors', async () => {
    mockResults.calendar_send_log = { data: [{ id: 'l1' }], error: null };
    expect(await loadSendLog('p1')).toEqual([{ id: 'l1' }]);
    mockResults.calendar_send_log = { data: null, error: new Error('boom') };
    await expect(loadSendLog('p1')).rejects.toThrow('boom');
  });
});
