// The numbers shown for one session. Pure: no database.

/**
 * @param {Array<number>} assignedIds - people assigned to the session
 * @param {Array} records - attendance records: { attendee_id, attendance_statuses: { status_name, is_present } }
 * Records for people who were not assigned are "walk-ins": counted separately, so they never push the
 * attendance rate (present assigned people / assigned people) above what was planned.
 */
export function summariseAttendance(assignedIds, records) {
  const assigned = new Set(assignedIds);
  let totalAttended = 0;
  let totalAbsent = 0;
  let totalWalkIns = 0;
  const statusBreakdown = {};

  records.forEach((record) => {
    const status = record.attendance_statuses;
    if (!status) return;
    statusBreakdown[status.status_name] = (statusBreakdown[status.status_name] || 0) + 1;
    if (!assigned.has(record.attendee_id)) {
      if (status.is_present) totalWalkIns += 1;
      return;
    }
    if (status.is_present) totalAttended += 1;
    else totalAbsent += 1;
  });

  const totalRegistered = assigned.size;
  return {
    total_registered: totalRegistered,
    total_attended: totalAttended,
    total_absent: totalAbsent,
    total_walk_ins: totalWalkIns,
    attendance_rate: totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0,
    status_breakdown: statusBreakdown
  };
}
