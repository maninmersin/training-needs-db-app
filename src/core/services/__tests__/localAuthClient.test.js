import { createLocalAuthClient } from '../localAuthClient';

const AUTH_URL = 'http://auth.test';
const now = () => Math.floor(Date.now() / 1000);

const session = (overrides = {}) => ({
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now() + 3600,
  user: { id: 'u1', email: 'a@b.test' },
  ...overrides
});

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

// Minimal localStorage for the node test environment
const installStorage = () => {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  return store;
};

beforeEach(() => {
  installStorage();
  global.fetch = jest.fn();
});

test('signInWithPassword stores the session and notifies listeners', async () => {
  global.fetch.mockResolvedValueOnce(jsonResponse(200, session()));
  const auth = createLocalAuthClient(AUTH_URL);
  const events = [];
  auth.onAuthStateChange((event) => events.push(event));

  const { data, error } = await auth.signInWithPassword({ email: 'a@b.test', password: 'pw' });

  expect(error).toBeNull();
  expect(data.user.id).toBe('u1');
  expect(global.fetch).toHaveBeenCalledWith(`${AUTH_URL}/token?grant_type=password`, expect.objectContaining({ method: 'POST' }));
  expect((await auth.getSession()).data.session.access_token).toBe('access-1');
  expect(events).toContain('SIGNED_IN');
  // Persisted for page reloads
  expect(createLocalAuthClient(AUTH_URL).getAccessToken()).resolves.toBe('access-1');
});

test('failed login returns the server message and no session', async () => {
  global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'Invalid login credentials' }));
  const auth = createLocalAuthClient(AUTH_URL);
  const { data, error } = await auth.signInWithPassword({ email: 'a@b.test', password: 'bad' });
  expect(error.message).toBe('Invalid login credentials');
  expect(data.session).toBeNull();
  expect((await auth.getSession()).data.session).toBeNull();
});

test('expiring token is refreshed once even with concurrent callers', async () => {
  localStorage.setItem('tna-local-auth-session', JSON.stringify(session({ expires_at: now() + 10 })));
  global.fetch.mockResolvedValueOnce(jsonResponse(200, session({ access_token: 'access-2', refresh_token: 'refresh-2' })));
  const auth = createLocalAuthClient(AUTH_URL);

  const tokens = await Promise.all([auth.getAccessToken(), auth.getAccessToken(), auth.getAccessToken()]);

  expect(tokens).toEqual(['access-2', 'access-2', 'access-2']);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe(`${AUTH_URL}/token?grant_type=refresh_token`);
});

test('rejected refresh signs the user out', async () => {
  localStorage.setItem('tna-local-auth-session', JSON.stringify(session({ expires_at: now() - 10 })));
  global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'Invalid Refresh Token' }));
  const auth = createLocalAuthClient(AUTH_URL);
  const events = [];
  auth.onAuthStateChange((e) => events.push(e));

  expect(await auth.getAccessToken()).toBeNull();
  expect(events).toContain('SIGNED_OUT');
  expect(localStorage.getItem('tna-local-auth-session')).toBeNull();
});

test('network failure during refresh keeps a still-valid session', async () => {
  localStorage.setItem('tna-local-auth-session', JSON.stringify(session({ expires_at: now() + 30 })));
  global.fetch.mockRejectedValueOnce(new Error('offline'));
  const auth = createLocalAuthClient(AUTH_URL);
  expect(await auth.getAccessToken()).toBe('access-1');
});

test('signOut clears the session and revokes server-side', async () => {
  localStorage.setItem('tna-local-auth-session', JSON.stringify(session()));
  global.fetch.mockResolvedValueOnce(jsonResponse(204, {}));
  const auth = createLocalAuthClient(AUTH_URL);

  await auth.signOut();

  expect(global.fetch).toHaveBeenCalledWith(`${AUTH_URL}/logout`, expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer access-1' })
  }));
  expect((await auth.getSession()).data.session).toBeNull();
});

test('getUser without a session reports a missing session', async () => {
  const auth = createLocalAuthClient(AUTH_URL);
  const { data, error } = await auth.getUser();
  expect(data.user).toBeNull();
  expect(error.message).toMatch(/session missing/i);
});

test('onAuthStateChange fires INITIAL_SESSION and can unsubscribe', async () => {
  const auth = createLocalAuthClient(AUTH_URL);
  const cb = jest.fn();
  const { data } = auth.onAuthStateChange(cb);
  await new Promise((r) => setTimeout(r, 0));
  expect(cb).toHaveBeenCalledWith('INITIAL_SESSION', null);
  data.subscription.unsubscribe();
  global.fetch.mockResolvedValueOnce(jsonResponse(200, session()));
  await auth.signInWithPassword({ email: 'a@b.test', password: 'pw' });
  expect(cb).toHaveBeenCalledTimes(1);
});
