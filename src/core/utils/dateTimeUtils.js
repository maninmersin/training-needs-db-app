/**
 * DateTime Utility Functions
 * 
 * These functions provide consistent datetime handling to avoid timezone conversion issues.
 * Instead of using toISOString() which converts to UTC, we preserve local timezone.
 */

/**
 * Convert a JavaScript Date object to a local datetime string suitable for database storage
 * Format: YYYY-MM-DDTHH:mm:ss
 *
 * @param {Date} date - The date object to convert
 * @returns {string} Local datetime string in ISO format without timezone conversion
 */
export const toLocalDateTime = (date) => {
  if (!date || !(date instanceof Date)) {
    throw new Error('Invalid date object provided to toLocalDateTime');
  }

  // Extract local date/time components (no timezone conversion)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const result = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  // DEBUG: Log the conversion
  console.log('🕐 toLocalDateTime:', {
    input: date.toString(),
    inputHours: date.getHours(),
    inputMinutes: date.getMinutes(),
    output: result
  });

  // Return in ISO format: YYYY-MM-DDTHH:mm:ss
  return result;
};

/**
 * Convert a local datetime string back to a JavaScript Date object
 *
 * CRITICAL: new Date("2025-12-15T09:30:00") treats the string as UTC!
 * This causes timezone shifts. We must parse components and create Date in local timezone.
 *
 * Supports multiple formats:
 * - YYYY-MM-DDTHH:mm:ss
 * - YYYY-MM-DD HH:mm:ss (space instead of T)
 * - YYYY-MM-DDTHH:mm:ss.SSS (with milliseconds)
 * - YYYY-MM-DDTHH:mm:ss+00:00 (with timezone suffix - ignored)
 *
 * @param {string} dateTimeString - Local datetime string
 * @returns {Date} JavaScript Date object in local timezone
 */
export const fromLocalDateTime = (dateTimeString) => {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    throw new Error('Invalid datetime string provided to fromLocalDateTime');
  }

  // Normalize the string: replace space with T, remove timezone suffix
  let normalized = dateTimeString.trim();

  // Remove timezone suffix if present (e.g., +00:00, Z, -05:00)
  normalized = normalized.replace(/([+-]\d{2}:\d{2}|Z)$/, '');

  // Remove milliseconds if present (e.g., .000)
  normalized = normalized.replace(/\.\d{3}/, '');

  // Replace space with T for consistent parsing
  normalized = normalized.replace(' ', 'T');

  // Parse the datetime components
  // Format: YYYY-MM-DDTHH:mm:ss
  const dateTimeParts = normalized.split('T');
  if (dateTimeParts.length !== 2) {
    console.error('❌ fromLocalDateTime: Invalid format:', {
      original: dateTimeString,
      normalized: normalized,
      parts: dateTimeParts
    });
    throw new Error(`DateTime string must be in format YYYY-MM-DDTHH:mm:ss, got: ${dateTimeString}`);
  }

  const datePart = dateTimeParts[0];
  const timePart = dateTimeParts[1];

  const dateParts = datePart.split('-');
  const timeParts = timePart.split(':');

  if (dateParts.length !== 3 || timeParts.length !== 3) {
    console.error('❌ fromLocalDateTime: Invalid date/time parts:', {
      original: dateTimeString,
      dateParts: dateParts,
      timeParts: timeParts
    });
    throw new Error(`DateTime string must have valid date and time components, got: ${dateTimeString}`);
  }

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = parseInt(timeParts[2], 10);

  // Validate parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    console.error('❌ fromLocalDateTime: Invalid numeric values:', {
      year, month, day, hours, minutes, seconds
    });
    throw new Error(`DateTime string contains invalid numeric values: ${dateTimeString}`);
  }

  // Create Date in LOCAL timezone
  const localDate = new Date(year, month, day, hours, minutes, seconds, 0);

  console.log('📥 fromLocalDateTime:', {
    input: dateTimeString,
    normalized: normalized,
    output: localDate.toString(),
    outputHours: localDate.getHours(),
    outputMinutes: localDate.getMinutes()
  });

  return localDate;
};

/**
 * Create a Date object from a date string (YYYY-MM-DD) in LOCAL timezone
 *
 * IMPORTANT: new Date("2025-12-21") interprets as UTC midnight (00:00 UTC)
 * which becomes 03:00 in GMT+0300 timezone, causing timezone shifts!
 *
 * This function creates the Date in LOCAL timezone at midnight (00:00 local time).
 *
 * @param {string} dateString - Date string in format YYYY-MM-DD
 * @returns {Date} JavaScript Date object at midnight local time
 */
export const createLocalDateFromString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string provided to createLocalDateFromString');
  }

  // Parse the date components
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    throw new Error('Date string must be in format YYYY-MM-DD');
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  // Create Date in LOCAL timezone at midnight
  const localDate = new Date(year, month, day, 0, 0, 0, 0);

  console.log('📅 createLocalDateFromString:', {
    input: dateString,
    output: localDate.toString(),
    outputHours: localDate.getHours(),
    outputTimezoneOffset: localDate.getTimezoneOffset()
  });

  return localDate;
};

/**
 * Get current local datetime as a string suitable for database storage
 *
 * @returns {string} Current local datetime string
 */
export const getCurrentLocalDateTime = () => {
  return toLocalDateTime(new Date());
};

/**
 * Format a date for display purposes
 * 
 * @param {Date|string} date - Date object or datetime string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDateTime = (date, options = {}) => {
  const dateObj = date instanceof Date ? date : fromLocalDateTime(date);
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  
  return dateObj.toLocaleString('en-GB', { ...defaultOptions, ...options });
};

/**
 * Check if two datetime values represent the same time
 * 
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if dates represent the same time
 */
export const isSameDateTime = (date1, date2) => {
  const d1 = date1 instanceof Date ? date1 : fromLocalDateTime(date1);
  const d2 = date2 instanceof Date ? date2 : fromLocalDateTime(date2);
  
  return d1.getTime() === d2.getTime();
};