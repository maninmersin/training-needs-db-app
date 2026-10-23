// Turning an uploaded spreadsheet (.xlsx, .xls or .csv) into a plain table the importers can check.
import * as XLSX from 'xlsx';
import { parseCsv } from './csv';

/** "Job Title", "job-title" and "JobTitle" can all be matched against a known name. */
export const normalizeHeader = (header) =>
  String(header ?? '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const cellText = (value) => (value === null || value === undefined ? '' : String(value).trim());

/**
 * Rows of cells -> { headers, rows }. The first non-blank row is the header row. Blank rows are skipped.
 * Each row is { rowNumber (as numbered in the file, header = first row), values: { [header]: text } }.
 */
export function tableFromRows(cellRows) {
  const headerIndex = cellRows.findIndex((cells) => cells.some((cell) => cellText(cell) !== ''));
  if (headerIndex === -1) return { headers: [], rows: [] };

  const headers = cellRows[headerIndex].map(cellText);
  const rows = [];
  for (let i = headerIndex + 1; i < cellRows.length; i++) {
    const cells = cellRows[i];
    if (cells.every((cell) => cellText(cell) === '')) continue;
    const values = {};
    headers.forEach((header, index) => {
      if (header) values[header] = cellText(cells[index]);
    });
    rows.push({ rowNumber: i + 1, values });
  }
  return { headers: headers.filter(Boolean), rows };
}

const readAsText = (file) => (file.text ? file.text() : new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('The file could not be read'));
  reader.readAsText(file);
}));

const readAsBytes = (file) => (file.arrayBuffer ? file.arrayBuffer() : new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('The file could not be read'));
  reader.readAsArrayBuffer(file);
}));

// A real .xlsx is a zip (starts "PK"); an old .xls starts with the OLE signature. SheetJS would otherwise
// "read" any file as text and give back junk rows.
const looksLikeExcel = (bytes) => {
  const head = new Uint8Array(bytes).slice(0, 4);
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  return isZip || isOle;
};

/** Reads the first sheet of an Excel file, or a CSV, into a table. Throws a plain-English Error if unreadable. */
export async function readTableFile(file) {
  const name = (file.name || '').toLowerCase();
  try {
    if (name.endsWith('.csv') || name.endsWith('.txt')) return tableFromRows(parseCsv(await readAsText(file)));

    const bytes = await readAsBytes(file);
    if (!looksLikeExcel(bytes)) throw new Error('this does not look like an Excel file');
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('The workbook has no sheets');
    return tableFromRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
  } catch (error) {
    throw new Error(`Could not read "${file.name || 'the file'}": ${error.message}. Use an Excel (.xlsx) or CSV file.`);
  }
}

/**
 * Matches the file's headers to the importer's known columns.
 * `aliases` maps alternative spellings (after normalizeHeader) to the known name.
 * Returns { columns: { [fileHeader]: knownName }, ignored: [fileHeaders not recognised] }.
 */
export function matchColumns(headers, known, aliases = {}) {
  const columns = {};
  const ignored = [];
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    const name = known.includes(normalized) ? normalized : aliases[normalized];
    if (name && !Object.values(columns).includes(name)) columns[header] = name;
    else ignored.push(header);
  });
  return { columns, ignored };
}

/** One file row -> { knownName: text } for the matched columns. A column missing from the file stays undefined. */
export function rowToRecord(row, columns) {
  const record = {};
  Object.entries(columns).forEach(([header, name]) => {
    record[name] = row.values[header] ?? '';
  });
  return record;
}
