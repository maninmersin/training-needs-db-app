// CSV reading and writing that follows the usual rules (quotes, doubled quotes, line breaks inside a
// quoted cell, Windows or Mac line endings, a leading byte-order mark). Pure: text in, rows out.

/** Text -> array of rows, each an array of cell strings. A trailing blank line is ignored. */
export function parseCsv(text) {
  const source = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      if (source[i + 1] === '\n') i++;
      endRow();
    } else if (char === '\n') {
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

const needsQuotes = (text) => /[",\r\n]/.test(text) || text !== text.trim();

/** Array of rows -> CSV text. Cells that contain commas, quotes or line breaks are quoted. */
export function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null || cell === undefined ? '' : String(cell);
          return needsQuotes(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(',')
    )
    .join('\r\n');
}
