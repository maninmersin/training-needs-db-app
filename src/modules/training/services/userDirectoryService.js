import { supabase } from '@core/services/supabaseClient';

/**
 * Look up people's details for a set of end user ids.
 *
 * Assignment and attendance rows only store the person's id. Details come from end_users (projects
 * whose people are managed in the app), falling back to the imported training data (MS Access
 * projects have assignments but no end_users rows). There is deliberately no foreign key from
 * assignments or attendance to end_users, so this is looked up here rather than embedded in the
 * query; an embed fails with "Could not find a relationship ... in the schema cache".
 *
 * @param {string} projectId - The project ID
 * @param {Array<number>} userIds - end user ids
 * @returns {Promise<Map>} id -> { id, name, email, job_title, division, project_role, training_location }
 */
export const fetchUserDirectory = async (projectId, userIds) => {
  const ids = [...new Set((userIds || []).filter((id) => id !== null && id !== undefined))];
  const directory = new Map();
  if (ids.length === 0) return directory;

  // Small batches keep the request address short and each result under the 1000-row limit
  const END_USER_BATCH = 200;
  for (let i = 0; i < ids.length; i += END_USER_BATCH) {
    const { data: endUsers, error } = await supabase
      .from('end_users')
      .select('id, name, email, job_title, division, project_role, training_location')
      .eq('project_id', projectId)
      .in('id', ids.slice(i, i + END_USER_BATCH));
    if (error) throw error;
    (endUsers || []).forEach((user) => directory.set(user.id, user));
  }

  const missing = ids.filter((id) => !directory.has(id));
  // The training data has one row per person per course, so fewer people per request
  const TRAINING_DATA_BATCH = 40;
  for (let i = 0; i < missing.length; i += TRAINING_DATA_BATCH) {
    const { data: rows, error } = await supabase
      .from('training_data_combined')
      .select('user_id, user_name, user_email, user_job_title, business_unit, user_project_role, training_location')
      .eq('project_id', projectId)
      .in('user_id', missing.slice(i, i + TRAINING_DATA_BATCH).map(String));
    if (error) throw error;
    (rows || []).forEach((row) => {
      const id = Number(row.user_id);
      if (!directory.has(id)) {
        directory.set(id, {
          id,
          name: row.user_name,
          email: row.user_email,
          job_title: row.user_job_title,
          division: row.business_unit,
          project_role: row.user_project_role,
          training_location: row.training_location
        });
      }
    });
  }

  return directory;
};

// A person we can't find details for is still listed, so their record isn't lost
/**
 * Find people in a project by name, email or ID, for pick-lists (for example adding a walk-in to attendance).
 * Looks in end_users first, then in the imported training data for projects without end_users.
 * Returns up to `limit` entries shaped like fetchUserDirectory's, or [] for a search that is too short.
 */
export const searchUserDirectory = async (projectId, term, limit = 20) => {
  // Characters that mean something inside a PostgREST filter are dropped from the search text
  const text = String(term || '').replace(/[,()%*]/g, ' ').replace(/ +/g, ' ').trim();
  const isId = /^\d+$/.test(text);
  if (text.length < 2 && !isId) return [];

  const clauses = [`name.ilike.*${text}*`, `email.ilike.*${text}*`];
  if (isId) clauses.push(`id.eq.${text}`);
  const { data: endUsers, error } = await supabase
    .from('end_users')
    .select('id, name, email, job_title, division, project_role, training_location')
    .eq('project_id', projectId)
    .or(clauses.join(','))
    .order('name')
    .limit(limit);
  if (error) throw error;
  if (endUsers && endUsers.length > 0) return endUsers;

  const trainingClauses = [`user_name.ilike.*${text}*`, `user_email.ilike.*${text}*`];
  if (isId) trainingClauses.push(`user_id.eq.${text}`);
  const { data: rows, error: trainingError } = await supabase
    .from('training_data_combined')
    .select('user_id, user_name, user_email, user_job_title, business_unit, user_project_role, training_location')
    .eq('project_id', projectId)
    .or(trainingClauses.join(','))
    .limit(limit * 10);
  if (trainingError) throw trainingError;

  // One row per person per course in the training data, so keep one per person
  const people = new Map();
  (rows || []).forEach((row) => {
    const id = Number(row.user_id);
    if (!people.has(id)) {
      people.set(id, {
        id,
        name: row.user_name,
        email: row.user_email,
        job_title: row.user_job_title,
        division: row.business_unit,
        project_role: row.user_project_role,
        training_location: row.training_location
      });
    }
  });
  return [...people.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, limit);
};

export const userOrPlaceholder = (directory, id) =>
  directory.get(id) || { id, name: `User ${id}`, email: null };
