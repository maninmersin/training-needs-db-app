import { createUserAccount, deleteUserAccount, loadRoles, loadUsers, updateUserAccount } from '../userAdminService';

// A small stand-in for the database. `answers` gives the result for a table and operation; every call is logged in order.
const makeDb = (answers = {}) => {
  const log = [];
  const db = {
    from: (table) => {
      const call = { table, op: 'select', filters: [], rows: null, values: null };
      log.push(call);
      const answer = () => {
        const given = answers[`${table}.${call.op}`];
        const result = typeof given === 'function' ? given(call) : given;
        return result || { data: [], error: null };
      };
      const query = {
        select: () => query,
        order: () => query,
        insert: (rows) => { call.op = 'insert'; call.rows = rows; return query; },
        update: (values) => { call.op = 'update'; call.values = values; return query; },
        delete: () => { call.op = 'delete'; return query; },
        eq: (column, value) => { call.filters.push(['eq', column, value]); return query; },
        in: (column, value) => { call.filters.push(['in', column, value]); return query; },
        then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject)
      };
      return query;
    }
  };
  return { db, log };
};
const adminApi = () => ({
  createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null }),
  updateUser: jest.fn().mockResolvedValue({ error: null }),
  deleteUser: jest.fn().mockResolvedValue({ error: null })
});
const ops = (log) => log.map((c) => `${c.op} ${c.table}`);

describe('loadUsers', () => {
  test('uses the joined read when it works', async () => {
    const { db } = makeDb({ 'auth_users.select': { data: [{ id: 'u1', email: 'a@x.com', auth_user_roles: [] }], error: null } });
    expect(await loadUsers(db)).toEqual([{ id: 'u1', email: 'a@x.com', auth_user_roles: [] }]);
  });

  test('a missing table gives an empty list', async () => {
    const { db } = makeDb({ 'auth_users.select': { data: null, error: { code: '42P01' } } });
    expect(await loadUsers(db)).toEqual([]);
  });

  test('if the join is not available it joins the roles itself', async () => {
    let call = 0;
    const { db } = makeDb({
      'auth_users.select': () => (++call === 1 ? { data: null, error: { code: 'PGRST200', message: 'no relationship' } } : { data: [{ id: 'u1', email: 'a@x.com' }], error: null }),
      'auth_user_roles.select': { data: [{ user_id: 'u1', role_id: 'r1' }], error: null },
      'auth_roles.select': { data: [{ id: 'r1', name: 'trainer', description: '' }], error: null }
    });
    const users = await loadUsers(db);
    expect(users[0].auth_user_roles[0].auth_roles.name).toBe('trainer');
  });
});

describe('loadRoles', () => {
  test('returns the roles, [] for a missing table, and raises other errors', async () => {
    expect(await loadRoles(makeDb({ 'auth_roles.select': { data: [{ id: 'r1' }], error: null } }).db)).toEqual([{ id: 'r1' }]);
    expect(await loadRoles(makeDb({ 'auth_roles.select': { data: null, error: { code: '42P01' } } }).db)).toEqual([]);
    await expect(loadRoles(makeDb({ 'auth_roles.select': { data: null, error: new Error('denied') } }).db)).rejects.toThrow('denied');
  });
});

describe('createUserAccount', () => {
  test('creates the login, the user record and the roles, in that order', async () => {
    const { db, log } = makeDb();
    const api = adminApi();
    const id = await createUserAccount(db, api, { email: 'a@x.com', password: 'secret1', roleIds: ['r1', 'r2'] });
    expect(id).toBe('new-id');
    expect(api.createUser).toHaveBeenCalledWith({ email: 'a@x.com', password: 'secret1' });
    expect(ops(log)).toEqual(['insert auth_users', 'insert auth_user_roles']);
    expect(log[0].rows).toEqual({ id: 'new-id', email: 'a@x.com' });
    expect(log[1].rows).toEqual([{ user_id: 'new-id', role_id: 'r1' }, { user_id: 'new-id', role_id: 'r2' }]);
  });

  test('with no roles chosen it does not try to save any', async () => {
    const { db, log } = makeDb();
    await createUserAccount(db, adminApi(), { email: 'a@x.com', password: 'secret1', roleIds: [] });
    expect(ops(log)).toEqual(['insert auth_users']);
  });

  test('if the login cannot be created, nothing else is done', async () => {
    const { db, log } = makeDb();
    const api = adminApi();
    api.createUser.mockResolvedValue({ data: null, error: new Error('email taken') });
    await expect(createUserAccount(db, api, { email: 'a@x.com', password: 'x', roleIds: [] })).rejects.toThrow('email taken');
    expect(log).toEqual([]);
  });

  test('if saving the user record fails, the login account is removed again so none is left behind', async () => {
    const { db, log } = makeDb({ 'auth_users.insert': { error: new Error('record refused') } });
    const api = adminApi();
    await expect(createUserAccount(db, api, { email: 'a@x.com', password: 'secret1', roleIds: ['r1'] })).rejects.toThrow('record refused');
    expect(api.deleteUser).toHaveBeenCalledWith('new-id');
    expect(ops(log)).toContain('delete auth_users');
  });

  test('if saving the roles fails, the user record and login are removed again', async () => {
    const { db, log } = makeDb({ 'auth_user_roles.insert': { error: new Error('roles refused') } });
    const api = adminApi();
    await expect(createUserAccount(db, api, { email: 'a@x.com', password: 'secret1', roleIds: ['r1'] })).rejects.toThrow('roles refused');
    expect(api.deleteUser).toHaveBeenCalledWith('new-id');
    expect(ops(log).filter((o) => o.startsWith('delete'))).toEqual(['delete auth_user_roles', 'delete auth_users']);
  });
});

