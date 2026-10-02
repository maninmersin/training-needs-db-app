// Minimal stand-in for supabase.auth used when VITE_DB_BACKEND=local.
// Talks to server/auth, whose endpoints mirror Supabase's GoTrue shapes.
// Only the methods this app uses are implemented.

const STORAGE_KEY = 'tna-local-auth-session';
const REFRESH_MARGIN_SECONDS = 60;

const authError = (message, status) => {
  const err = new Error(message);
  err.name = 'AuthError';
  err.status = status;
  return err;
};

const readStoredSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (session) => {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode etc.) - session lives in memory only
  }
};

export const createLocalAuthClient = (authUrl) => {
  const baseUrl = authUrl.replace(/\/$/, '');
  let session = readStoredSession();
  let refreshInFlight = null;
  const listeners = new Set();

  const emit = (event, currentSession) => {
    listeners.forEach((cb) => {
      try {
        cb(event, currentSession);
      } catch (err) {
        console.error('Auth listener failed:', err);
      }
    });
  };

  const setSession = (next, event) => {
    session = next;
    writeStoredSession(next);
    if (event) emit(event, next);
  };

  const call = async (path, { method = 'POST', body, token } = {}) => {
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      return { json: null, error: authError(`Auth server unreachable at ${baseUrl}: ${err.message}`, 0) };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { json, error: authError(json.error_description || json.msg || json.error || `Auth request failed (${res.status})`, res.status) };
    }
    return { json, error: null };
  };

  const refresh = () => {
    if (!session?.refresh_token) return Promise.resolve(null);
    if (!refreshInFlight) {
      refreshInFlight = call('/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } })
        .then(({ json, error }) => {
          if (error) {
            // Only a definite rejection signs the user out; network blips keep the session.
            if (error.status === 400 || error.status === 401) setSession(null, 'SIGNED_OUT');
            return null;
          }
          setSession(json, 'TOKEN_REFRESHED');
          return json;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  };

  const getValidSession = async () => {
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - REFRESH_MARGIN_SECONDS <= now) {
      return (await refresh()) || (session && session.expires_at > now ? session : null);
    }
    return session;
  };

  // Keep tabs in sync when another tab signs in or out
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readStoredSession();
      const event = next ? (session ? 'TOKEN_REFRESHED' : 'SIGNED_IN') : 'SIGNED_OUT';
      session = next;
      emit(event, next);
    });
  }

  return {
    getAccessToken: async () => (await getValidSession())?.access_token ?? null,

    async getSession() {
      return { data: { session: await getValidSession() }, error: null };
    },

    async getUser() {
      const current = await getValidSession();
      if (!current) return { data: { user: null }, error: authError('Auth session missing!', 400) };
      const { json, error } = await call('/user', { method: 'GET', token: current.access_token });
      if (error) return { data: { user: null }, error };
      return { data: { user: json }, error: null };
    },

    async signInWithPassword({ email, password }) {
      const { json, error } = await call('/token?grant_type=password', { body: { email, password } });
      if (error) return { data: { user: null, session: null }, error };
      setSession(json, 'SIGNED_IN');
      return { data: { user: json.user, session: json }, error: null };
    },

    async signOut() {
      const token = session?.access_token;
      setSession(null, 'SIGNED_OUT');
      if (token) await call('/logout', { token });
      return { error: null };
    },

    async resetPasswordForEmail(email) {
      const { error } = await call('/recover', { body: { email } });
      return { data: {}, error };
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      // Supabase fires INITIAL_SESSION asynchronously after subscribing
      setTimeout(async () => {
        if (listeners.has(callback)) callback('INITIAL_SESSION', await getValidSession());
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback)
          }
        }
      };
    }
  };
};
