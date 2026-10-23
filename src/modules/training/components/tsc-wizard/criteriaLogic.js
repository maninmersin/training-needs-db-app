// Pure rules for the Define Criteria screen of the Schedule Creator.

export const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const PREFERENCE_HELP = {
  both: 'Schedule training sessions in both morning and afternoon time slots.',
  am_only: 'Schedule training sessions only in the morning hours.',
  pm_only: 'Schedule training sessions only in the afternoon hours.'
};

export const MODE_HELP = {
  group_complete:
    'Each classroom operates independently. Groups complete all courses before moving to the next group. Maximum concurrency: 2 classrooms = 2 groups trained simultaneously.',
  course_complete:
    'All classrooms work on the same course simultaneously. Complete one course across all groups before moving to the next course. All groups progress together.'
};

export function defaultCriteria(today = new Date()) {
  return {
    max_attendees: 10,
    total_weeks: 5,
    daily_hours: 6,
    days_per_week: 5,
    contingency: 1,
    start_date: today.toISOString().split('T')[0],
    scheduling_preference: 'both',
    scheduling_mode: 'group_complete',
    start_time_am: '09:30',
    end_time_am: '12:30',
    start_time_pm: '13:30',
    end_time_pm: '16:30',
    scheduling_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    selected_functional_areas: [],
    selected_training_locations: []
  };
}

/** Changing one field. Switching the AM/PM preference clears the unused times, or restores the defaults. */
export function applyChange(values, key, value) {
  const next = { ...values, [key]: value };
  if (key !== 'scheduling_preference') return next;
  if (value === 'am_only') return { ...next, start_time_pm: '', end_time_pm: '' };
  if (value === 'pm_only') return { ...next, start_time_am: '', end_time_am: '' };
  if (value === 'both') {
    if (!next.start_time_am || !next.end_time_am) {
      next.start_time_am = '09:30';
      next.end_time_am = '12:30';
    }
    if (!next.start_time_pm || !next.end_time_pm) {
      next.start_time_pm = '13:30';
      next.end_time_pm = '16:30';
    }
  }
  return next;
}

/** Tick or untick one item of a list. */
export function toggleItem(list, item, checked) {
  const current = new Set(list);
  if (checked) current.add(item);
  else current.delete(item);
  return Array.from(current);
}

/** The "All ..." box: everything available, or nothing. */
export function toggleAll(available, checked) {
  return checked ? [...available] : [];
}

export function toggleDay(days, day) {
  return toggleItem(days, day, !days.includes(day));
}

/** True when every available option is ticked (and there is at least one). */
export function allSelected(selected, available) {
  return available.length > 0 && selected.length === available.length;
}

/** Both a functional area and a training location are required. */
export function scopeErrors(values) {
  return {
    functional_areas: values.selected_functional_areas.length === 0,
    training_locations: values.selected_training_locations.length === 0
  };
}

export function scopeIsValid(values) {
  const errors = scopeErrors(values);
  return !errors.functional_areas && !errors.training_locations;
}

/** Keep the rows for the chosen locations and areas, drop repeated person+course pairs, and shape them for the scheduler. */
export function buildEndUsers(rows, values) {
  const chosen = rows.filter(
    (row) => values.selected_training_locations.includes(row.training_location) && values.selected_functional_areas.includes(row.functional_area)
  );
  const seen = new Set();
  const endUsers = [];
  chosen.forEach((row) => {
    const uniqueKey = `${row.user_id}-${row.course_id}`;
    if (seen.has(uniqueKey)) return;
    seen.add(uniqueKey);
    endUsers.push({
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      training_location: row.training_location,
      project_role: row.user_project_role,
      course_id: row.course_id,
      course_name: row.course_name,
      functional_area: row.functional_area,
      duration_hrs: row.duration_hrs,
      priority: row.course_priority, // scheduling order: lower number goes first
      business_unit: row.business_unit,
      organization: row.organization,
      country: row.user_country,
      department: row.user_department,
      job_title: row.user_job_title,
      location: row.user_location,
      unique_key: uniqueKey
    });
  });
  return {
    endUsers,
    // Counted from the rows before repeated pairs were dropped, as the screen always has
    peopleCount: new Set(chosen.map((row) => row.user_id)).size,
    courseCount: new Set(chosen.map((row) => row.course_id)).size
  };
}

/** Users and total training hours per training location, for the classroom estimate. */
export function groupByLocation(endUsers) {
  const grouped = {};
  endUsers.forEach((item) => {
    const entry = grouped[item.training_location] || (grouped[item.training_location] = { users: new Set(), totalTrainingHours: 0 });
    entry.users.add(item.id);
    entry.totalTrainingHours += Number(item.duration_hrs) || 0;
  });
  return Object.entries(grouped).map(([location, entry]) => ({ location, users: entry.users.size, totalTrainingHours: entry.totalTrainingHours }));
}

/** Text under the classroom estimate: what the figures were based on. */
export function calculationNote(values) {
  const base = `Based on ${values.max_attendees} max attendees, ${values.total_weeks} weeks, ${values.days_per_week} days/week, ${values.daily_hours} hours/day`;
  return values.contingency > 1 ? `${base}, with ${((values.contingency - 1) * 100).toFixed(0)}% contingency` : base;
}

/** Suggestions shown with capacity warnings. */
export function classroomSuggestions(requirements) {
  const suggestions = [];
  if (requirements.some((req) => req.numberOfClassrooms > 5)) suggestions.push('Increase training duration or reduce group sizes.');
  if (requirements.some((req) => req.numberOfClassrooms > 10)) suggestions.push('Consider staggered start dates or additional training locations.');
  return suggestions;
}

export function hasCapacityWarnings(requirements) {
  return requirements.some((req) => req.validation.severity === 'warning' || req.validation.severity === 'error');
}
