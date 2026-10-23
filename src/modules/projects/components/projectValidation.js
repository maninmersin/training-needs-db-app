/** Validation shared by the Create and Edit project forms. Returns { field: message }; empty means valid. */
export function validateProject(form) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = 'Project name is required';
  } else if (form.name.length < 3) {
    errors.name = 'Project name must be at least 3 characters';
  } else if (form.name.length > 50) {
    errors.name = 'Project name must be less than 50 characters';
  }

  if (!form.title.trim()) {
    errors.title = 'Project title is required';
  } else if (form.title.length < 5) {
    errors.title = 'Project title must be at least 5 characters';
  } else if (form.title.length > 100) {
    errors.title = 'Project title must be less than 100 characters';
  }

  if (form.project_code && (form.project_code.length < 2 || form.project_code.length > 20)) {
    errors.project_code = 'Project code must be between 2-20 characters';
  }

  if (form.start_date && form.target_end_date && new Date(form.start_date) >= new Date(form.target_end_date)) {
    errors.target_end_date = 'End date must be after start date';
  }

  return errors;
}

export const EMPTY_PROJECT_FORM = {
  name: '',
  title: '',
  description: '',
  project_code: '',
  start_date: '',
  target_end_date: '',
  settings: {},
  branding: {}
};

export const projectToForm = (project) => ({
  name: project.name || '',
  title: project.title || '',
  description: project.description || '',
  project_code: project.project_code || '',
  start_date: project.start_date || '',
  target_end_date: project.target_end_date || '',
  training_data_source: project.training_data_source || 'access',
  settings: project.settings || {},
  branding: project.branding || {}
});
