/**
 * Pure logic for moving a person to another session or group.
 *
 * No React and no database access, so it can be tested on its own. The data shapes are the database's:
 *
 *  - sessions:    training_sessions rows  { id, course_id, course_name, session_number, session_part_number,
 *                 session_identifier, start_datetime, end_datetime, training_location, functional_area,
 *                 classroom_number, max_attendees, instructor_name }
 *  - userRows:    the person's user_assignments rows for the schedule { id, session_id, course_id, ... }
 *  - seatRows:    user_assignments rows (at least session_id and end_user_id) for the sessions being offered
 *
 * How assignments are stored: one row per person per session PART, per course. "Group N" is the session
 * number: everyone in "Group 2" of a course attends that course's session number 2 (all of its parts).
 * A "session group" is therefore (course, session number, location, functional area).
 */

export const MOVE_SCOPE = { COURSE: 'course', GROUP: 'group' };

const sessionGroupKey = (s) =>
  [s.course_id, s.session_number, s.training_location, s.functional_area].join('|');

/**
 * Read the session the person is in from the calendar's session object, which uses several field
 * names depending on where it came from (database-style, calendar-style, or added by the panel).
 * @returns {{ courseId, sessionNumber, location, functionalArea, courseName }}
 */
export const resolveSource = (sessionInfo) => {
  const s = sessionInfo || {};
  const number = s.sessionNumber ?? s.session_number ?? s.session?.session_number;
  return {
    courseId: s.course_id ?? s.course?.course_id ?? s.courseId,
    courseName: s.course_name ?? s.course?.course_name ?? s.courseName,
    sessionNumber: number === undefined || number === null ? undefined : Number(number),
    location: s.training_location ?? s._location ?? s.location,
    functionalArea: s.functional_area ?? s._functionalArea ?? s.functionalArea
  };
};

/** Collapse session rows (one per part) into session groups. */
export const buildSessionGroups = (sessions) => {
  const groups = new Map();
  for (const s of sessions || []) {
    const key = sessionGroupKey(s);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        courseId: s.course_id,
        courseName: s.course_name || s.course_id,
        sessionNumber: s.session_number,
        location: s.training_location,
        functionalArea: s.functional_area,
        parts: [],
        sessionIds: new Set()
      });
    }
    const group = groups.get(key);
    group.parts.push(s);
    group.sessionIds.add(s.id);
  }

  for (const group of groups.values()) {
    group.parts.sort(
      (a, b) =>
        (a.session_part_number || 1) - (b.session_part_number || 1) ||
        new Date(a.start_datetime) - new Date(b.start_datetime)
    );
    group.firstStart = group.parts[0].start_datetime;
    group.lastEnd = group.parts.reduce((latest, p) => (p.end_datetime > latest ? p.end_datetime : latest), group.parts[0].end_datetime);
    group.trainer = group.parts.find((p) => p.instructor_name)?.instructor_name || '';
    group.classroomNumber = group.parts[0].classroom_number;
    group.maxAttendees = Math.max(...group.parts.map((p) => Number(p.max_attendees) || 0));
  }
  return groups;
};

/** Distinct people holding a seat in a session group. */
const seatsTaken = (group, seatRows) => {
  const people = new Set();
  for (const row of seatRows || []) {
    if (group.sessionIds.has(row.session_id)) people.add(row.end_user_id);
  }
  return people.size;
};

const withSeats = (group, seatRows) => {
  const taken = seatsTaken(group, seatRows);
  return {
    key: group.key,
    sessionNumber: group.sessionNumber,
    courseId: group.courseId,
    courseName: group.courseName,
    location: group.location,
    functionalArea: group.functionalArea,
    classroomNumber: group.classroomNumber,
    trainer: group.trainer,
    firstStart: group.firstStart,
    lastEnd: group.lastEnd,
    partCount: group.parts.length,
    seatsTaken: taken,
    maxAttendees: group.maxAttendees,
    seatsLeft: Math.max(0, group.maxAttendees - taken),
    isFull: group.maxAttendees > 0 && taken >= group.maxAttendees
  };
};

/** The session groups the person currently has rows in. */
const personsGroups = (userRows, groups) => {
  const byKey = new Map();
  for (const group of groups.values()) {
    const rows = (userRows || []).filter((r) => group.sessionIds.has(r.session_id));
    if (rows.length > 0) byKey.set(group.key, { group, rows });
  }
  return byKey;
};

/**
 * What the person could be moved to.
 *
 * @param {Object} args
 * @param {Array} args.sessions - training_sessions rows (at least those at the source location and area)
 * @param {Array} args.userRows - the person's assignment rows
 * @param {Array} args.seatRows - assignment rows used to count seats in candidate sessions
 * @param {Object} args.source - { courseId, sessionNumber, location, functionalArea } of the session they are in
 * @param {string} args.scope - MOVE_SCOPE.COURSE or MOVE_SCOPE.GROUP
 * @returns {Array} options, ordered by session number
 */
