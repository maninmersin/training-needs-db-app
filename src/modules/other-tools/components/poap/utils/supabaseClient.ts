// POAP shares the platform's single database client (avoids duplicate auth clients
// and follows the VITE_DB_BACKEND switch).
export { supabase } from '../../../../../core/services/supabaseClient'

// Kept for existing callers; the main platform handles authentication.
export const initMockAuth = async () => {}
