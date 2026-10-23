import {
  administratorIds, deleteBlockedReason, diffRoles, filterUsers, joinUsersWithRoles, roleChangeBlockedReason, roleIdsOf, roleNamesOf, toggleId,
  validateUserForm
} from '../usersLogic';

const role = (id, name) => ({ id, name, description: '' });
const ROLES = [role('r-admin', 'admin'), role('r-super', 'super_admin'), role('r-trainer', 'trainer')];
const user = (id, email, roleNames = []) => ({
  id, email,
  auth_user_roles: roleNames.map((name) => { const r = ROLES.find((x) => x.name === name); return { role_id: r.id, auth_roles: r }; })
});

describe('joinUsersWithRoles', () => {
  test('attaches each user\'s roles, and names a role that no longer exists "Unknown Role"', () => {
    const users = [{ id: 'u1', email: 'a@x.com' }, { id: 'u2', email: 'b@x.com' }];
    const links = [{ user_id: 'u1', role_id: 'r-admin' }, { user_id: 'u1', role_id: 'gone' }];
    const joined = joinUsersWithRoles(users, links, ROLES);
    expect(roleNamesOf(joined[0])).toEqual(['admin', 'Unknown Role']);
    expect(joined[1].auth_user_roles).toEqual([]);
  });
});

describe('role helpers', () => {
  test('role names and ids, tolerating a user with no roles loaded', () => {
    const u = user('u1', 'a@x.com', ['admin', 'trainer']);
    expect(roleNamesOf(u)).toEqual(['admin', 'trainer']);
    expect(roleIdsOf(u)).toEqual(['r-admin', 'r-trainer']);
    expect(roleNamesOf({ id: 'x', email: 'x' })).toEqual([]);
  });

  test('toggling adds a missing id and removes a present one', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('a roles change is described as ids to add and ids to remove', () => {
    expect(diffRoles(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] });
    expect(diffRoles(['a'], ['a'])).toEqual({ add: [], remove: [] });
  });
});

describe('filterUsers', () => {
  const users = [user('u1', 'Amelia@x.com', ['trainer']), user('u2', 'oliver@y.com', ['admin']), user('u3', 'isla@x.com')];

  test('by any part of the email, ignoring case and spaces', () => {
    expect(filterUsers(users, ' AMEL ', '').map((u) => u.id)).toEqual(['u1']);
    expect(filterUsers(users, '@x.com', '').map((u) => u.id)).toEqual(['u1', 'u3']);
    expect(filterUsers(users, '', '')).toHaveLength(3);
  });

  test('by role, and the two together', () => {
    expect(filterUsers(users, '', 'r-admin').map((u) => u.id)).toEqual(['u2']);
    expect(filterUsers(users, '@x.com', 'r-trainer').map((u) => u.id)).toEqual(['u1']);
    expect(filterUsers(users, '@y.com', 'r-trainer')).toEqual([]);
  });
});

describe('validateUserForm', () => {
  test('creating needs a valid email and a password of at least 6 characters; roles are optional', () => {
    expect(validateUserForm({ email: '', password: '', roles: [] }, { isNew: true })).toEqual({ email: 'Email is required', password: 'Password is required' });
    expect(validateUserForm({ email: 'nope', password: '12345', roles: [] }, { isNew: true })).toEqual({ email: 'Please enter a valid email address', password: 'Password must be at least 6 characters long' });
    expect(validateUserForm({ email: 'a@x.com', password: '123456', roles: [] }, { isNew: true })).toEqual({});
  });

  test('editing: the password may be left blank but if given must be 6+, and at least one role is needed', () => {
    expect(validateUserForm({ email: 'a@x.com', password: '', roles: ['r1'] }, { isNew: false })).toEqual({});
    expect(validateUserForm({ email: 'a@x.com', password: '123', roles: ['r1'] }, { isNew: false }).password).toBe('Password must be at least 6 characters long');
    expect(validateUserForm({ email: 'a@x.com', password: '', roles: [] }, { isNew: false }).roles).toBe('At least one role must be assigned');
  });

  test('the email is checked after trimming', () => {
    expect(validateUserForm({ email: '  a@x.com ', password: '123456', roles: [] }, { isNew: true })).toEqual({});
  });
});

describe('lockout protection', () => {
  const alice = user('u1', 'alice@x.com', ['admin']);
  const bob = user('u2', 'bob@x.com', ['trainer']);
  const carol = user('u3', 'carol@x.com', ['super_admin']);

  test('administrators are the users with admin or super_admin', () => {
    expect(administratorIds([alice, bob, carol])).toEqual(['u1', 'u3']);
  });

  test('you cannot delete yourself', () => {
    expect(deleteBlockedReason(bob, [alice, bob], 'u2')).toBe('You cannot delete your own account.');
  });

  test('the only administrator cannot be deleted, but one of two can', () => {
    expect(deleteBlockedReason(alice, [alice, bob], 'u2')).toBe('This is the only administrator, so the account cannot be deleted.');
    expect(deleteBlockedReason(alice, [alice, carol, bob], 'u3')).toBeNull();
  });

  test('an ordinary user can be deleted by an administrator', () => {
    expect(deleteBlockedReason(bob, [alice, bob], 'u1')).toBeNull();
  });

  test('the administrator role cannot be taken off the only administrator', () => {
    expect(roleChangeBlockedReason(alice, [alice, bob], ['r-trainer'], ROLES)).toMatch(/only administrator/);
    expect(roleChangeBlockedReason(alice, [alice, bob], ['r-super'], ROLES)).toBeNull(); // still an administrator
    expect(roleChangeBlockedReason(alice, [alice, bob], ['r-admin', 'r-trainer'], ROLES)).toBeNull();
  });

  test('with another administrator, or for an ordinary user, role changes are fine', () => {
    expect(roleChangeBlockedReason(alice, [alice, carol], ['r-trainer'], ROLES)).toBeNull();
    expect(roleChangeBlockedReason(bob, [alice, bob], ['r-trainer'], ROLES)).toBeNull();
  });
});
