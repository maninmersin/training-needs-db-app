// Pieces shared by every importer: the status words, the "[clear]" marker, counting, and the apply loop.

export const STATUS = { OK: 'ok', WARNING: 'warning', BLOCKED: 'blocked', ERROR: 'error', UNCHANGED: 'unchanged' };

/** Typing this in a cell empties that field on purpose; a blank cell leaves the stored value alone. */
export const CLEAR = '[clear]';
export const isClear = (text) => String(text ?? '').trim().toLowerCase() === CLEAR;

/** Items that will be written when Apply is pressed. */
export const willApply = (item) => Boolean(item.op) && (item.status === STATUS.OK || item.status === STATUS.WARNING);

export const countByStatus = (items) => {
  const counts = { ok: 0, warning: 0, blocked: 0, error: 0, unchanged: 0 };
  items.forEach((item) => {
    counts[item.status] += 1;
  });
  return counts;
};

/** Case-insensitive lookup that returns the stored spelling, or undefined. */
export function canonicalMatch(value, options) {
  const wanted = String(value).trim().toLowerCase();
  return options.find((option) => String(option).trim().toLowerCase() === wanted);
}

/**
 * Runs `perform(op, item)` for each item that will be applied, one at a time, so a failure on one
 * never affects the others. `onProgress(done, total)` is called after each.
 * Returns { outcomes: [{ item, ok, message }], applied, failed }.
 */
export async function runOps(items, perform, onProgress = () => {}) {
  const todo = items.filter(willApply);
  const outcomes = [];
  for (let index = 0; index < todo.length; index++) {
    const item = todo[index];
    try {
      await perform(item.op, item);
      outcomes.push({ item, ok: true, message: 'Done' });
    } catch (error) {
      outcomes.push({ item, ok: false, message: error.message || 'Failed' });
    }
    onProgress(index + 1, todo.length);
  }
  const failed = outcomes.filter((outcome) => !outcome.ok).length;
  return { outcomes, applied: outcomes.length - failed, failed };
}

/** Friendlier wording for the database errors people actually hit. */
export function explainDatabaseError(error, fallback = '') {
  if (error?.code === '23505') return `Duplicate value: ${error.message}`;
  if (error?.code === '23503') return `Refers to something that does not exist: ${error.message}`;
  return error?.message || fallback || 'Database error';
}
