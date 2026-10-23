// Database access for the MS Access training data screen: current numbers, a safe replace, and the full export.
import { fetchAllRows } from '@core/utils/fetchAllRows';

const BATCH = 500; // rows inserted per request
const ID_CHUNK = 100; // ids per delete request (they travel in the address)

const chunks = (list, size) => {
  const parts = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
};

/** What the project has now: { total_assignments, unique_users, unique_courses, unique_locations, unique_functional_areas } or null. */
export async function loadCurrentStats(db, projectId) {
  const { data, error } = await db.rpc('get_training_data_stats', { p_project_id: projectId });
  if (!error && data && data[0]) return data[0];
  // The function is not available: at least count the rows
  const { count, error: countError } = await db.from('training_data').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  return countError ? null : { total_assignments: count || 0 };
}

/**
 * Replace a project's training data without ever leaving it empty or half-imported:
 *   1. note the ids of the rows that are there now
 *   2. insert ALL the new rows (if a batch fails, the new rows are removed again and the old data is untouched)
 *   3. only then delete the old rows
 * If step 3 fails, nothing is lost: the old and new rows both exist, and running the import again finishes the job.
 * @param {Array} rows - training_data rows to insert
 * @param {(done: number, total: number, phase: string) => void} [onProgress]
 * @returns {Promise<{ inserted: number, removed: number }>}
 */
export async function replaceTrainingData(db, projectId, rows, onProgress = () => {}) {
  onProgress(0, rows.length, 'Reading the current data...');
  const oldIds = (await fetchAllRows(() => db.from('training_data').select('id').eq('project_id', projectId))).map((row) => row.id);

  const newIds = [];
  const batches = chunks(rows, BATCH);
  for (let index = 0; index < batches.length; index++) {
    onProgress(Math.min(index * BATCH, rows.length), rows.length, `Importing records ${index * BATCH + 1} to ${Math.min((index + 1) * BATCH, rows.length)} of ${rows.length}...`);
    const { data, error } = await db.from('training_data').insert(batches[index]).select('id');
    if (error) {
      let cleanup = '';
      for (const part of chunks(newIds, ID_CHUNK)) {
        const { error: rollbackError } = await db.from('training_data').delete().in('id', part);
        if (rollbackError) cleanup = ' Some of the new rows could not be removed again; run the import once more to clean up.';
      }
      throw new Error(`The import stopped at batch ${index + 1}: ${error.message}. Your existing data was kept.${cleanup}`);
    }
    (data || []).forEach((row) => newIds.push(row.id));
  }

  let removed = 0;
  const oldParts = chunks(oldIds, ID_CHUNK);
  for (let index = 0; index < oldParts.length; index++) {
    onProgress(rows.length, rows.length, `Removing the old data (${index + 1} of ${oldParts.length})...`);
    const { error } = await db.from('training_data').delete().in('id', oldParts[index]);
    if (error) {
      throw new Error(`The new data was imported, but the old rows could not all be removed (${error.message}). Run the import again to finish replacing them.`);
    }
    removed += oldParts[index].length;
  }
  return { inserted: newIds.length, removed };
}

/** Every training data row for the project (the old export stopped at the first 1000). */
export const loadAllTrainingData = (db, projectId) => fetchAllRows(() => db.from('training_data').select('*').eq('project_id', projectId));
