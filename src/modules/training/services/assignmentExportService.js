import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { fetchUserDirectory } from './userDirectoryService';

/**
 * Load a schedule's assignments for the "Export Assignments" CSV.
 *
 * Each assignment gets an `end_users` object ({ id, name, training_location, project_role }) so the CSV
 * code reads people the way it always did, but it is filled in here from a separate lookup. Embedding
 * end_users or training_sessions in the assignments query needs a foreign key this database does not
 * have (MS Access projects have assignments but no end_users rows), and it would cap the result at
 * 1000 rows.
 *
 * @param {Object} args
 * @param {string} args.scheduleId
 * @param {string} args.projectId
 * @param {Array<string>|null} args.locations - keep people whose training location is in this list
 * @param {Array<string>|null} args.stakeholderLocations - a second location list that must also match
 * @param {Array<string>|null} args.functionalAreas - keep assignments in these functional areas
 * @returns {Promise<Array>} assignment rows, each with an end_users object
 */
export const loadAssignmentsForExport = async ({
  scheduleId,
  projectId,
  locations = null,
  stakeholderLocations = null,
  functionalAreas = null
}) => {
  if (!scheduleId) throw new Error('No schedule selected');

  const rows = await fetchAllRows(() => {
    let query = supabase.from('user_assignments').select('*').eq('schedule_id', scheduleId);
    if (functionalAreas && functionalAreas.length > 0) {
      // The assignment row records the functional area of its session
      query = query.in('functional_area', functionalAreas);
    }
    return query;
  });

  const directory = await fetchUserDirectory(projectId, rows.map((row) => row.end_user_id));

  const withPeople = rows.map((row) => {
    const person = directory.get(row.end_user_id) || {};
    return {
      ...row,
      end_users: {
        id: row.end_user_id,
        name: person.name || row.user_name || null,
        training_location: person.training_location || row.training_location || null,
        project_role: person.project_role || null
      }
    };
  });

  const inList = (list) => (row) => !list || list.length === 0 || list.includes(row.end_users.training_location);
  return withPeople.filter(inList(locations)).filter(inList(stakeholderLocations));
};
