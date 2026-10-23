import * as XLSX from 'xlsx';
import { parseCsv, toCsv } from '../csv';
import { matchColumns, normalizeHeader, readTableFile, rowToRecord, tableFromRows } from '../tableFile';

describe('parseCsv', () => {
  test('splits cells and rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  test('handles Windows line endings and a byte-order mark', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  test('quoted cells can hold commas, doubled quotes and line breaks', () => {
    expect(parseCsv('name,note\n"Smith, Jo","said ""hi"""\n"two\nlines",x')).toEqual([
      ['name', 'note'], ['Smith, Jo', 'said "hi"'], ['two\nlines', 'x']
    ]);
  });

  test('a space before an opening quote is allowed, and empty cells are kept', () => {
    expect(parseCsv('a,b,c\n1, "x,y",')).toEqual([['a', 'b', 'c'], ['1', 'x,y', '']]);
  });

  test('a quote in the middle of a cell is just text', () => {
    expect(parseCsv('5" pipe,ok')).toEqual([['5" pipe', 'ok']]);
  });

  test('no trailing newline and empty input both work', () => {
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('toCsv', () => {
  test('quotes only where needed and round-trips through parseCsv', () => {
    const rows = [['id', 'note'], [1, 'plain'], [2, 'has, comma'], [3, 'has "quote"'], [4, 'two\nlines'], [5, null]];
    const text = toCsv(rows);
    expect(text.split('\r\n')[1]).toBe('1,plain');
    expect(parseCsv(text)).toEqual([['id', 'note'], ['1', 'plain'], ['2', 'has, comma'], ['3', 'has "quote"'], ['4', 'two\nlines'], ['5', '']]);
  });
});

describe('tableFromRows', () => {
  test('uses the first non-blank row as headers, skips blank rows, numbers rows as in the file', () => {
    const table = tableFromRows([[''], ['id', ' name '], ['1', ' Pat '], ['', ''], ['2', 'Sam']]);
    expect(table.headers).toEqual(['id', 'name']);
    expect(table.rows).toEqual([
      { rowNumber: 3, values: { id: '1', name: 'Pat' } },
      { rowNumber: 5, values: { id: '2', name: 'Sam' } }
    ]);
  });

  test('missing cells become empty text and numbers become text', () => {
    expect(tableFromRows([['a', 'b'], [7]]).rows[0].values).toEqual({ a: '7', b: '' });
  });

  test('an empty file gives an empty table', () => {
    expect(tableFromRows([])).toEqual({ headers: [], rows: [] });
    expect(tableFromRows([['', '']])).toEqual({ headers: [], rows: [] });
  });
});

describe('column matching', () => {
  test('headers match ignoring case, spaces and punctuation, plus aliases', () => {
    expect(normalizeHeader(' Job Title ')).toBe('job_title');
    expect(normalizeHeader('\uFEFFUserID')).toBe('userid');
    const { columns, ignored } = matchColumns(['UserID', 'Job Title', 'Shoe size', 'name'], ['id', 'job_title', 'name'], { userid: 'id' });
    expect(columns).toEqual({ UserID: 'id', 'Job Title': 'job_title', name: 'name' });
    expect(ignored).toEqual(['Shoe size']);
  });

  test('a second column with the same meaning is ignored rather than overwriting the first', () => {
    const { columns, ignored } = matchColumns(['id', 'ID'], ['id']);
    expect(columns).toEqual({ id: 'id' });
    expect(ignored).toEqual(['ID']);
  });

  test('rowToRecord leaves a column that is not in the file undefined', () => {
    const record = rowToRecord({ values: { Name: 'Pat' } }, { Name: 'name', Email: 'email' });
    expect(record).toEqual({ name: 'Pat', email: '' });
    expect('job_title' in record).toBe(false);
  });
});

describe('readTableFile', () => {
  const fileOf = (name, content) => ({ name, text: async () => content, arrayBuffer: async () => content });

  test('reads a CSV file', async () => {
    const table = await readTableFile(fileOf('people.csv', 'id,name\n1,Pat\n'));
    expect(table.rows[0].values).toEqual({ id: '1', name: 'Pat' });
  });

  test('reads the first sheet of an Excel file', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id', 'name'], [1, 'Pat'], [2, 'Sam']]), 'People');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ignored']]), 'Other');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const table = await readTableFile(fileOf('people.xlsx', bytes));
    expect(table.headers).toEqual(['id', 'name']);
    expect(table.rows.map((r) => r.values.name)).toEqual(['Pat', 'Sam']);
  });

  test('an unreadable file gives a plain-English error', async () => {
    await expect(readTableFile(fileOf('broken.xlsx', 'not really an excel file'))).rejects.toThrow(/Could not read "broken.xlsx"/);
  });
});
