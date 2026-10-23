// Assignment rows keep the person's name and email only when the screen that created them knew them.
// Rows made without (or older ones) would show as "User 100014"; these helpers fill the gaps from the directory.

/** The ids of people whose assignment rows have no name. */
export function idsMissingNames(assignments) {
  return [...new Set((assignments || []).filter((row) => !row.user_name && !row.end_users?.name).map((row) => row.end_user_id))];
}

/** The same rows with `user_name` / `user_email` filled in from `directory` (a Map of id -> person) where they were missing. */
export function applyNames(assignments, directory) {
  return (assignments || []).map((row) => {
    if (row.user_name || row.end_users?.name) return row;
    const person = directory.get(row.end_user_id);
    return person ? { ...row, user_name: person.name, user_email: row.user_email || person.email } : row;
  });
}

/** A person's details for an export, from the assignment row (which carries the name and email) or its end_users embed. */
export function personOf(assignment) {
  return {
    name: assignment.user_name || assignment.end_users?.name || 'Unknown User',
    email: assignment.user_email || assignment.end_users?.email || '',
    role: assignment.user_project_role || assignment.end_users?.project_role || '',
    location: assignment.end_users?.training_location || assignment.training_location || ''
  };
}
