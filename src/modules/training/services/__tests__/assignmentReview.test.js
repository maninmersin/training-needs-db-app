// An in-memory stand-in for the database (returns at most 1000 rows per request, like the real API)
let mockTables = {};
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      let rows = [...(mockTables[table] || [])];
      const query = {
        select: () => query,
        eq: (column, value) => { rows = rows.filter((r) => r[column] === value); return query; },
        in: (column, values) => { rows = rows.filter((r) => values.includes(r[column])); return query; },
        order: (column) => { rows = [...rows].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0)); return query; },
        range: (from, to) => Promise.resolve({ data: rows.slice(from, Math.min(to, from + 999) + 1), error: null }),
        then: (resolve) => resolve({ data: rows.slice(0, 1000), error: null })
      };
      return query;
    }
  }
}));
jest.mock('../assignmentMoveService', () => ({
  SESSION_COLUMNS: 'id',
  saveMove: jest.fn()
}));

import { saveMove } from '../assignmentMoveService';
import { parseReviewRows } from '../../components/assignments/reviewSheet';
import { loadReviewData, previewReviewImport, applyReviewImport } from '../assignmentReviewService';

const PROJECT = 'proj-1';
const SCHEDULE = { id: 'sched-1', name: 'S', project_id: PROJECT };

const session = (id, n, part = 1) => ({
  id, schedule_id: 'sched-1', course_id: 'A', course_name: 'Course A', session_number: n, session_part_number: part,
  session_identifier: `A-s${n}-p${part}`, start_datetime: `2026-10-${12 + n}T09:30:00`, end_datetime: `2026-10-${12 + n}T12:30:00`,
  training_location: 'London', functional_area: 'Finance', classroom_number: n, max_attendees: 5, instructor_name: ''
});
const assignment = (id, userId, sessionId) => ({
  id, schedule_id: 'sched-1', end_user_id: userId, session_id: sessionId, course_id: 'A',
  user_name: `Person ${userId}`, user_email: `p${userId}@x.com`, training_location: 'London', functional_area: 'Finance'
});

const fileRow = (userId, moveTo, over = {}) => ({
  Person: `Person ${userId}`, 'Training Location': 'London', 'Functional Area': 'Finance', Course: 'Course A',
  'Current Group': 'Group 1', 'Move To Group': moveTo, 'Change Reason': '',
  'Person ID (do not change)': userId, 'Course ID (do not change)': 'A', ...over
});
const items = (rows) => parseReviewRows(rows).items;

beforeEach(() => {
  jest.clearAllMocks();
  saveMove.mockResolvedValue([]);
  mockTables = {
    training_sessions: [session('s1', 1), session('s2', 2), session('s3', 3)],
    user_assignments: [assignment('a1', 1, 's1'), assignment('a2', 2, 's1'), assignment('a3', 3, 's1')],
    end_users: [{ id: 1, project_id: PROJECT, name: 'Person 1' }],
    training_data_combined: []
  };
});

