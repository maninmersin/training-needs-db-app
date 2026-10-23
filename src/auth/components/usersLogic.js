// Pure rules for the User Management screen. No React, no database.
import { isProtectedRole } from './rolesLogic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Users with their roles attached, when the database could not do the join itself. */
export function joinUsersWithRoles(users, userRoles, roles) {
  return users.map((user) => ({
    ...user,
    auth_user_roles: userRoles
      .filter((link) => link.user_id === user.id)
      .map((link) => ({ role_id: link.role_id, auth_roles: roles.find((role) => role.id === link.role_id) || { id: link.role_id, name: 'Unknown Role', description: '' } }))
  }));
}

export const roleNamesOf = (user) => (user.auth_user_roles || []).map((link) => link.auth_roles?.name).filter(Boolean);
export const roleIdsOf = (user) => (user.auth_user_roles || []).map((link) => link.role_id);

/** Search by email (any part, ignoring case) and by one role id ('' = any role). */
export function filterUsers(users, searchTerm, roleId) {
  const needle = searchTerm.trim().toLowerCase();
  return users.filter(
    (user) =>
      user.email.toLowerCase().includes(needle) &&
      (!roleId || (user.auth_user_roles || []).some((link) => String(link.role_id) === String(roleId)))
  );
}

/** { field: message } for the create form (isNew) or the edit form; empty means valid. */
export function validateUserForm(form, { isNew }) {
  const errors = {};
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!EMAIL.test(form.email.trim())) errors.email = 'Please enter a valid email address';

  const password = form.password || '';
  if (isNew && !password.trim()) errors.password = 'Password is required';
  else if (password.trim() !== '' && password.length < 6) errors.password = 'Password must be at least 6 characters long';

  // The edit form has always required a role; the create form has not
  if (!isNew && form.roles.length === 0) errors.roles = 'At least one role must be assigned';
  return errors;
}

/** Ids of the users who hold an administrator role (admin or super_admin). */
export function administratorIds(users) {
  return users.filter((user) => roleNamesOf(user).some(isProtectedRole)).map((user) => user.id);
}

/** Why a user must not be deleted, or null. Stops people locking themselves (or everyone) out. */
export function deleteBlockedReason(user, users, currentUserId) {
  if (currentUserId && user.id === currentUserId) return 'You cannot delete your own account.';
  const admins = administratorIds(users);
  if (admins.length === 1 && admins[0] === user.id) return 'This is the only administrator, so the account cannot be deleted.';
  return null;
}

/** Why these new roles must not be saved for the user, or null: it would leave nobody with an administrator role. */
export function roleChangeBlockedReason(user, users, newRoleIds, roles) {
  const admins = administratorIds(users);
  if (!(admins.length === 1 && admins[0] === user.id)) return null;
  const stillAdmin = newRoleIds.some((id) => isProtectedRole(roles.find((role) => role.id === id)?.name));
  return stillAdmin ? null : 'This is the only administrator, so the administrator role cannot be removed from them.';
}

/** What changing a user's roles means: ids to add and ids to remove. */
export const diffRoles = (currentIds, newIds) => ({
  add: newIds.filter((id) => !currentIds.includes(id)),
  remove: currentIds.filter((id) => !newIds.includes(id))
});

export const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id]);