describe('deleteUserAccount', () => {
  test('removes the roles, then the user record, then the login', async () => {
    const { db, log } = makeDb();
    const api = adminApi();
    const result = await deleteUserAccount(db, api, 'u1');
    expect(ops(log)).toEqual(['delete auth_user_roles', 'delete auth_users']);
    expect(log[0].filters).toEqual([['eq', 'user_id', 'u1']]);
    expect(log[1].filters).toEqual([['eq', 'id', 'u1']]);
    expect(api.deleteUser).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ loginDeleted: true, loginError: undefined });
  });

  test('a failure removing the roles or the record is raised and stops the rest (it used to be ignored)', async () => {
    const api = adminApi();
    await expect(deleteUserAccount(makeDb({ 'auth_user_roles.delete': { error: new Error('roles blocked') } }).db, api, 'u1')).rejects.toThrow('roles blocked');
    await expect(deleteUserAccount(makeDb({ 'auth_users.delete': { error: new Error('record blocked') } }).db, api, 'u1')).rejects.toThrow('record blocked');
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  test('if only the login cannot be removed it is reported, not fatal', async () => {
    const api = adminApi();
    api.deleteUser.mockResolvedValue({ error: new Error('auth server down') });
    expect(await deleteUserAccount(makeDb().db, api, 'u1')).toEqual({ loginDeleted: false, loginError: 'auth server down' });
  });
});

describe('updateUserAccount', () => {
  const user = { id: 'u1', email: 'old@x.com' };

  test('only the roles changed: the login is not touched, and only the differences are saved', async () => {
    const { db, log } = makeDb({ 'auth_user_roles.select': { data: [{ role_id: 'r1' }, { role_id: 'r2' }], error: null } });
    const api = adminApi();
    await updateUserAccount(db, api, user, { email: 'old@x.com', password: '', roleIds: ['r2', 'r3'] });
    expect(api.updateUser).not.toHaveBeenCalled();
    const deletion = log.find((c) => c.op === 'delete');
    expect(deletion.filters).toEqual([['eq', 'user_id', 'u1'], ['in', 'role_id', ['r1']]]);
    expect(log.find((c) => c.op === 'insert').rows).toEqual([{ user_id: 'u1', role_id: 'r3' }]);
  });

  test('a new email and password go to the login first, then the record', async () => {
    const { db, log } = makeDb({ 'auth_user_roles.select': { data: [{ role_id: 'r1' }], error: null } });
    const api = adminApi();
    await updateUserAccount(db, api, user, { email: 'new@x.com', password: 'newsecret', roleIds: ['r1'] });
    expect(api.updateUser).toHaveBeenCalledWith('u1', { email: 'new@x.com', password: 'newsecret' });
    expect(log.find((c) => c.op === 'update').values).toEqual({ email: 'new@x.com' });
  });

  test('a blank password is not sent', async () => {
    const { db } = makeDb({ 'auth_user_roles.select': { data: [], error: null } });
    const api = adminApi();
    await updateUserAccount(db, api, user, { email: 'new@x.com', password: '   ', roleIds: [] });
    expect(api.updateUser).toHaveBeenCalledWith('u1', { email: 'new@x.com' });
  });

  test('if the login update fails nothing else is changed', async () => {
    const { db, log } = makeDb();
    const api = adminApi();
    api.updateUser.mockResolvedValue({ error: new Error('login refused') });
    await expect(updateUserAccount(db, api, user, { email: 'new@x.com', password: '', roleIds: [] })).rejects.toThrow('login refused');
    expect(log).toEqual([]);
  });

  test('the roles are compared with the database as it is now, not as it was loaded', async () => {
    const { db, log } = makeDb({ 'auth_user_roles.select': { data: [{ role_id: 'r1' }, { role_id: 'r9' }], error: null } });
    await updateUserAccount(db, adminApi(), user, { email: 'old@x.com', password: '', roleIds: ['r1'] });
    expect(log.find((c) => c.op === 'delete').filters[1]).toEqual(['in', 'role_id', ['r9']]);
  });
});
