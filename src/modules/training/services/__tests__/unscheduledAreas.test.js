let mockRpc;
let mockRows;
let mockCalls = [];
jest.mock('@core/services/supabaseClient', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (table) => {
      const call = { table, filters: [] };
      mockCalls.push(call);
      const query = {
        select: (columns) => { call.select = columns; return query; },
        eq: (column, value) => { call.filters.push(['eq', column, value]); return query; },
        in: (column, value) => { call.filters.push(['in', column, value]); return query; },
        order: () => query,
        range: () => Promise.resolve({ data: mockRows, error: null })
      };
      return query;
    }
  }
}));

import { findUnscheduled, summariseNeed } from '../unscheduledAreas';
import { getUnscheduledAreas } from '../attendanceService';

beforeEach(() => {
  mockRpc = jest.fn();
  mockRows = [];
  mockCalls = [];
});

describe('findUnscheduled', () => {
  test('keeps the areas that have no sessions, in their original order', () => {
    expect(findUnscheduled(['Finance', 'HR', 'Procurement', 'Supply Chain'], ['Supply Chain'])).toEqual(['Finance', 'HR', 'Procurement']);
  });

  test('ignores case and spaces when matching', () => {
    expect(findUnscheduled(['Supply Chain', 'Finance'], [' supply chain '])).toEqual(['Finance']);
  });

  test('blank names are dropped, and nothing scheduled means everything is unscheduled', () => {
    expect(findUnscheduled(['Finance', '', null], [])).toEqual(['Finance']);
    expect(findUnscheduled([], ['Finance'])).toEqual([]);
  });
});

describe('summariseNeed', () => {
  const rows = [
    { functional_area: 'Finance', user_id: '1', course_id: 'F1' },
    { functional_area: 'Finance', user_id: '1', course_id: 'F2' },
    { functional_area: 'Finance', user_id: '2', course_id: 'F1' },
    { functional_area: 'HR', user_id: '3', course_id: 'H1' }
  ];

  test('counts distinct people and distinct courses for each area', () => {
    expect(summariseNeed(['Finance', 'HR'], rows)).toEqual([
      { functional_area: 'Finance', people: 2, courses: 2 },
      { functional_area: 'HR', people: 1, courses: 1 }
    ]);
  });

  test('an area with no rows gets zeros, and the order of the areas is kept', () => {
    expect(summariseNeed(['HR', 'Procurement'], rows)).toEqual([
      { functional_area: 'HR', people: 1, courses: 1 },
      { functional_area: 'Procurement', people: 0, courses: 0 }
    ]);
  });
});

describe('getUnscheduledAreas', () => {
  test('needs a project', async () => {
    await expect(getUnscheduledAreas(null, [])).rejects.toThrow(/Project ID is required/);
  });

  test('lists the training needs areas without sessions, with how many people and courses each involves', async () => {
    mockRpc.mockResolvedValue({ data: [{ functional_area: 'Finance' }, { functional_area: 'HR' }, { functional_area: 'Supply Chain' }], error: null });
    mockRows = [
      { functional_area: 'Finance', user_id: '1', course_id: 'F1' },
      { functional_area: 'Finance', user_id: '2', course_id: 'F1' },
      { functional_area: 'HR', user_id: '3', course_id: 'H1' }
    ];
    const result = await getUnscheduledAreas('p1', ['Supply Chain']);
    expect(mockRpc).toHaveBeenCalledWith('get_distinct_functional_areas', { p_project_id: 'p1' });
    expect(result).toEqual([
      { functional_area: 'Finance', people: 2, courses: 1 },
      { functional_area: 'HR', people: 1, courses: 1 }
    ]);
    expect(mockCalls[0].table).toBe('training_data_combined');
    expect(mockCalls[0].filters).toEqual([['eq', 'project_id', 'p1'], ['in', 'functional_area', ['Finance', 'HR']]]);
  });

  test('when every area is scheduled it does not read the training needs at all', async () => {
    mockRpc.mockResolvedValue({ data: [{ functional_area: 'Finance' }], error: null });
    expect(await getUnscheduledAreas('p1', ['Finance'])).toEqual([]);
    expect(mockCalls).toHaveLength(0);
  });

  test('a database error is raised', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('function does not exist') });
    await expect(getUnscheduledAreas('p1', [])).rejects.toThrow('function does not exist');
  });
});
