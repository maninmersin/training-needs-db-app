import { REFERENCE_TABS } from '../referenceConfig';
import { blankDraft, changedValues, draftToValues, filterItems, itemToDraft, validateDraft } from '../referenceLogic';

const LOCATIONS = REFERENCE_TABS.training_locations;
const ROLES = REFERENCE_TABS.project_roles;
const AREAS = REFERENCE_TABS.functional_areas;

const london = { id: 1, name: 'London', description: 'Head office', capacity: 20, classrooms_count: 3, display_order: 1, active: true, created_at: '2026-01-05T10:00:00Z' };

describe('filterItems', () => {
  const items = [london, { ...london, id: 2, name: 'Leeds', description: null, capacity: 0 }];

  test('searches every column, ignoring case; blank search keeps all', () => {
    expect(filterItems(LOCATIONS, items, '')).toHaveLength(2);
    expect(filterItems(LOCATIONS, items, 'HEAD').map((i) => i.id)).toEqual([1]);
    expect(filterItems(LOCATIONS, items, 'leeds').map((i) => i.id)).toEqual([2]);
    expect(filterItems(LOCATIONS, items, 'zzz')).toEqual([]);
  });

  test('a missing value never matches and never breaks the search', () => {
    expect(filterItems(LOCATIONS, items, 'null')).toEqual([]);
  });
});

describe('drafts', () => {
  test('a blank location starts active with the usual defaults and no read-only fields', () => {
    expect(blankDraft(LOCATIONS)).toEqual({ name: '', description: '', capacity: '1', classrooms_count: '1', display_order: '999', active: true });
    expect(blankDraft(ROLES)).toEqual({ project_role_name: '' });
  });

  test('a saved item becomes form text, with a missing description as empty', () => {
    expect(itemToDraft(LOCATIONS, { ...london, description: null })).toEqual({
      name: 'London', description: '', capacity: '20', classrooms_count: '3', display_order: '1', active: true
    });
  });
});

describe('validateDraft', () => {
  test('the name is required, using the right label for each list', () => {
    expect(validateDraft(LOCATIONS, { ...blankDraft(LOCATIONS), name: ' ' }).name).toBe('Name is required');
    expect(validateDraft(ROLES, { project_role_name: '' }).project_role_name).toBe('Role Name is required');
    expect(validateDraft(AREAS, { ...blankDraft(AREAS), name: 'Finance' })).toEqual({});
  });

  test('numbers may be blank or zero but must be whole and not negative', () => {
    const draft = { ...blankDraft(LOCATIONS), name: 'X' };
    expect(validateDraft(LOCATIONS, { ...draft, capacity: '' })).toEqual({});
    expect(validateDraft(LOCATIONS, { ...draft, capacity: '0' })).toEqual({});
    expect(validateDraft(LOCATIONS, { ...draft, capacity: '-1' }).capacity).toMatch(/whole number/);
    expect(validateDraft(LOCATIONS, { ...draft, classrooms_count: '2.5' }).classrooms_count).toMatch(/whole number/);
    expect(validateDraft(LOCATIONS, { ...draft, display_order: 'abc' }).display_order).toMatch(/whole number/);
  });
});

describe('what gets saved', () => {
  test('numbers are converted; blank becomes null but 0 stays 0 (it used to be lost)', () => {
    const values = draftToValues(LOCATIONS, { name: 'X', description: '', capacity: '0', classrooms_count: '', display_order: '5', active: false });
    expect(values).toEqual({ name: 'X', description: '', capacity: 0, classrooms_count: null, display_order: 5, active: false });
  });

  test('an unchanged item reports no changes (20 equals "20")', () => {
    expect(changedValues(LOCATIONS, london, itemToDraft(LOCATIONS, london))).toEqual({});
  });

  test('only edited fields are reported', () => {
    const draft = { ...itemToDraft(LOCATIONS, london), capacity: '25', active: false };
    expect(changedValues(LOCATIONS, london, draft)).toEqual({ capacity: 25, active: false });
  });

  test('clearing a number saves null; setting 0 saves 0', () => {
    expect(changedValues(LOCATIONS, london, { ...itemToDraft(LOCATIONS, london), capacity: '' })).toEqual({ capacity: null });
    expect(changedValues(LOCATIONS, london, { ...itemToDraft(LOCATIONS, london), capacity: '0' })).toEqual({ capacity: 0 });
  });
});
