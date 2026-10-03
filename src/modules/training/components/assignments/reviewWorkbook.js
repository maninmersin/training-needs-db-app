/**
 * Reading and writing the stakeholder review workbook (.xlsx). The row logic lives in reviewSheet.js;
 * this file only turns it into a file and back.
 *
 * Sheets: Review (the one to fill in), Group Options (valid groups and seats left), Instructions,
 * and Info (which schedule the file belongs to, so a file can't be imported into the wrong one).
 */
import * as XLSX from 'xlsx';
import { REVIEW_COLUMNS, REVIEW_FORMAT, OPTIONS_COLUMNS } from './reviewSheet';

const SHEET = { REVIEW: 'Review', OPTIONS: 'Group Options', INSTRUCTIONS: 'Instructions', INFO: 'Info' };

const INSTRUCTIONS = [
  'Assignment review - how to use this file',
  '',
  'This file lists who is booked on which group of each course. Use it to ask for people to be moved to a different group.',
  '',
  '1. On the "Review" sheet, find the person and the course.',
  '2. In the "Move To Group" column, type the group they should move to: for example 3 or Group 3.',
  '   The groups you can choose, with their dates and seats left, are on the "Group Options" sheet.',
  '3. Optionally add a reason in "Change Reason".',
  '4. Leave "Move To Group" empty for everyone who should stay where they are.',
  '5. Save the file and send it back.',
  '',
  'Please do NOT change these columns: Person, Training Location, Functional Area, Course, Current Group, Person ID and Course ID.',
  'They are used to check that each change still applies to the right person and course.',
  'You can sort and filter the Review sheet however you like. Do not add rows for new people; this file is only for moving people between groups of the same course.',
  '',
  'Seats left are as at the time the file was created. A move into a group that is already full may be held back until it is agreed.'
];

const columnWidths = (headers, rows, minimum = 10, maximum = 42) =>
  headers.map((header, i) => ({
    wch: Math.min(maximum, Math.max(minimum, header.length, ...rows.map((row) => String(row[i] ?? '').length)))
  }));

/**
 * Build the workbook for a schedule.
 * @param {Object} args
 * @param {{ rows: Object[], optionsRows: Object[] }} args.model - from buildReviewModel
 * @param {{ id: string, name: string, project_id: string }} args.schedule
 * @param {string} [args.scopeNote] - e.g. which locations/areas the file is limited to
 * @param {Date} [args.exportedAt]
 * @returns {Object} an XLSX workbook
 */
export const createReviewWorkbook = ({ model, schedule, scopeNote = '', exportedAt = new Date() }) => {
  const workbook = XLSX.utils.book_new();

  const headers = REVIEW_COLUMNS.map((c) => c.header);
  const reviewRows = model.rows.map((row) => REVIEW_COLUMNS.map((c) => row[c.id] ?? ''));
  const review = XLSX.utils.aoa_to_sheet([headers, ...reviewRows]);
  review['!cols'] = columnWidths(headers, reviewRows);
  review['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, review, SHEET.REVIEW);

  const optionRows = model.optionsRows.map((row) => OPTIONS_COLUMNS.map((c) => row[c] ?? ''));
  const options = XLSX.utils.aoa_to_sheet([OPTIONS_COLUMNS, ...optionRows]);
  options['!cols'] = columnWidths(OPTIONS_COLUMNS, optionRows);
  XLSX.utils.book_append_sheet(workbook, options, SHEET.OPTIONS);

  const instructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS.map((line) => [line]));
  instructions['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(workbook, instructions, SHEET.INSTRUCTIONS);

  const info = XLSX.utils.aoa_to_sheet([
    ['Format', REVIEW_FORMAT],
    ['Schedule ID', schedule.id],
    ['Schedule Name', schedule.name || ''],
    ['Project ID', schedule.project_id || ''],
    ['Exported At', exportedAt.toISOString()],
    ['Rows', model.rows.length],
    ['Scope', scopeNote]
  ]);
  info['!cols'] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, info, SHEET.INFO);

  return workbook;
};

/** The workbook as bytes, ready to save. */
export const writeReviewWorkbook = (args) =>
  XLSX.write(createReviewWorkbook(args), { type: 'array', bookType: 'xlsx' });

const findSheet = (workbook, name) => {
  const found = workbook.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
  return found ? workbook.Sheets[found] : null;
};

/**
 * Read a review file the user has filled in.
 * Accepts the .xlsx we produced, or a .csv saved from it (a CSV has no Info sheet).
 *
 * @param {ArrayBuffer|Uint8Array} data - the file's bytes
 * @returns {{ rows: Object[], info: Object|null }} rows keyed by the header text; info = the Info sheet as an object
 */
export const readReviewWorkbook = (data) => {
  // codepage 65001 = UTF-8, so names with accents or other scripts survive a CSV
  const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
  if (!workbook.SheetNames.length) throw new Error('The file has no sheets.');

  const reviewSheet = findSheet(workbook, SHEET.REVIEW) || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(reviewSheet, { defval: '', raw: true });

  let info = null;
  const infoSheet = findSheet(workbook, SHEET.INFO);
  if (infoSheet) {
    info = {};
    for (const [key, value] of XLSX.utils.sheet_to_json(infoSheet, { header: 1, defval: '' })) {
      if (key) info[String(key).trim()] = value;
    }
  }
  return { rows, info };
};

/** Check the Info sheet matches the schedule being imported into. Returns an error message or null. */
export const checkReviewInfo = (info, schedule) => {
  if (!info) return null; // e.g. a CSV: nothing to check; rows are still verified against the schedule's data
  if (info.Format && info.Format !== REVIEW_FORMAT) {
    return `This file is in a format this version doesn't understand (${info.Format}).`;
  }
  if (info['Schedule ID'] && info['Schedule ID'] !== schedule.id) {
    return `This file was made for a different schedule${info['Schedule Name'] ? ` ("${info['Schedule Name']}")` : ''}, not "${schedule.name}". Open that schedule to import it.`;
  }
  return null;
};

export const reviewFilename = (schedule, date = new Date()) => {
  const name = (schedule?.name || 'schedule').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  return `assignment_review_${name}_${date.toISOString().slice(0, 10)}.xlsx`;
};
