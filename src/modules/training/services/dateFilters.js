/**
 * A date-only end date ('2026-10-17') means the whole of that day. Compared against a timestamp it would
 * mean midnight at the START of the day and leave out everything that happened on the day itself.
 * Anything that is not a plain date is returned unchanged.
 */
export const endOfDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T23:59:59` : value);
