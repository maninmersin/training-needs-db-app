// Functional areas that have training needs but no sessions scheduled. Pure: no database.

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** The areas in `allAreas` that do not appear in `scheduledAreas` (ignoring case and spaces), in the original order. */
export function findUnscheduled(allAreas, scheduledAreas) {
  return allAreas.filter((area) => area && !scheduledAreas.some((scheduled) => same(area, scheduled)));
}

/**
 * How much training each of those areas needs.
 * @param {Array<string>} areas - the unscheduled areas
 * @param {Array<{ functional_area, user_id, course_id }>} rows - training needs (one row per person per course)
 * @returns {Array<{ functional_area, people, courses }>} people and courses are distinct counts; areas with no rows get zeros
 */
export function summariseNeed(areas, rows) {
  return areas.map((area) => {
    const mine = rows.filter((row) => same(row.functional_area ?? '', area));
    return {
      functional_area: area,
      people: new Set(mine.map((row) => row.user_id)).size,
      courses: new Set(mine.map((row) => row.course_id)).size
    };
  });
}
