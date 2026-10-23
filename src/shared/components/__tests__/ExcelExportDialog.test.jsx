/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExcelExportDialog from '../ExcelExportDialog';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const SESSION = {
  id: 's1', course_id: 'c1', course_name: 'Budgeting', session_number: 1, training_location: 'Dubai', classroom_number: 1, functional_area: 'Finance',
  duration_hrs: 3, start_datetime: '2026-10-05T09:30:00', end_datetime: '2026-10-05T12:30:00', instructor_name: 'Tess'
};

const setupDb = (sessions) => {
  supabase.from.mockImplementation((table) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: () => query,
      single: () => ({ then: (resolve) => resolve({ data: { id: 's-1', name: 'Wave One', created_at: '2026-10-01T09:00:00Z', criteria: null }, error: null }) }),
      then: (resolve) => resolve({ data: table === 'training_sessions' ? sessions : [], error: null })
    };
    return query;
  });
};

const blobText = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });
const blobBuffer = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsArrayBuffer(blob); });

const setup = (sessions) => {
  setupDb(sessions);
  const onBack = jest.fn();
  const user = userEvent.setup();
  render(<ExcelExportDialog selectedSchedules={[{ id: 's-1', name: 'Wave One' }]} onBack={onBack} />);
  return { user, onBack };
};

beforeEach(() => jest.clearAllMocks());

describe('ExcelExportDialog', () => {
  test('exports the sessions of the schedule to an Excel file (it used to export none)', async () => {
    const { user, onBack } = setup([SESSION]);
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [blob, filename] = saveAs.mock.calls[0];
    expect(filename).toMatch(/^training_schedules_detailed_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const workbook = XLSX.read(await blobBuffer(blob), { type: 'array' });
    expect(workbook.SheetNames).toEqual(['Detailed Sessions', 'Export Metadata']);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Detailed Sessions']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 'Schedule Name': 'Wave One', 'Course Name': 'Budgeting', Location: 'Dubai', 'Trainer Name': 'Tess' });
    expect(onBack).toHaveBeenCalled();
  });

  test('CSV holds the session sheet only, and starts with a byte order mark for Excel', async () => {
    const { user } = setup([SESSION]);
    await user.click(screen.getByRole('radio', { name: 'CSV (.csv)' }));
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [blob, filename] = saveAs.mock.calls[0];
    expect(filename.endsWith('.csv')).toBe(true);
    expect(Array.from(new Uint8Array(await blobBuffer(blob)).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte order mark
    const text = await blobText(blob);
    expect(text).toContain('Schedule Name,Session Title');
    expect(text).toContain('Budgeting');
  });

  test('a schedule with no sessions is not exported as an empty file', async () => {
    const { user, onBack } = setup([]);
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saveAs).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  test('the summary needs no sessions', async () => {
    const { user } = setup([]);
    await user.click(screen.getByRole('radio', { name: /Summary/ }));
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toContain('summary');
  });
});
