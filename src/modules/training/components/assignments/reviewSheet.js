/**
 * The stakeholder review sheet: what goes into the Excel file, how it is read back, and what an import
 * would do. Pure logic with no database or Excel code, so it is easy to test.
 *
 * The sheet has ONE ROW PER PERSON PER COURSE (not per session part), because that is what a reviewer
 * thinks in: "Pat is in Group 2 of Course A; move Pat to Group 3". The reviewer fills in "Move To Group"
 * (and optionally a reason). Person ID and Course ID are kept in the file so the import never has to
 * guess who someone is from their name.
 *
 * An import is always planned first (nothing changes), shown to the user, and only then applied. Each
 * move reuses the same rules as the Move dialog (moveUserAssignments.js).
 */
import {
  MOVE_SCOPE,
  buildSessionGroups,
  findMoveOptions,
  buildMovePlan,
  describeGroupSeats
} from './moveUserAssignments';

export const REVIEW_FORMAT = 'assignment-review-v1';

// Header text as it appears in the file, and the id used inside the code
export const REVIEW_COLUMNS = [
  { id: 'person', header: 'Person' },
  { id: 'email', header: 'Email' },
  { id: 'location', header: 'Training Location' },
  { id: 'area', header: 'Functional Area' },
  { id: 'role', header: 'Project Role' },
  { id: 'course', header: 'Course' },
  { id: 'currentGroup', header: 'Current Group' },
  { id: 'currentDates', header: 'Current Dates' },
  { id: 'moveTo', header: 'Move To Group' },
  { id: 'reason', header: 'Change Reason' },
  { id: 'personId', header: 'Person ID (do not change)' },
  { id: 'courseId', header: 'Course ID (do not change)' }
];

// Columns the import cannot work without
const REQUIRED_COLUMNS = ['personId', 'courseId', 'currentGroup', 'location', 'area', 'moveTo'];

export const OPTIONS_COLUMNS = [
  'Training Location', 'Functional Area', 'Course ID', 'Course', 'Group', 'Dates', 'Seats Taken', 'Max Seats', 'Seats Left'
];

// "2026-10-12T09:30:00+03:00" -> a Date for 12 Oct 09:30 (the app stores plain wall-clock times)
const parseLocal = (value) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
};

const formatWhen = (value) => {
  const date = parseLocal(value);
  return date
    ? date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
};

export const formatDates = (start, end) => {
  const first = formatWhen(start);
  const last = formatWhen(end);
  return last && last !== first ? `${first} - ${last}` : first;
};

// null/undefined = no restriction. An EMPTY list means nothing is allowed (never "everything"), so a
// scope that ends up empty can't accidentally open everything up.
const inList = (list, value) => !list || list.includes(value);

/** A stakeholder's list: no list at all (no restriction) when they have none assigned. */
export const scopeList = (list) => (Array.isArray(list) && list.length > 0 ? list : null);

/**
 * Combine scope lists so a row must satisfy all of them. null lists are ignored; if the lists share
 * nothing the result is an empty list, which allows nothing.
 */
export const combineScopeLists = (...lists) => {
  const active = lists.filter((list) => Array.isArray(list));
  if (active.length === 0) return null;
  return active.reduce((acc, list) => acc.filter((value) => list.includes(value)));
};

/**
 * The rows to put in the file.
 *
 * @param {Object} args
 * @param {Array} args.sessions - training_sessions rows for the schedule
 * @param {Array} args.assignments - user_assignments rows for the schedule
 * @param {Map} args.directory - id -> { name, email, project_role } (see userDirectoryService)
 * @param {Object} [args.filters] - { locations, functionalAreas }: only these (a stakeholder's scope)
 * @returns {{ rows: Array<Object>, optionsRows: Array<Object>, people: number }}
 */
