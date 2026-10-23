import { loadAllTrainingData, loadCurrentStats, replaceTrainingData } from '../accessImportService';

// A stand-in for the database that holds training_data rows, returns at most 1000 rows per request, assigns
// ids, and can be made to fail on a chosen insert or delete.
const makeDb = ({ existing = [], failInsertOnCall = null, failDeleteWhen = null, idPrefix = 'new' } = {}) => {
  let nextId = 1;
  const state = { rows: existing.map((id) => ({ id, project_id: 'p1', old: true })), log: [], inserts: 0 };
  const db = {
    rpc: jest.fn(),
    from: (table) => {
      const call = { table, op: 'select', filters: [], rows: null };
      const run = () => {
        state.log.push(`${call.op} ${call.table}`);
        if (call.op === 'insert') {
          state.inserts += 1;
          if (failInsertOnCall === state.inserts) return { data: null, error: { message: 'insert refused' } };
          const added = call.rows.map((row) => ({ ...row, id: `${idPrefix}-${nextId++}` }));
          state.rows.push(...added);
          return { data: added.map((r) => ({ id: r.id })), error: null };
        }
        if (call.op === 'delete') {
          const ids = call.filters.find(([kind, column]) => kind === 'in' && column === 'id')?.[2] || [];
          if (failDeleteWhen && failDeleteWhen(ids)) return { data: null, error: { message: 'delete refused' } };
          state.rows = state.rows.filter((row) => !ids.includes(row.id));
          return { data: null, error: null };
        }
        return { data: state.rows.slice(0, 1000).map((row) => ({ id: row.id })), error: null, count: state.rows.length };
      };
      const query = {
        select: (columns, options) => { call.options = options; return query; },
        insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
        delete: () => { call.op = 'delete'; return query; },
        eq: (column, value) => { call.filters.push(['eq', column, value]); return query; },
        in: (column, value) => { call.filters.push(['in', column, value]); return query; },
        order: () => query,
        range: (from, to) => Promise.resolve((() => {
          const all = state.rows.map((row) => ({ id: row.id }));
          return { data: all.slice(from, to + 1), error: null };
        })()),
        then: (resolve) => resolve(run())
      };
      return query;
    }
  };
  return { db, state };
};

const rows = (n) => Array.from({ length: n }, (_, i) => ({ project_id: 'p1', user_id: String(i) }));
const idsOf = (state) => state.rows.map((r) => r.id);

describe('replaceTrainingData', () => {
  test('puts the new rows in and removes every old one, in batches', async () => {
    const { db, state } = makeDb({ existing: ['o1', 'o2', 'o3'] });
    const result = await replaceTrainingData(db, 'p1', rows(1200));
    expect(result).toEqual({ inserted: 1200, removed: 3 });
    expect(state.rows).toHaveLength(1200);
    expect(state.rows.some((r) => r.old)).toBe(false);
    expect(state.log.filter((entry) => entry === 'insert training_data')).toHaveLength(3); // 500 + 500 + 200
  });

  test('ALL the new rows are in before ANY old row is removed (so the project is never left empty)', async () => {
    const { db, state } = makeDb({ existing: ['o1'] });
    await replaceTrainingData(db, 'p1', rows(600));
    const lastInsert = state.log.lastIndexOf('insert training_data');
    const firstDelete = state.log.indexOf('delete training_data');
    expect(lastInsert).toBeLessThan(firstDelete);
  });

  test('if a batch fails, the new rows already added are removed and the old data is untouched', async () => {
    const { db, state } = makeDb({ existing: ['o1', 'o2'], failInsertOnCall: 2 });
    await expect(replaceTrainingData(db, 'p1', rows(1200))).rejects.toThrow(/stopped at batch 2: insert refused\. Your existing data was kept\.$/);
    expect(idsOf(state)).toEqual(['o1', 'o2']);
  });

  test('a failure on the very first batch leaves the old data and adds nothing', async () => {
    const { db, state } = makeDb({ existing: ['o1'], failInsertOnCall: 1 });
    await expect(replaceTrainingData(db, 'p1', rows(10))).rejects.toThrow(/batch 1/);
    expect(idsOf(state)).toEqual(['o1']);
  });

  test('if the rollback itself fails, it says so and tells you to run the import again', async () => {
    const { db } = makeDb({ existing: ['o1'], failInsertOnCall: 2, failDeleteWhen: (ids) => ids.some((id) => String(id).startsWith('new-')) });
    await expect(replaceTrainingData(db, 'p1', rows(700))).rejects.toThrow(/could not be removed again; run the import once more to clean up/);
  });

  test('if removing the old rows fails, nothing is lost: both sets stay and the message says to run it again', async () => {
    const { db, state } = makeDb({ existing: ['o1', 'o2'], failDeleteWhen: () => true });
    await expect(replaceTrainingData(db, 'p1', rows(5))).rejects.toThrow(/new data was imported, but the old rows could not all be removed.*Run the import again/);
    expect(state.rows).toHaveLength(7);
  });

  test('running it again after that failure ends with only the new data', async () => {
    const { db, state } = makeDb({ existing: ['o1'], failDeleteWhen: () => true });
    await expect(replaceTrainingData(db, 'p1', rows(3))).rejects.toThrow();
    const again = makeDb({ idPrefix: 'again' });
    again.state.rows = state.rows; // the database as the failed run left it: 1 old + 3 new
    await replaceTrainingData(again.db, 'p1', rows(3));
    expect(again.state.rows).toHaveLength(3);
    expect(again.state.rows.every((r) => String(r.id).startsWith('again-'))).toBe(true);
  });

  test('with no rows currently there it just inserts', async () => {
    const { db, state } = makeDb();
    expect(await replaceTrainingData(db, 'p1', rows(2))).toEqual({ inserted: 2, removed: 0 });
    expect(state.rows).toHaveLength(2);
  });

  test('reports progress', async () => {
    const { db } = makeDb({ existing: ['o1'] });
    const seen = [];
    await replaceTrainingData(db, 'p1', rows(600), (done, total, phase) => seen.push([done, total, phase]));
    expect(seen[0][2]).toBe('Reading the current data...');
    expect(seen.some(([, , phase]) => /Importing records 1 to 500 of 600/.test(phase))).toBe(true);
    expect(seen[seen.length - 1][2]).toMatch(/Removing the old data/);
  });
});

describe('loadCurrentStats', () => {
  test('uses the project statistics when they are available', async () => {
    const { db } = makeDb();
    db.rpc.mockResolvedValue({ data: [{ total_assignments: 10, unique_users: 4 }], error: null });
    expect(await loadCurrentStats(db, 'p1')).toEqual({ total_assignments: 10, unique_users: 4 });
    expect(db.rpc).toHaveBeenCalledWith('get_training_data_stats', { p_project_id: 'p1' });
  });

  test('falls back to counting rows when the function is not available', async () => {
    const { db } = makeDb({ existing: ['a', 'b', 'c'] });
    db.rpc.mockResolvedValue({ data: null, error: { message: 'missing' } });
    expect(await loadCurrentStats(db, 'p1')).toEqual({ total_assignments: 3 });
  });
});

describe('loadAllTrainingData', () => {
  test('reads past the 1000-row limit', async () => {
    const { db } = makeDb({ existing: Array.from({ length: 2300 }, (_, i) => `r${i}`) });
    expect(await loadAllTrainingData(db, 'p1')).toHaveLength(2300);
  });
});
