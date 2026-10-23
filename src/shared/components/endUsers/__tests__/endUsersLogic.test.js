import {
  BLANK, NOT_BLANK, activeFilterCount, blankDraft, changedFields, coerceValue, columnLabel, draftToRow, filterUsers,
  groupColumns, orderColumns, uniqueColumnValues, validateDraft
} from '../endUsersLogic';

const col = (name, data_type = 'text') => ({ column_name: name, data_type });
const SCHEMA = [col('created_at'), col('project_role'), col('extra_note'), col('id', 'integer'), col('name'), col('project_id'), col('email'), col('updated_at'), col('training_location'), col('age', 'integer')];

const USERS = [
  { id: 1, name: 'Amelia Brown', email: 'a@x.com', division: 'Finance', age: 30 },
  { id: 2, name: 'Oliver Patel', email: 'o@x.com', division: '', age: null },
  { id: 3, name: 'Isla Walker', email: null, division: 'HR', age: 0 }
];
const COLUMNS = [col('id', 'integer'), col('name'), col('email'), col('division')];

describe('orderColumns', () => {
  test('hides system columns, puts known columns first in the set order, keeps the rest in original order after', () => {
    expect(orderColumns(SCHEMA).map((c) => c.column_name)).toEqual(['id', 'name', 'email', 'training_location', 'project_role', 'extra_note', 'age']);
  });
});

describe('labels', () => {
  test('column names become readable headings', () => {
    expect(columnLabel('sub_division')).toBe('Sub Division');
    expect(columnLabel('id')).toBe('Id');
  });
});

describe('filterUsers', () => {
  test('no search and no filters keeps everyone', () => {
    expect(filterUsers(USERS, COLUMNS, '', {})).toHaveLength(3);
  });

  test('search matches any column, ignoring case and surrounding spaces', () => {
    expect(filterUsers(USERS, COLUMNS, '  PATEL ', {}).map((u) => u.id)).toEqual([2]);
    expect(filterUsers(USERS, COLUMNS, 'x.com', {}).map((u) => u.id)).toEqual([1, 2]);
  });

  test('a null value is not matched by the word "null"', () => {
    expect(filterUsers(USERS, COLUMNS, 'null', {})).toHaveLength(0);
  });

  test('a column filter keeps rows matching any chosen value', () => {
    expect(filterUsers(USERS, COLUMNS, '', { division: ['Finance', 'HR'] }).map((u) => u.id)).toEqual([1, 3]);
  });

  test('(blank) and (not blank) work, and an empty selection means no filter', () => {
    expect(filterUsers(USERS, COLUMNS, '', { division: [BLANK] }).map((u) => u.id)).toEqual([2]);
    expect(filterUsers(USERS, COLUMNS, '', { division: [NOT_BLANK] }).map((u) => u.id)).toEqual([1, 3]);
    expect(filterUsers(USERS, COLUMNS, '', { division: [] })).toHaveLength(3);
  });

  test('a number zero counts as a value, not as blank', () => {
    expect(filterUsers(USERS, COLUMNS, '', { age: [NOT_BLANK] }).map((u) => u.id)).toEqual([1, 3]);
    expect(filterUsers(USERS, COLUMNS, '', { age: ['0'] }).map((u) => u.id)).toEqual([3]);
  });

  test('search and filters combine', () => {
    expect(filterUsers(USERS, COLUMNS, 'a', { division: ['HR'] }).map((u) => u.id)).toEqual([3]);
  });
});

describe('filter helpers', () => {
  test('unique values are sorted, non-blank text', () => {
    expect(uniqueColumnValues(USERS, 'division')).toEqual(['Finance', 'HR']);
    expect(uniqueColumnValues(USERS, 'age')).toEqual(['0', '30']);
  });

  test('counts selected filter values across columns', () => {
    expect(activeFilterCount({ a: ['x', 'y'], b: [], c: ['z'], d: undefined })).toBe(3);
  });
});

describe('editing', () => {
  const user = { id: 1, name: 'Amelia', age: 30, division: 'Finance' };
  const cols = [col('id', 'integer'), col('name'), col('age', 'integer'), col('division')];

  test('integer fields convert, blank becomes null', () => {
    expect(coerceValue(col('age', 'integer'), '42')).toBe(42);
    expect(coerceValue(col('age', 'integer'), '')).toBeNull();
    expect(coerceValue(col('name'), 'x')).toBe('x');
  });

  test('only changed fields are reported, comparing 30 with "30" as equal', () => {
    expect(changedFields(user, { id: 1, name: 'Amelia', age: '30', division: 'HR' }, cols)).toEqual({ division: 'HR' });
    expect(changedFields(user, { ...user }, cols)).toEqual({});
    expect(changedFields(user, { ...user, age: '' }, cols)).toEqual({ age: null });
  });

  test('adding needs an ID, and integer fields must be numbers', () => {
    expect(validateDraft({ id: ' ', age: '' }, cols, { isNew: true })).toEqual({ id: 'Employee ID is required' });
    expect(validateDraft({ id: '5', age: 'abc' }, cols, { isNew: true })).toEqual({ age: 'Enter a whole number' });
    expect(validateDraft({ id: '5', age: '7' }, cols, { isNew: true })).toEqual({});
  });

  test('editing does not re-check the ID', () => {
    expect(validateDraft({ id: '', age: '' }, cols, { isNew: false })).toEqual({});
  });

  test('a blank new person starts empty with the first training location', () => {
    const draft = blankDraft([col('id'), col('name'), col('training_location')], [{ name: 'London' }, { name: 'Leeds' }]);
    expect(draft).toEqual({ id: '', name: '', training_location: 'London' });
  });

  test('the row to insert has numbers converted and blank integer fields left out', () => {
    expect(draftToRow({ id: ' 7 ', name: 'Pat', age: '' }, [col('id'), col('name'), col('age', 'integer')])).toEqual({ id: '7', name: 'Pat' });
    expect(draftToRow({ id: '7', age: '41' }, [col('id'), col('age', 'integer')])).toEqual({ id: '7', age: 41 });
  });
});

describe('groupColumns', () => {
  test('groups known columns into sections and puts unknown ones under Other', () => {
    const groups = groupColumns([col('id'), col('name'), col('division'), col('project_role'), col('shoe_size')]);
    expect(groups.map((g) => [g.title, g.columns.map((c) => c.column_name)])).toEqual([
      ['Person', ['id', 'name']],
      ['Where they work', ['division']],
      ['Training', ['project_role']],
      ['Other', ['shoe_size']]
    ]);
  });

  test('empty sections are left out', () => {
    expect(groupColumns([col('name')]).map((g) => g.title)).toEqual(['Person']);
  });
});
