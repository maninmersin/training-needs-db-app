// Pure rules for the Edit Training Session dialog.

/** A Date as the value of an <input type="datetime-local"> (wall-clock time, no time zone shift). */
export function formatDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The "(Part 2 AM)" text in an existing session title, so a regenerated title keeps it. */
export function partTextFromTitle(title) {
  const text = title || '';
  const match =
    text.match(/\(Part \d+\s*(AM|PM)?\)/) ||
    text.match(/Part \d+\s*(AM|PM)?/) ||
    text.match(/- Part \d+\s*(AM|PM)?/) ||
    text.match(/\(Part \d+[^)]*\)/);
  if (!match) return null;
  return match[0].includes('(') ? match[0] : `(${match[0]})`;
}

/** Course - Group N - (Part) - (Trainer). */
export function generateTitle(session, trainerName) {
  const parts = [];
  if (session?.course?.course_name) parts.push(session.course.course_name);
  if (session?.sessionNumber) parts.push(`Group ${session.sessionNumber}`);
  const part = partTextFromTitle(session?.title);
  if (part) parts.push(part);
  if (trainerName) parts.push(`(${trainerName})`);
  return parts.join(' - ');
}

/** Returns an error message, or null when the start and end are usable. */
export function validateTimes(start, end) {
  if (!start || !end) return 'Start and end times are required';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 'Invalid date format';
  if (endDate <= startDate) return 'End time must be after start time';
  return null;
}

/** Hours between start and end as text with one decimal ('0' when unusable). */
export function durationHours(start, end) {
  if (!start || !end) return '0';
  const hours = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  return hours > 0 ? hours.toFixed(1) : '0';
}
