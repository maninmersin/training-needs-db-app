import { createClient } from '@supabase/supabase-js'
import { debugInfo, debugError } from '@core/utils/consoleUtils'

debugInfo('Initializing Supabase client...');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  debugError('Missing Supabase configuration:');
  debugError('VITE_SUPABASE_URL:', supabaseUrl);
  debugError('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '*** (provided)' : 'undefined');
  throw new Error('Supabase URL and Anon Key must be provided in .env file');
}

debugInfo('Supabase URL configured:', supabaseUrl);
debugInfo('Supabase Key configured:', supabaseKey ? '*** (redacted)' : 'undefined');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: true, autoRefreshToken: true }
});
