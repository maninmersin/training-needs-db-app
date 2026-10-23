// The three reference lists: which table, which fields, and how each field behaves.
// type: 'text' | 'number' | 'boolean' | 'datetime'. `readonly` fields are shown but never edited.

export const REFERENCE_TABS = {
  project_roles: {
    title: 'Project Roles',
    singular: 'Project Role',
    table: 'project_roles',
    displayField: 'project_role_name',
    nameLabel: 'Role Name',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readonly: true },
      { key: 'project_role_name', label: 'Role Name', type: 'text' },
      { key: 'created_at', label: 'Created', type: 'datetime', readonly: true }
    ]
  },
  functional_areas: {
    title: 'Functional Areas',
    singular: 'Functional Area',
    table: 'functional_areas',
    displayField: 'name',
    nameLabel: 'Name',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readonly: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'display_order', label: 'Order', type: 'number', default: 999 },
      { key: 'active', label: 'Active', type: 'boolean' },
      { key: 'created_at', label: 'Created', type: 'datetime', readonly: true }
    ]
  },
  training_locations: {
    title: 'Training Locations',
    singular: 'Training Location',
    table: 'training_locations',
    displayField: 'name',
    nameLabel: 'Name',
    columns: [
      { key: 'id', label: 'ID', type: 'number', readonly: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'capacity', label: 'Capacity', type: 'number', default: 1 },
      { key: 'classrooms_count', label: 'Classrooms', type: 'number', default: 1 },
      { key: 'display_order', label: 'Order', type: 'number', default: 999 },
      { key: 'active', label: 'Active', type: 'boolean' },
      { key: 'created_at', label: 'Created', type: 'datetime', readonly: true }
    ]
  }
};

export const TAB_ORDER = ['project_roles', 'functional_areas', 'training_locations'];
