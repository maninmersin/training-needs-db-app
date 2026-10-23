// Pure rules for the Roles & Permissions screen. No React, no database.

/** The permissions the application knows about. "Initialize Default Permissions" creates any that are missing. */
export const DEFAULT_PERMISSIONS = [
  { resource: 'users', action: 'create', description: 'Create new users' },
  { resource: 'users', action: 'read', description: 'View user information' },
  { resource: 'users', action: 'update', description: 'Update user information' },
  { resource: 'users', action: 'delete', description: 'Delete users' },
  { resource: 'roles', action: 'create', description: 'Create new roles' },
  { resource: 'roles', action: 'read', description: 'View roles' },
  { resource: 'roles', action: 'update', description: 'Update roles' },
  { resource: 'roles', action: 'delete', description: 'Delete roles' },
  { resource: 'schedules', action: 'create', description: 'Create training schedules' },
  { resource: 'schedules', action: 'read', description: 'View training schedules' },
  { resource: 'schedules', action: 'update', description: 'Update training schedules' },
  { resource: 'schedules', action: 'delete', description: 'Delete training schedules' },
  { resource: 'courses', action: 'create', description: 'Create courses' },
  { resource: 'courses', action: 'read', description: 'View courses' },
  { resource: 'courses', action: 'update', description: 'Update courses' },
  { resource: 'courses', action: 'delete', description: 'Delete courses' },
  { resource: 'reports', action: 'read', description: 'View reports' },
  { resource: 'reports', action: 'export', description: 'Export reports' },
  { resource: 'assignments', action: 'create', description: 'Create user assignments' },
  { resource: 'assignments', action: 'read', description: 'View user assignments' },
  { resource: 'assignments', action: 'update', description: 'Update user assignments' },
  { resource: 'assignments', action: 'delete', description: 'Delete user assignments' },
  { resource: 'reference_data', action: 'read', description: 'View reference data' },
  { resource: 'reference_data', action: 'update', description: 'Update reference data' }
];

/** Roles the system itself relies on (the admin server checks for them): deleting one would lock everyone out of administration. */
export const PROTECTED_ROLES = ['admin', 'super_admin'];
export const isProtectedRole = (name) => PROTECTED_ROLES.includes(String(name || '').trim().toLowerCase());

export const permissionName = (resource, action) => `${resource}:${action}`;

/** The database rows for the default permissions. */
export const defaultPermissionRows = () =>
  DEFAULT_PERMISSIONS.map((permission) => ({
    name: permissionName(permission.resource, permission.action),
    description: permission.description,
    resource: permission.resource,
    action: permission.action
  }));

const WORD = /^[a-z][a-z0-9_]*$/;

/** What is typed for a new permission, tidied: resource and action are lower case with no spaces around them. */
export const normalizePermission = (form) => ({
  resource: form.resource.trim().toLowerCase(),
  action: form.action.trim().toLowerCase(),
  description: form.description.trim()
});

/** { field: message } for a new role; empty means valid. */
export function validateRole(form, roles) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Role name is required';
  else if (roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) errors.name = 'A role with that name already exists';
  return errors;
}

/** { field: message } for a new permission (after normalizePermission); empty means valid. */
export function validatePermission(form, permissions) {
  const errors = {};
  if (!form.resource) errors.resource = 'Resource is required';
  else if (!WORD.test(form.resource)) errors.resource = 'Use letters, numbers and underscores only, for example reference_data';
  if (!form.action) errors.action = 'Action is required';
  else if (!WORD.test(form.action)) errors.action = 'Use letters, numbers and underscores only, for example read';
  if (!errors.resource && !errors.action && permissions.some((permission) => permission.name === permissionName(form.resource, form.action))) {
    errors.action = 'That permission already exists';
  }
  return errors;
}

/** Permissions grouped by resource, resources in alphabetical order: [[resource, [permissions...]], ...]. */
export function groupPermissions(permissions) {
  const groups = new Map();
  permissions.forEach((permission) => {
    if (!groups.has(permission.resource)) groups.set(permission.resource, []);
    groups.get(permission.resource).push(permission);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export const hasPermission = (rolePermissions, roleId, permissionId) => rolePermissions.some((link) => link.role_id === roleId && link.permission_id === permissionId);
export const countPermissions = (rolePermissions, roleId) => rolePermissions.filter((link) => link.role_id === roleId).length;

export const titleCase = (text) => text.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
