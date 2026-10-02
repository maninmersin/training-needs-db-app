/**
 * Environment variable validation and security utilities
 */

const isLocalBackend = (import.meta.env.VITE_DB_BACKEND || 'supabase').toLowerCase() === 'local';

const requiredVars = isLocalBackend
  ? {}
  : {
      VITE_SUPABASE_URL: 'Supabase project URL is required',
      VITE_SUPABASE_ANON_KEY: 'Supabase anonymous key is required'
    };

const optionalVars = isLocalBackend
  ? {
      VITE_API_URL: 'PostgREST URL (defaults to http://localhost:3000)',
      VITE_AUTH_URL: 'Auth server URL (defaults to http://localhost:4000)'
    }
  : {
      VITE_AUTH_URL: 'Auth server URL for admin user management (defaults to http://localhost:4000)'
    };

/**
 * Validate all required environment variables are present
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  // Check required variables
  Object.entries(requiredVars).forEach(([key, message]) => {
    if (!import.meta.env[key]) {
      errors.push(`${key}: ${message}`);
    }
  });

  // Check optional variables and warn if missing
  Object.entries(optionalVars).forEach(([key, message]) => {
    if (!import.meta.env[key]) {
      warnings.push(`${key}: ${message}`);
    }
  });

  // Security checks
  if (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must use HTTPS in production');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Check if we're in production mode
 */
export const isProduction = () => {
  return import.meta.env.PROD;
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = () => {
  return import.meta.env.DEV;
};

/**
 * Safely log only in development
 */
export const devLog = (...args) => {
  if (isDevelopment()) {
    console.log(...args);
  }
};

/**
 * Production-safe error logging
 */
export const logError = (error, context = '') => {
  if (isDevelopment()) {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  } else {
    // In production, you might want to send to error tracking service
    // For now, just silently continue
  }
};