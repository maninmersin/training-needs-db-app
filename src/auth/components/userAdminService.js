import { diffRoles, joinUsersWithRoles } from './usersLogic';

// Database access for the User Management screen. `db` is the app's database client and `adminApi` is
// adminUsersApi (create / update / delete the LOGIN account on the auth server).

/** Users with their roles. Tries the joined read first and falls back to joining by hand. A missing table gives []. */
export async function loadUsers(db) {
  const { data, error } = await db
    .from('auth_users')
    .select('*, auth_user_roles (role_id, auth_roles (id, name, description))')
    .order('created_at', { ascending: false });
  if (!error) return data || [];
  if (error.code === '42P01') return [];

  const [users, userRoles, roles] = await Promise.all([
    db.from('auth_users').select('*').order('created_at', { ascending: false }),
    db.from('auth_user_roles').select('user_id, role_id'),
    db.from('auth_roles').select('id, name, description')
  ]);
  return joinUsersWithRoles(users.data || [], userRoles.data || [], roles.data || []);
}

/** All roles by name. A missing table gives []. */
export async function loadRoles(db) {
  const { data, error } = await db.from('auth_roles').select('*').order('name');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

/**
 * Create a login account, the user record and the roles. If a later step fails, the earlier ones are undone
 * (as far as possible) so no login account is left behind without a user record.
 */
export async function createUserAccount(db, adminApi, { email, password, roleIds }) {
  const { data: authData, error: authError } = await adminApi.createUser({ email, password });
  if (authError) throw authError;
  const userId = authData.user.id;

  try {
    const { error: userError } = await db.from('auth_users').insert({ id: userId, email, password_hash: 'auth_managed', is_verified: true });
    if (userError) throw userError;

    if (roleIds.length > 0) {
      const { error: rolesError } = await db.from('auth_user_roles').insert(roleIds.map((roleId) => ({ user_id: userId, role_id: roleId })));
      if (rolesError) throw rolesError;
    }
  } catch (error) {
    await db.from('auth_user_roles').delete().eq('user_id', userId);
    await db.from('auth_users').delete().eq('id', userId);
    await adminApi.deleteUser(userId);
    throw error;
  }
  return userId;
}

/** Delete the person's roles, their user record and their login. A failed login deletion is reported, not fatal. */
export async function deleteUserAccount(db, adminApi, userId) {
  const { error: rolesError } = await db.from('auth_user_roles').delete().eq('user_id', userId);
  if (rolesError) throw rolesError;
  const { error: userError } = await db.from('auth_users').delete().eq('id', userId);
  if (userError) throw userError;

  const { error: loginError } = await adminApi.deleteUser(userId);
  return { loginDeleted: !loginError, loginError: loginError?.message };
}

/** Change email and/or password on the login account, then the user record, then the roles. */
export async function updateUserAccount(db, adminApi, user, { email, password, roleIds }) {
  const changes = {};
  if (email !== user.email) changes.email = email;
  if (password && password.trim() !== '') changes.password = password;
  if (Object.keys(changes).length > 0) {
    const { error: authError } = await adminApi.updateUser(user.id, changes);
    if (authError) throw authError;
  }

  const { error: userError } = await db.from('auth_users').update({ email }).eq('id', user.id);
  if (userError) throw userError;

  // The roles as they are in the database now (not as loaded earlier), so a change made meanwhile is respected
  const { data: current, error: currentError } = await db.from('auth_user_roles').select('role_id').eq('user_id', user.id);
  if (currentError) throw currentError;
  const { add, remove } = diffRoles((current || []).map((row) => row.role_id), roleIds);
  if (remove.length > 0) {
    const { error } = await db.from('auth_user_roles').delete().eq('user_id', user.id).in('role_id', remove);
    if (error) throw error;
  }
  if (add.length > 0) {
    const { error } = await db.from('auth_user_roles').insert(add.map((roleId) => ({ user_id: user.id, role_id: roleId })));
    if (error) throw error;
  }
}
