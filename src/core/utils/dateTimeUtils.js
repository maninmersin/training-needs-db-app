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
  
  // Use Swedish locale format which returns YYYY-MM-DD HH:mm:ss, then replace space with T
  return date.toLocaleString('sv-SE').replace(' ', 'T');
};

/**
 * Convert a local datetime string back to a JavaScript Date object
 * 
 * @param {string} dateTimeString - Local datetime string in format YYYY-MM-DDTHH:mm:ss
 * @returns {Date} JavaScript Date object in local timezone
 */
export const fromLocalDateTime = (dateTimeString) => {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    throw new Error('Invalid datetime string provided to fromLocalDateTime');
  }
  
  return new Date(dateTimeString);
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