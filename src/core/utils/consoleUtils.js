// Enhanced console utility for managing debug output
const isDevelopment = import.meta.env.DEV;
const DEBUG_MODE = isDevelopment && (localStorage?.getItem('debug_mode') === 'true' || false);

export const debugLog = (...args) => {
  if (DEBUG_MODE) {
    console.log('%c[DEBUG]', 'color: #007bff; font-weight: bold;', ...args);
  }
};

export const debugWarn = (...args) => {
  if (DEBUG_MODE) {
    console.warn('%c[DEBUG WARN]', 'color: #ffc107; font-weight: bold;', ...args);
  }
};

export const debugError = (...args) => {
  // Always show errors in development, suppress in production unless critical
  if (isDevelopment) {
    console.error('%c[ERROR]', 'color: #dc3545; font-weight: bold;', ...args);
  }
};

export const debugInfo = (...args) => {
  if (DEBUG_MODE) {
    console.info('%c[INFO]', 'color: #17a2b8; font-weight: bold;', ...args);
  }
};

// Performance timing utility
export const debugTime = (label) => {
  if (DEBUG_MODE) {
    console.time(`⏱️ ${label}`);
  }
};

export const debugTimeEnd = (label) => {
  if (DEBUG_MODE) {
    console.timeEnd(`⏱️ ${label}`);
  }
};

// Toggle debug mode on/off (development only)
export const toggleDebugMode = () => {
  if (!isDevelopment) return false;
  
  const currentMode = localStorage.getItem('debug_mode') === 'true';
  const newMode = !currentMode;
  localStorage.setItem('debug_mode', newMode.toString());
  console.log(`%cDebug mode ${newMode ? 'enabled' : 'disabled'}. Refresh page to apply.`, 
    'color: #28a745; font-weight: bold;');
  return newMode;
};

// Enable debug mode (development only)
export const enableDebugMode = () => {
  if (!isDevelopment) return false;
  
  localStorage.setItem('debug_mode', 'true');
  console.log('%cDebug mode enabled. Refresh page to apply.', 'color: #28a745; font-weight: bold;');
  return true;
};

// Disable debug mode (development only)
export const disableDebugMode = () => {
  if (!isDevelopment) return false;
  
  localStorage.setItem('debug_mode', 'false');
  console.log('%cDebug mode disabled. Refresh page to apply.', 'color: #6c757d; font-weight: bold;');
  return true;
};

// Production-safe console methods (no-ops in production)
export const safeLog = isDevelopment ? console.log : () => {};
export const safeWarn = isDevelopment ? console.warn : () => {};
export const safeInfo = isDevelopment ? console.info : () => {};