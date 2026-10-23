import {
  DEFAULT_PERMISSIONS, countPermissions, defaultPermissionRows, groupPermissions, hasPermission, isProtectedRole, normalizePermission,
  permissionName, titleCase, validatePermission, validateRole
} from '../rolesLogic';

describe('built-in roles', () => {
  test('admin and super_admin cannot be deleted, however they are written', () => {
    ['admin', 'super_admin', 'Admin', ' SUPER_ADMIN '].forEach((name) => expect(isProtectedRole(name)).toBe(true));
  });

  test('other roles can', () => {
    ['stakeholder_assignment_editor', 'administrator', 'manager', '', null, undefined].forEach((name) => expect(isProtectedRole(name)).toBe(false));
  });
});

describe('default permissions', () => {
  test('there are 24, each resource:action name is unique, and the rows match', () => {
    const rows = defaultPermissionRows();
    expect(rows).toHaveLength(DEFAULT_PERMISSIONS.length);
    expect(DEFAULT_PERMISSIONS).toHaveLength(24);
    expect(new Set(rows.map((row) => row.name)).size).toBe(24);
    expect(rows[0]).toEqual({ name: 'users:create', description: 'Create new users', resource: 'users', action: 'create' });
    expect(rows.every((row) => row.name === `${row.resource}:${row.action}`)).toBe(true);
  });

  test('permission names are resource:action', () => {
    expect(permissionName('reference_data', 'update')).toBe('reference_data:update');
  });
});

describe('validateRole', () => {
  const roles = [{ name: 'Manager' }, { name: 'Trainer' }];

  test('needs a name that is not already taken, ignoring case and spaces', () => {
    expect(validateRole({ name: '  ', description: '' }, roles).name).toBe('Role name is required');
    expect(validateRole({ name: ' manager ', description: '' }, roles).name).toBe('A role with that name already exists');
    expect(validateRole({ name: 'Auditor', description: '' }, roles)).toEqual({});
  });
});

describe('permissions', () => {
  const existing = [{ name: 'users:read' }];

  test('what is typed is tidied to lower case without surrounding spaces', () => {
    expect(normalizePermission({ resource: '  Reference_Data ', action: ' READ ', description: ' View ' })).toEqual({ resource: 'reference_data', action: 'read', description: 'View' });
  });

  test('resource and action are required and must be plain words', () => {
    expect(validatePermission({ resource: '', action: '' }, existing)).toEqual({ resource: 'Resource is required', action: 'Action is required' });
    expect(validatePermission({ resource: 'my resource', action: 'read' }, existing).resource).toMatch(/letters, numbers and underscores/);
    expect(validatePermission({ resource: 'users', action: 'read-only' }, existing).action).toMatch(/letters, numbers and underscores/);
    expect(validatePermission({ resource: '1users', action: 'read' }, existing).resource).toMatch(/letters, numbers and underscores/);
  });

  test('a permission that already exists is refused, a new one is fine', () => {
    expect(validatePermission({ resource: 'users', action: 'read' }, existing).action).toBe('That permission already exists');
    expect(validatePermission({ resource: 'users', action: 'export' }, existing)).toEqual({});
  });
});

describe('grouping and counting', () => {
  const permissions = [
    { id: 3, resource: 'users', action: 'read' },
    { id: 1, resource: 'courses', action: 'read' },
    { id: 2, resource: 'users', action: 'create' }
  ];
  const links = [{ role_id: 'r1', permission_id: 1 }, { role_id: 'r1', permission_id: 3 }, { role_id: 'r2', permission_id: 1 }];

  test('permissions are grouped by resource, resources in alphabetical order', () => {
    const groups = groupPermissions(permissions);
    expect(groups.map(([resource, list]) => [resource, list.map((p) => p.id)])).toEqual([['courses', [1]], ['users', [3, 2]]]);
    expect(groupPermissions([])).toEqual([]);
  });

  test('knows whether a role has a permission and how many it has', () => {
    expect(hasPermission(links, 'r1', 3)).toBe(true);
    expect(hasPermission(links, 'r2', 3)).toBe(false);
    expect(countPermissions(links, 'r1')).toBe(2);
    expect(countPermissions(links, 'nobody')).toBe(0);
  });

  test('resource names read as headings', () => {
    expect(titleCase('reference_data')).toBe('Reference data');
    expect(titleCase('users')).toBe('Users');
  });
});