describe('loadReviewData', () => {
  test('reads only this schedule\'s sessions and assignments, and looks people up', async () => {
    mockTables.training_sessions.push({ ...session('other', 1), schedule_id: 'another' });
    mockTables.user_assignments.push({ ...assignment('ax', 9, 'other'), schedule_id: 'another' });
    const data = await loadReviewData({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(data.sessions).toHaveLength(3);
    expect(data.assignments).toHaveLength(3);
    expect(data.directory.get(1).name).toBe('Person 1');
  });

  test('is not capped at 1000 rows', async () => {
    mockTables.user_assignments = Array.from({ length: 2500 }, (_, i) => assignment(`a${String(i).padStart(5, '0')}`, (i % 40) + 1, 's1'));
    const data = await loadReviewData({ scheduleId: 'sched-1', projectId: PROJECT });
    expect(data.assignments).toHaveLength(2500);
  });

  test('needs a schedule', async () => {
    await expect(loadReviewData({ scheduleId: null, projectId: PROJECT })).rejects.toThrow('No schedule selected');
  });
});

describe('previewReviewImport', () => {
  test('plans the moves against the current data and changes nothing', async () => {
    const { results, summary } = await previewReviewImport({ items: items([fileRow(1, 2), fileRow(2, 3)]), schedule: SCHEDULE, projectId: PROJECT });
    expect(summary.ok).toBe(2);
    expect(results.map((r) => r.toGroup)).toEqual([2, 3]);
    expect(saveMove).not.toHaveBeenCalled();
  });

  test('passes the stakeholder\'s scope through', async () => {
    const { results } = await previewReviewImport({
      items: items([fileRow(1, 2)]), schedule: SCHEDULE, projectId: PROJECT, filters: { locations: ['Manchester'] }
    });
    expect(results[0].status).toBe('error');
  });
});

describe('applyReviewImport', () => {
  test('saves each planned move once and reports them as applied', async () => {
    const { outcomes, summary } = await applyReviewImport({ items: items([fileRow(1, 2), fileRow(2, 3)]), schedule: SCHEDULE, projectId: PROJECT });
    expect(saveMove).toHaveBeenCalledTimes(2);
    expect(saveMove.mock.calls[0][0].deleteIds).toEqual(['a1']);
    expect(summary).toEqual({ applied: 2, failed: 0, notApplied: 0 });
    expect(outcomes.every((o) => o.ok && o.applied)).toBe(true);
  });

  test('rows that cannot be applied are reported and never saved', async () => {
    const rows = [fileRow(1, 9), fileRow(2, 3), fileRow(3, 'later')];
    const { outcomes, summary } = await applyReviewImport({ items: items(rows), schedule: SCHEDULE, projectId: PROJECT });
    expect(saveMove).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ applied: 1, failed: 0, notApplied: 2 });
    expect(outcomes.filter((o) => !o.applied).map((o) => o.rowNumber)).toEqual([2, 4]);
  });

  test('one failing save does not stop or undo the others, and says so plainly', async () => {
    saveMove
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Expected to remove 1 assignments but removed 0 - they may have changed'))
      .mockResolvedValueOnce([]);
    const { outcomes, summary } = await applyReviewImport({
      items: items([fileRow(1, 2), fileRow(2, 2), fileRow(3, 2)]), schedule: SCHEDULE, projectId: PROJECT
    });
    expect(saveMove).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({ applied: 2, failed: 1, notApplied: 0 });
    expect(outcomes[1]).toMatchObject({ ok: false, applied: false });
    expect(outcomes[1].message).toMatch(/changed by someone else.*Nothing was changed/);
  });

  test('a duplicate-booking failure is explained', async () => {
    saveMove.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "unique_user_session"'));
    const { outcomes } = await applyReviewImport({ items: items([fileRow(1, 2)]), schedule: SCHEDULE, projectId: PROJECT });
    expect(outcomes[0].message).toMatch(/already booked.*Nothing was changed/);
  });

  test('works from the database as it is now: someone moved since the preview, so the row is not applied', async () => {
    // preview time: person 1 is in group 1; before apply, they are moved to group 3 by someone else
    mockTables.user_assignments = [assignment('a1', 1, 's3')];
    const { outcomes, summary } = await applyReviewImport({ items: items([fileRow(1, 2)]), schedule: SCHEDULE, projectId: PROJECT });
    expect(saveMove).not.toHaveBeenCalled();
    expect(summary.notApplied).toBe(1);
    expect(outcomes[0].message).toMatch(/Out of date/);
  });

  test('full groups are only included when allowed', async () => {
    mockTables.training_sessions = [{ ...session('s1', 1) }, { ...session('s2', 2), max_attendees: 1 }];
    mockTables.user_assignments = [assignment('a1', 1, 's1'), assignment('a2', 2, 's2')]; // group 2 already full
    let result = await applyReviewImport({ items: items([fileRow(1, 2)]), schedule: SCHEDULE, projectId: PROJECT });
    expect(saveMove).not.toHaveBeenCalled();
    expect(result.outcomes[0].status).toBe('blocked');

    result = await applyReviewImport({ items: items([fileRow(1, 2)]), schedule: SCHEDULE, projectId: PROJECT, allowFull: true });
    expect(saveMove).toHaveBeenCalledTimes(1);
    expect(result.outcomes[0].status).toBe('warning');
  });
});