export const findMoveOptions = ({ sessions, userRows, seatRows, source, scope }) => {
  const groups = buildSessionGroups(sessions);
  const mine = personsGroups(userRows, groups);
  const options = [];

  if (scope === MOVE_SCOPE.COURSE) {
    for (const group of groups.values()) {
      if (
        group.courseId === source.courseId &&
        group.location === source.location &&
        group.functionalArea === source.functionalArea &&
        group.sessionNumber !== source.sessionNumber &&
        !mine.has(group.key)
      ) {
        options.push({ scope, ...withSeats(group, seatRows) });
      }
    }
  } else {
    // Whole group: the courses the person currently takes in group `source.sessionNumber`
    const currentCourses = [...mine.values()]
      .filter(({ group }) =>
        group.sessionNumber === source.sessionNumber &&
        group.location === source.location &&
        group.functionalArea === source.functionalArea)
      .map(({ group }) => group.courseId);

    const targetNumbers = new Set();
    for (const group of groups.values()) {
      if (
        group.location === source.location &&
        group.functionalArea === source.functionalArea &&
        group.sessionNumber !== source.sessionNumber
      ) {
        targetNumbers.add(group.sessionNumber);
      }
    }

    for (const number of [...targetNumbers].sort((a, b) => a - b)) {
      const courses = [];
      const missingCourses = [];
      for (const courseId of currentCourses) {
        const key = [courseId, number, source.location, source.functionalArea].join('|');
        const group = groups.get(key);
        if (!group) {
          const known = [...groups.values()].find((g) => g.courseId === courseId);
          missingCourses.push({ courseId, courseName: known?.courseName || courseId });
        } else if (!mine.has(key)) {
          courses.push(withSeats(group, seatRows));
        }
      }
      options.push({
        scope,
        sessionNumber: number,
        location: source.location,
        functionalArea: source.functionalArea,
        courses,
        missingCourses,
        canMove: missingCourses.length === 0 && courses.length > 0,
        isFull: courses.some((c) => c.isFull),
        fullCourses: courses.filter((c) => c.isFull),
        firstStart: courses.map((c) => c.firstStart).sort()[0],
        lastEnd: courses.map((c) => c.lastEnd).sort().slice(-1)[0]
      });
    }
  }

  return options.sort((a, b) => a.sessionNumber - b.sessionNumber);
};

/**
 * The exact changes for one move: rows to remove and rows to create.
 *
 * The new rows match what auto-assign writes (session level, "Group N"), plus a note saying where the
 * person was moved from, so there is a trail of what changed.
 *
 * @returns {{ deleteIds: string[], newRows: Object[], summary: string }}
 */
export const buildMovePlan = ({ option, sessions, userRows, user, schedule, source, now = new Date() }) => {
  const groups = buildSessionGroups(sessions);
  const mine = personsGroups(userRows, groups);

  const fromGroups = [];
  const toGroups = [];

  if (option.scope === MOVE_SCOPE.COURSE) {
    const from = [...mine.values()].find(({ group }) =>
      group.courseId === source.courseId &&
      group.sessionNumber === source.sessionNumber &&
      group.location === source.location &&
      group.functionalArea === source.functionalArea);
    if (!from) throw new Error('This person is not assigned to that session, so there is nothing to move.');
    fromGroups.push(from);
    toGroups.push(groups.get(option.key));
  } else {
    if (!option.canMove) {
      throw new Error('That group does not run all of the person\'s courses, so they cannot be moved there.');
    }
    for (const entry of mine.values()) {
      const { group } = entry;
      if (
        group.sessionNumber === source.sessionNumber &&
        group.location === source.location &&
        group.functionalArea === source.functionalArea
      ) {
        fromGroups.push(entry);
        toGroups.push(groups.get([group.courseId, option.sessionNumber, group.location, group.functionalArea].join('|')));
      }
    }
  }

  if (fromGroups.length === 0 || toGroups.some((g) => !g)) {
    throw new Error('Could not work out the sessions for this move.');
  }

  const template = fromGroups[0].rows[0];
  const stamp = now.toISOString();
  const destinationNumber = toGroups[0].sessionNumber;
  const note = `Moved from Group ${source.sessionNumber} to Group ${destinationNumber} on ${stamp.slice(0, 10)}`;

  const deleteIds = fromGroups.flatMap(({ rows }) => rows.map((r) => r.id));
  const newRows = toGroups.flatMap((group) =>
    group.parts.map((part) => ({
      schedule_id: schedule.id,
      project_id: schedule.project_id,
      end_user_id: user.userId,
      user_name: template.user_name || user.name || null,
      user_email: template.user_email || null,
      session_id: part.id,
      course_id: part.course_id,
      session_identifier: part.session_identifier,
      training_location: part.training_location,
      functional_area: part.functional_area,
      group_identifier: `Group ${group.sessionNumber}`,
      assignment_level: 'session',
      assignment_status: 'enrolled',
      assignment_type: 'standard',
      completion_status: 'pending',
      assignment_source: 'manual',
      assignment_method: 'manual',
      assigned_at: stamp,
      notes: note
    }))
  );

  const courseNames = toGroups.map((g) => g.courseName).join(', ');
  return {
    deleteIds,
    newRows,
    summary: `${note} (${courseNames}): removing ${deleteIds.length} session rows, adding ${newRows.length}.`
  };
};
