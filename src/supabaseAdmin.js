import { createClient } from '@supabase/supabase-js'
import { validateEnvironment, logError } from './utils/envValidation.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Validate environment on module load
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  logError('Environment validation failed', 'supabaseAdmin');
}

// Create admin client for user management operations
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Check if admin operations are available
export const isAdminAvailable = () => {
  return supabaseServiceKey != null;
};

// Helper function to get appropriate error message
export const getAdminErrorMessage = () => {
  return 'Admin operations require the service role key. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.';
};

// Export validation results for use in components
export { envValidation };