export const buildReviewModel = ({ sessions, assignments, directory, filters = {} }) => {
  const groups = buildSessionGroups(sessions);
  const groupBySession = new Map();
  for (const group of groups.values()) {
    for (const id of group.sessionIds) groupBySession.set(id, group);
  }

  // One entry per person per course session group, however many parts it has
  const entries = new Map();
  for (const assignment of assignments || []) {
    const group = groupBySession.get(assignment.session_id);
    if (!group) continue;
    if (!inList(filters.locations, group.location) || !inList(filters.functionalAreas, group.functionalArea)) continue;
    const key = `${assignment.end_user_id}|${group.key}`;
    if (!entries.has(key)) entries.set(key, { personId: assignment.end_user_id, group, assignment });
  }

  const rows = [...entries.values()].map(({ personId, group, assignment }) => {
    const person = directory?.get(personId) || {};
    return {
      person: person.name || assignment.user_name || `User ${personId}`,
      email: person.email || assignment.user_email || '',
      location: group.location,
      area: group.functionalArea,
      role: person.project_role || '',
      course: group.courseName,
      currentGroup: `Group ${group.sessionNumber}`,
      currentDates: formatDates(group.firstStart, group.lastEnd),
      moveTo: '',
      reason: '',
      personId,
      courseId: group.courseId,
      _sort: [group.location, group.functionalArea, group.courseName, String(group.sessionNumber).padStart(5, '0'), person.name || assignment.user_name || '']
    };
  });
  rows.sort((a, b) => {
    for (let i = 0; i < a._sort.length; i++) {
      const cmp = String(a._sort[i]).localeCompare(String(b._sort[i]));
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  rows.forEach((row) => { delete row._sort; });

  // The valid choices: every group of each course that appears, at that location and area
  const wanted = new Set(rows.map((r) => `${r.courseId}|${r.location}|${r.area}`));
  const optionsRows = [...groups.values()]
    .filter((g) => wanted.has(`${g.courseId}|${g.location}|${g.functionalArea}`))
    .map((group) => describeGroupSeats(group, assignments))
    .sort((a, b) =>
      String(a.location).localeCompare(String(b.location)) ||
      String(a.functionalArea).localeCompare(String(b.functionalArea)) ||
      String(a.courseName).localeCompare(String(b.courseName)) ||
      a.sessionNumber - b.sessionNumber)
    .map((g) => ({
      'Training Location': g.location,
      'Functional Area': g.functionalArea,
      'Course ID': g.courseId,
      Course: g.courseName,
      Group: `Group ${g.sessionNumber}`,
      Dates: formatDates(g.firstStart, g.lastEnd),
      'Seats Taken': g.seatsTaken,
      'Max Seats': g.maxAttendees,
      'Seats Left': g.seatsLeft
    }));

  return { rows, optionsRows, people: new Set(rows.map((r) => r.personId)).size };
};

// "Person ID (do not change)" -> "personid"
const normalizeHeader = (header) => String(header || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
const HEADER_TO_ID = Object.fromEntries(REVIEW_COLUMNS.map((c) => [normalizeHeader(c.header), c.id]));

/** Read the "Move To Group" cell: blank means no change; "2", "Group 2" and "Group 2 - Tue 14 Oct" all mean 2. */
export const parseMoveTo = (raw) => {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? { value: raw } : { value: null, error: `"${raw}" is not a group number` };
  }
  const text = String(raw).trim();
  if (text === '' || /^(keep|no change|none|n\/a|-)$/i.test(text)) return { value: null };
  const match = text.match(/(\d+)/);
  return match && Number(match[1]) > 0
    ? { value: Number(match[1]) }
    : { value: null, error: `Could not read a group number from "${text}"` };
};

/**
 * Turn the rows read from the file into import items.
 * @param {Array<Object>} rawRows - one object per row, keyed by the column header text in the file
 * @returns {{ items: Array, missingColumns: string[] }} missingColumns lists headers that must be present
 */
export const parseReviewRows = (rawRows) => {
  const seen = new Set();
  const items = [];

  (rawRows || []).forEach((raw, index) => {
    const record = {};
    for (const [header, value] of Object.entries(raw || {})) {
      const id = HEADER_TO_ID[normalizeHeader(header)];
      if (id) { record[id] = value; seen.add(id); }
    }
    const isEmpty = Object.values(raw || {}).every((v) => v === '' || v === null || v === undefined);
    if (isEmpty) return;

    const moveTo = parseMoveTo(record.moveTo);
    const currentNumber = String(record.currentGroup ?? '').match(/(\d+)/);
    // A blank cell must not become 0 (Number('') is 0): a missing Person ID is an error, not person 0
    const rawPersonId = record.personId;
    const personId = rawPersonId === undefined || rawPersonId === null || String(rawPersonId).trim() === '' ? NaN : Number(rawPersonId);
    items.push({
      rowNumber: index + 2, // row 1 of the sheet is the header
      personId,
      person: record.person ? String(record.person) : '',
      courseId: record.courseId === undefined || record.courseId === null ? '' : String(record.courseId),
      course: record.course ? String(record.course) : '',
      location: record.location === undefined ? '' : String(record.location),
      area: record.area === undefined ? '' : String(record.area),
      currentGroup: currentNumber ? Number(currentNumber[1]) : NaN,
      moveTo: moveTo.value,
      moveToError: moveTo.error || null,
      reason: record.reason ? String(record.reason).trim() : ''
    });
  });

  const missingColumns = REQUIRED_COLUMNS
    .filter((id) => !seen.has(id))
    .map((id) => REVIEW_COLUMNS.find((c) => c.id === id).header);
  return { items, missingColumns: items.length > 0 ? missingColumns : [] };
};

/**
 * Work out, without changing anything, what importing these rows would do.
 *
 * Rows are checked in file order against the current data, and each planned move updates a working copy
 * so that seat counts and "is this person still there" stay right for the rows that follow.
 *
 * Statuses: ok | warning (moves into a full session, allowed) | blocked (full and not allowed) |
 *           error (cannot be done) | skipped (already in that group)
 *
 * @param {Object} args
 * @param {Array} args.items - from parseReviewRows
 * @param {Array} args.sessions - training_sessions rows for the schedule
 * @param {Array} args.assignments - user_assignments rows for the schedule (current)
 * @param {Map} args.directory - people details, for names in messages
 * @param {Object} args.schedule - { id, project_id }
 * @param {boolean} [args.allowFull] - allow moves into sessions that are already full
 * @param {Object} [args.filters] - { locations, functionalAreas }: a stakeholder's scope; rows outside are refused
 * @returns {{ results: Array, summary: Object }}
 */
export const planReviewImport = ({ items, sessions, assignments, directory, schedule, allowFull = false, filters = {} }) => {
  const groups = buildSessionGroups(sessions);
  let working = (assignments || []).map((a) => ({ ...a })); // updated as moves are planned
  const doneKeys = new Set();
  const results = [];
  const summary = { ok: 0, warning: 0, blocked: 0, error: 0, skipped: 0, unchanged: 0 };

  const record = (item, status, message, plan = null, extra = {}) => {
    summary[status] += 1;
    results.push({
      rowNumber: item.rowNumber,
      person: extra.person || item.person || `User ${item.personId}`,
      personId: item.personId,
      course: extra.course || item.course || item.courseId,
      courseId: item.courseId,
      fromGroup: item.currentGroup,
      toGroup: item.moveTo,
      status,
      message,
      plan
    });
  };

  for (const item of items) {
    if (item.moveToError) { record(item, 'error', item.moveToError); continue; }
    if (item.moveTo === null) { summary.unchanged += 1; continue; } // nothing asked for

    const name = directory?.get(item.personId)?.name ||
      working.find((a) => a.end_user_id === item.personId)?.user_name || item.person || `User ${item.personId}`;
    const extra = { person: name };

    if (!Number.isInteger(item.personId) || !item.courseId || !Number.isInteger(item.currentGroup) || !item.location || !item.area) {
      record(item, 'error', 'The Person ID, Course ID, Current Group, Training Location or Functional Area is missing or has been changed.', null, extra);
      continue;
    }
    if (!inList(filters.locations, item.location) || !inList(filters.functionalAreas, item.area)) {
      record(item, 'error', 'This is outside the locations or functional areas you are allowed to change.', null, extra);
      continue;
    }

    const rowKey = `${item.personId}|${item.courseId}`;
    if (doneKeys.has(rowKey)) {
      record(item, 'error', 'This person and course appear more than once in the file; only the first row is used.', null, extra);
      continue;
    }
    doneKeys.add(rowKey);

    const sourceKey = [item.courseId, item.currentGroup, item.location, item.area].join('|');
    const sourceGroup = groups.get(sourceKey);
    const courseName = sourceGroup?.courseName || item.course || item.courseId;
    extra.course = courseName;
    if (!sourceGroup) {
      record(item, 'error', `${courseName}: Group ${item.currentGroup} does not exist at ${item.location} (${item.area}).`, null, extra);
      continue;
    }

    const userRows = working.filter((a) => a.end_user_id === item.personId);
    const inSource = userRows.some((a) => sourceGroup.sessionIds.has(a.session_id));
    if (!inSource) {
      const nowIn = [...groups.values()]
        .filter((g) => g.courseId === item.courseId && g.location === item.location && g.functionalArea === item.area &&
          userRows.some((a) => g.sessionIds.has(a.session_id)))
        .map((g) => `Group ${g.sessionNumber}`);
      record(item, 'error',
        nowIn.length
          ? `Out of date: ${name} is no longer in Group ${item.currentGroup} for ${courseName} (now in ${nowIn.join(', ')}).`
          : `Out of date: ${name} is no longer assigned to ${courseName}.`,
        null, extra);
      continue;
    }

    if (item.moveTo === item.currentGroup) {
      record(item, 'skipped', `Already in Group ${item.currentGroup}; nothing to change.`, null, extra);
      continue;
    }

    const source = { courseId: item.courseId, sessionNumber: item.currentGroup, location: item.location, functionalArea: item.area };
    const options = findMoveOptions({ sessions, userRows, seatRows: working, source, scope: MOVE_SCOPE.COURSE });
    const option = options.find((o) => o.sessionNumber === item.moveTo);

    if (!option) {
      const targetKey = [item.courseId, item.moveTo, item.location, item.area].join('|');
      if (groups.has(targetKey)) {
        record(item, 'error', `${name} is already in Group ${item.moveTo} for ${courseName}.`, null, extra);
      } else {
        const valid = [...groups.values()]
          .filter((g) => g.courseId === item.courseId && g.location === item.location && g.functionalArea === item.area)
          .map((g) => g.sessionNumber).sort((a, b) => a - b);
        record(item, 'error', `${courseName} has no Group ${item.moveTo} at ${item.location} (valid groups: ${valid.join(', ')}).`, null, extra);
      }
      continue;
    }

    let status = 'ok';
    let message = `Move from Group ${item.currentGroup} to Group ${item.moveTo} (${option.seatsTaken + 1}/${option.maxAttendees} seats).`;
    if (option.isFull) {
      const seats = `${option.seatsTaken}/${option.maxAttendees} seats already taken`;
      if (!allowFull) {
        record(item, 'blocked', `Group ${item.moveTo} is full (${seats}). Tick "Allow moves into full sessions" to include this.`, null, extra);
        continue;
      }
      status = 'warning';
      message = `Group ${item.moveTo} is full (${seats}); this move goes over the planned numbers.`;
    }

    let plan;
    try {
      plan = buildMovePlan({
        option, sessions, userRows,
        user: { userId: item.personId, name },
        schedule, source, reason: item.reason
      });
    } catch (error) {
      record(item, 'error', error.message, null, extra);
      continue;
    }

    // Keep the working copy in step so later rows see this move
    const removed = new Set(plan.deleteIds);
    working = working.filter((a) => !removed.has(a.id));
    plan.newRows.forEach((row, i) => working.push({ ...row, id: `planned-${item.rowNumber}-${i}` }));

    record(item, status, message, plan, extra);
  }

  return { results, summary };
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The result of an import as a CSV report (quotes and commas in messages are escaped properly). */
export const outcomesToCsv = (outcomes) => {
  const header = ['Row', 'Person', 'Course', 'From Group', 'To Group', 'Result', 'Message'];
  const lines = (outcomes || []).map((o) => [
    o.rowNumber, o.person, o.course, o.fromGroup, o.toGroup, o.applied ? 'Applied' : 'Not applied', o.message
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\r\n');
};
