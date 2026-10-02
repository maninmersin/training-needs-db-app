import { createClient } from '@supabase/supabase-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { debugInfo, debugError } from '@core/utils/consoleUtils'
import { createLocalAuthClient } from './localAuthClient'

// Single database client for the whole app.
//   VITE_DB_BACKEND=supabase (default) - hosted/self-hosted Supabase
//   VITE_DB_BACKEND=local              - PostgreSQL + PostgREST + server/auth (see LOCAL_SETUP.md)
// Both expose the same { from, rpc, auth } API, so callers don't care which is active.
export const dbBackend = (import.meta.env.VITE_DB_BACKEND || 'supabase').toLowerCase();

const createLocalClient = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const authUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000';
  debugInfo('Using local database backend:', apiUrl);

  const auth = createLocalAuthClient(authUrl);

  // Attach the signed-in user's JWT so PostgREST applies the same RLS policies as Supabase
  const authedFetch = async (input, init = {}) => {
    const token = await auth.getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const rest = new PostgrestClient(apiUrl, { fetch: authedFetch });

  return {
    from: (table) => rest.from(table),
    rpc: (fn, args, options) => rest.rpc(fn, args, options),
    schema: (name) => rest.schema(name),
    auth
  };
};

const createSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    debugError('Missing Supabase configuration:');
    debugError('VITE_SUPABASE_URL:', supabaseUrl);
    debugError('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '*** (provided)' : 'undefined');
    throw new Error('Supabase URL and Anon Key must be provided in .env file (or set VITE_DB_BACKEND=local)');
  }

  debugInfo('Using Supabase backend:', supabaseUrl);
  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: true, autoRefreshToken: true }
  });
};

export const supabase = dbBackend === 'local' ? createLocalClient() : createSupabaseClient();
