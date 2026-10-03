import * as XLSX from 'xlsx';
import { buildReviewModel, parseReviewRows, planReviewImport } from '../reviewSheet';
import {
  createReviewWorkbook,
  writeReviewWorkbook,
  readReviewWorkbook,
  checkReviewInfo,
  reviewFilename
} from '../reviewWorkbook';

const SCHEDULE = { id: 'sched-1', name: 'Autumn Schedule', project_id: 'proj-1' };

const session = (id, n, part) => ({
  id, course_id: 'A', course_name: 'Course A', session_number: n, session_part_number: part,
  session_identifier: `A-session${n}-part${part}`,
  start_datetime: `2026-10-${12 + n}T09:30:00`, end_datetime: `2026-10-${12 + n}T12:30:00`,
  training_location: 'London', functional_area: 'Finance', classroom_number: n, max_attendees: 3, instructor_name: ''
});
const sessions = [session('s1', 1, 1), session('s2', 1, 2), session('s3', 2, 1), session('s4', 2, 2)];
const assignments = ['s1', 's2'].map((sid, i) => ({
  id: `r${i}`, end_user_id: 7, session_id: sid, course_id: 'A', user_name: 'Zoë Müller', user_email: 'zoe@example.com'
}));
const directory = new Map([[7, { id: 7, name: 'Zoë Müller', email: 'zoe@example.com', project_role: 'Buyer' }]]);

const model = () => buildReviewModel({ sessions, assignments, directory });

describe('review workbook', () => {
  test('has the four sheets, Review first', () => {
    const wb = createReviewWorkbook({ model: model(), schedule: SCHEDULE });
    expect(wb.SheetNames).toEqual(['Review', 'Group Options', 'Instructions', 'Info']);
  });

  test('Review has the header row and one row per person per course', () => {
    const wb = createReviewWorkbook({ model: model(), schedule: SCHEDULE });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.Review, { header: 1 });
    expect(aoa[0]).toEqual([
      'Person', 'Email', 'Training Location', 'Functional Area', 'Project Role', 'Course', 'Current Group',
      'Current Dates', 'Move To Group', 'Change Reason', 'Person ID (do not change)', 'Course ID (do not change)'
    ]);
    expect(aoa).toHaveLength(2); // header + one person-course (two session parts collapsed)
    expect(aoa[1][0]).toBe('Zoë Müller');
    expect(aoa[1][10]).toBe(7); // Person ID stays a number
  });

  test('Group Options lists the groups to choose from, with seats left', () => {
    const wb = createReviewWorkbook({ model: model(), schedule: SCHEDULE });
    const options = XLSX.utils.sheet_to_json(wb.Sheets['Group Options']);
    expect(options.map((o) => o.Group)).toEqual(['Group 1', 'Group 2']);
    expect(options[0]).toMatchObject({ 'Seats Taken': 1, 'Max Seats': 3, 'Seats Left': 2 });
  });

  test('Info records which schedule the file belongs to', () => {
    const exportedAt = new Date('2026-10-05T10:00:00Z');
    const bytes = writeReviewWorkbook({ model: model(), schedule: SCHEDULE, scopeNote: 'London only', exportedAt });
    const { info } = readReviewWorkbook(bytes);
    expect(info).toMatchObject({
      Format: 'assignment-review-v1', 'Schedule ID': 'sched-1', 'Schedule Name': 'Autumn Schedule',
      'Project ID': 'proj-1', 'Exported At': exportedAt.toISOString(), Rows: 1, Scope: 'London only'
    });
  });
});

describe('round trip: export, the reviewer fills it in, import', () => {
  const fillIn = (bytes, edits) => {
    const wb = XLSX.read(bytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Review, { defval: '' });
    edits(rows);
    wb.Sheets.Review = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) });
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  };

  test('a filled-in file is read back and planned as the reviewer intended', () => {
    const exported = writeReviewWorkbook({ model: model(), schedule: SCHEDULE });
    const edited = fillIn(exported, (rows) => { rows[0]['Move To Group'] = 'Group 2'; rows[0]['Change Reason'] = 'Training clash'; });

    const { rows, info } = readReviewWorkbook(edited);
    expect(checkReviewInfo(info, SCHEDULE)).toBeNull();

    const { items, missingColumns } = parseReviewRows(rows);
    expect(missingColumns).toEqual([]);
    const { results, summary } = planReviewImport({ items, sessions, assignments, directory, schedule: SCHEDULE });
    expect(summary.ok).toBe(1);
    expect(results[0]).toMatchObject({ person: 'Zoë Müller', fromGroup: 1, toGroup: 2, status: 'ok' });
    expect(results[0].plan.newRows.map((r) => r.session_id)).toEqual(['s3', 's4']);
    expect(results[0].plan.newRows[0].notes).toMatch(/Reason: Training clash/);
  });

  test('an untouched file plans nothing', () => {
    const { rows } = readReviewWorkbook(writeReviewWorkbook({ model: model(), schedule: SCHEDULE }));
    const { items } = parseReviewRows(rows);
    const { results, summary } = planReviewImport({ items, sessions, assignments, directory, schedule: SCHEDULE });
    expect(results).toEqual([]);
    expect(summary.unchanged).toBe(1);
  });

  test('a file saved as CSV still works, including accented names', () => {
    const csv = [
      'Person,Training Location,Functional Area,Course,Current Group,Move To Group,Change Reason,Person ID (do not change),Course ID (do not change)',
      '"Zoë Müller",London,Finance,Course A,Group 1,2,"Clash, again",7,A'
    ].join('\r\n');
    const { rows, info } = readReviewWorkbook(new TextEncoder().encode(csv));
    expect(info).toBeNull(); // a CSV has no Info sheet
    expect(rows[0].Person).toBe('Zoë Müller');
    const { items } = parseReviewRows(rows);
    expect(items[0]).toMatchObject({ personId: 7, courseId: 'A', currentGroup: 1, moveTo: 2, reason: 'Clash, again' });
  });

  test('a header-only file reads as no rows', () => {
    const header = XLSX.utils.aoa_to_sheet([['Person', 'Move To Group']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, header, 'Review');
    const { rows } = readReviewWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(rows).toEqual([]);
  });
});

describe('checkReviewInfo', () => {
  test('refuses a file made for a different schedule', () => {
    const message = checkReviewInfo({ Format: 'assignment-review-v1', 'Schedule ID': 'other', 'Schedule Name': 'Spring' }, SCHEDULE);
    expect(message).toMatch(/different schedule.*"Spring".*"Autumn Schedule"/);
  });

  test('refuses a format it does not know', () => {
    expect(checkReviewInfo({ Format: 'something-else' }, SCHEDULE)).toMatch(/format/);
  });

  test('accepts the matching schedule, and a file with no Info sheet', () => {
    expect(checkReviewInfo({ Format: 'assignment-review-v1', 'Schedule ID': 'sched-1' }, SCHEDULE)).toBeNull();
    expect(checkReviewInfo(null, SCHEDULE)).toBeNull();
  });
});

describe('reviewFilename', () => {
  test('is safe and dated', () => {
    expect(reviewFilename({ name: 'Training Schedule - 2026/10' }, new Date('2026-10-05T00:00:00Z')))
      .toBe('assignment_review_Training_Schedule_2026_10_2026-10-05.xlsx');
  });
});
