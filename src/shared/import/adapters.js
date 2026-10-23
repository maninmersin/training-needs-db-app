// Each importer described in one place, so the wizard screen can drive any of them.
import { applyPeopleImport, loadPeopleContext, planPeopleImport } from './peopleImport';
import { applyCoursesImport, loadCoursesContext, planCoursesImport } from './coursesImport';
import { applyAssignmentsImport, loadAssignmentsContext, planAssignmentsImport } from './assignmentsImport';

const DELETE_OPTION = { key: 'allowDeletes', label: 'Allow deletes', help: 'Rows marked Delete are held back unless this is ticked.', default: false };

export const peopleAdapter = {
  key: 'people',
  title: 'Import people',
  noun: 'people',
  templateKey: 'people',
  help: [
    'One row per person. Columns: change_type, id, name, email, job_title, country, division, sub_division, location_name, training_location, project_role.',
    'change_type is Add, Update or Delete. If it is blank (or the column is missing) the row adds the person, or updates them if the ID already exists.',
    'On an existing person a blank cell leaves the stored value alone. To empty a field on purpose, type [clear].',
    'A file exported from this screen can be edited and imported straight back.'
  ],
  options: [DELETE_OPTION],
  load: (db, projectId, table) => loadPeopleContext(db, projectId, table),
  plan: (table, context, options) => planPeopleImport(table, context, options),
  apply: (items, environment, onProgress) => applyPeopleImport(items, environment, onProgress)
};

export const coursesAdapter = {
  key: 'courses',
  title: 'Import courses',
  noun: 'courses',
  templateKey: 'courses',
  help: [
    'One row per course. Columns: change_type, course_id, course_name, functional_area, duration_hrs, application, priority.',
    'change_type is Add, Update or Delete. If it is blank (or the column is missing) the row adds the course, or updates it if the ID already exists.',
    'A new course needs a name, functional area, duration and priority. Functional areas must already be in Reference Data.',
    'On an existing course a blank cell leaves the stored value alone. To empty application or name on purpose, type [clear].'
  ],
  options: [DELETE_OPTION],
  load: (db, projectId, table) => loadCoursesContext(db, projectId, table),
  plan: (table, context, options) => planCoursesImport(table, context, options),
  apply: (items, environment, onProgress) => applyCoursesImport(items, environment, onProgress)
};

export const assignmentsAdapter = {
  key: 'assignments',
  title: 'Import course assignments',
  noun: 'people',
  templateKey: 'assignments',
  help: [
    'One row per person per course. Columns: UserID, Name, Email, Role, Location, CourseID.',
    'Courses must already exist (import them first). Existing people keep their details; only their course list changes.',
    'People who are not in the project yet are created from the row (name and email are required).',
    'Only the differences are saved, and new courses are added before any are removed.'
  ],
  options: [
    {
      key: 'addOnly',
      label: 'Only add courses (never remove)',
      help: 'Untick to make each person end up with exactly the courses listed in the file.',
      default: false
    }
  ],
  load: (db, projectId, table) => loadAssignmentsContext(db, projectId, table),
  plan: (table, context, options) => planAssignmentsImport(table, context, { mode: options.addOnly ? 'add' : 'replace' }),
  apply: (items, environment, onProgress) => applyAssignmentsImport(items, environment, onProgress)
};
