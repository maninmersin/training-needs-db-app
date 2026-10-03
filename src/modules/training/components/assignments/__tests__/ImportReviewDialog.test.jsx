/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import * as XLSX from 'xlsx';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import ImportReviewDialog from '../ImportReviewDialog';
import { previewReviewImport, applyReviewImport } from '../../../services/assignmentReviewService';
import { buildReviewModel } from '../reviewSheet';
import { writeReviewWorkbook } from '../reviewWorkbook';

jest.mock('../../../services/assignmentReviewService', () => ({
  previewReviewImport: jest.fn(),
  applyReviewImport: jest.fn()
}));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// user-event updates React outside RTL's act() wrapper here, which only prints a warning (the tests
// still assert on the final DOM). Hide just that one message so real errors stay visible.
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const SCHEDULE = { id: 'sched-1', name: 'Autumn Schedule', project_id: 'proj-1' };

// A real review workbook, with "Move To Group" filled in on the first row
const buildFile = ({ scheduleId = 'sched-1', fillMoveTo = 'Group 2', dropColumn = null } = {}) => {
  const session = (id, n) => ({
    id, course_id: 'A', course_name: 'Course A', session_number: n, session_part_number: 1, session_identifier: `A-${n}`,
    start_datetime: `2026-10-${12 + n}T09:30:00`, end_datetime: `2026-10-${12 + n}T12:30:00`,
    training_location: 'London', functional_area: 'Finance', classroom_number: n, max_attendees: 5, instructor_name: ''
  });
  const sessions = [session('s1', 1), session('s2', 2)];
  const assignments = [{ id: 'r1', end_user_id: 7, session_id: 's1', course_id: 'A', user_name: 'Pat Example', user_email: 'pat@x.com' }];
  const model = buildReviewModel({ sessions, assignments, directory: new Map() });
  const bytes = writeReviewWorkbook({ model, schedule: { ...SCHEDULE, id: scheduleId } });

  const wb = XLSX.read(bytes, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Review, { defval: '' });
  rows[0]['Move To Group'] = fillMoveTo;
  if (dropColumn) delete rows[0][dropColumn];
  wb.Sheets.Review = XLSX.utils.json_to_sheet(rows);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const file = new File([out], 'review.xlsx');
  file.arrayBuffer = async () => out; // jsdom's File has no arrayBuffer
  return file;
};

const planned = (over = {}) => ({
  results: [{
    rowNumber: 2, person: 'Pat Example', personId: 7, course: 'Course A', courseId: 'A', fromGroup: 1, toGroup: 2,
    status: 'ok', message: 'Move from Group 1 to Group 2 (1/5 seats).', plan: { deleteIds: ['r1'], newRows: [{}] }
  }],
  summary: { ok: 1, warning: 0, blocked: 0, error: 0, skipped: 0, unchanged: 0 },
  ...over
});

const props = (over = {}) => ({
  isOpen: true, onClose: jest.fn(), schedule: SCHEDULE, projectId: 'proj-1', filters: {}, onApplied: jest.fn(), ...over
});

const upload = async (user, file) => user.upload(screen.getByLabelText('Review file'), file);

beforeEach(() => {
  jest.clearAllMocks();
  previewReviewImport.mockResolvedValue(planned());
  applyReviewImport.mockResolvedValue({
    outcomes: [{ rowNumber: 2, person: 'Pat Example', course: 'Course A', fromGroup: 1, toGroup: 2, ok: true, applied: true, message: 'ok' }],
    summary: { applied: 1, failed: 0, notApplied: 0 }
  });
});

describe('ImportReviewDialog', () => {
  test('renders nothing when closed', () => {
    const { container } = render(<ImportReviewDialog {...props({ isOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('a valid file is checked first, showing what would happen, and nothing is applied yet', async () => {
    const user = userEvent.setup();
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile());

    expect(await screen.findByText('Pat Example')).toBeInTheDocument();
    expect(screen.getByText('Will move')).toBeInTheDocument();
    expect(screen.getByText(/Group 1 → Group 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 1 move' })).toBeEnabled();
    expect(applyReviewImport).not.toHaveBeenCalled();

    // the rows read from the file are what gets planned
    const [{ items, schedule, projectId }] = previewReviewImport.mock.calls[0];
    expect(items[0]).toMatchObject({ personId: 7, courseId: 'A', currentGroup: 1, moveTo: 2 });
    expect(schedule.id).toBe('sched-1');
    expect(projectId).toBe('proj-1');
  });

  test('a file made for a different schedule is refused with a clear message', async () => {
    const user = userEvent.setup();
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile({ scheduleId: 'some-other-schedule' }));

    expect(await screen.findByText(/made for a different schedule/)).toBeInTheDocument();
    expect(previewReviewImport).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Apply/ })).toBeDisabled();
  });

  test('a file with a required column removed is refused, naming the column', async () => {
    const user = userEvent.setup();
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile({ dropColumn: 'Person ID (do not change)' }));

    expect(await screen.findByText(/missing these columns: Person ID \(do not change\)/)).toBeInTheDocument();
    expect(previewReviewImport).not.toHaveBeenCalled();
  });

  test('rows that cannot be applied are explained; Apply counts only the ones that can', async () => {
    const user = userEvent.setup();
    previewReviewImport.mockResolvedValue({
      results: [
        ...planned().results,
        { rowNumber: 3, person: 'Sam Other', course: 'Course A', fromGroup: 1, toGroup: 9, status: 'error', message: 'Course A has no Group 9 at London (valid groups: 1, 2).', plan: null }
      ],
      summary: { ok: 1, warning: 0, blocked: 0, error: 1, skipped: 0, unchanged: 4 }
    });
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile());

    expect(await screen.findByText(/no Group 9 at London/)).toBeInTheDocument();
    expect(screen.getByText('Cannot apply')).toBeInTheDocument();
    expect(screen.getByText('4 rows left blank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 1 move' })).toBeEnabled();
  });

  test('moves held back because a group is full can be allowed, which re-checks the file', async () => {
    const user = userEvent.setup();
    previewReviewImport
      .mockResolvedValueOnce({
        results: [{ rowNumber: 2, person: 'Pat Example', course: 'Course A', fromGroup: 1, toGroup: 2, status: 'blocked', message: 'Group 2 is full', plan: null }],
        summary: { ok: 0, warning: 0, blocked: 1, error: 0, skipped: 0, unchanged: 0 }
      })
      .mockResolvedValueOnce(planned({ summary: { ok: 0, warning: 1, blocked: 0, error: 0, skipped: 0, unchanged: 0 } }));
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile());

    expect(await screen.findByText('Held back: group is full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 0 moves' })).toBeDisabled();

    await user.click(screen.getByLabelText('Allow moves into full sessions'));
    await waitFor(() => expect(previewReviewImport).toHaveBeenCalledTimes(2));
    expect(previewReviewImport.mock.calls[1][0].allowFull).toBe(true);
    expect(await screen.findByRole('button', { name: 'Apply 1 move' })).toBeEnabled();
  });

  test('Apply saves the moves, shows the result, refreshes the screen and offers a report', async () => {
    const user = userEvent.setup();
    const dialogProps = props();
    render(<ImportReviewDialog {...dialogProps} />);
    await upload(user, buildFile());
    await user.click(await screen.findByRole('button', { name: 'Apply 1 move' }));

    expect(await screen.findByText('1 move applied')).toBeInTheDocument();
    expect(screen.getByText('Every move was applied.')).toBeInTheDocument();
    expect(applyReviewImport).toHaveBeenCalledTimes(1);
    expect(applyReviewImport.mock.calls[0][0].items[0]).toMatchObject({ personId: 7, moveTo: 2 });
    expect(dialogProps.onApplied).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Download report (CSV)' }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs.mock.calls[0][1]).toMatch(/^import_report_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('rows that fail or are skipped on apply are listed with the reason', async () => {
    const user = userEvent.setup();
    applyReviewImport.mockResolvedValue({
      outcomes: [
        { rowNumber: 2, person: 'Pat Example', course: 'Course A', fromGroup: 1, toGroup: 2, ok: true, applied: true, message: 'ok' },
        { rowNumber: 3, person: 'Sam Other', course: 'Course A', fromGroup: 1, toGroup: 2, ok: false, applied: false, message: 'This person was changed by someone else a moment ago. Nothing was changed for it.' }
      ],
      summary: { applied: 1, failed: 1, notApplied: 0 }
    });
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile());
    await user.click(await screen.findByRole('button', { name: 'Apply 1 move' }));

    expect(await screen.findByText('1 failed')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Sam Other')).toBeInTheDocument();
    expect(within(table).getByText(/changed by someone else/)).toBeInTheDocument();
    expect(within(table).queryByText('Pat Example')).not.toBeInTheDocument(); // applied rows aren't listed as problems
  });

  test('says so when no row has a group filled in', async () => {
    const user = userEvent.setup();
    previewReviewImport.mockResolvedValue({ results: [], summary: { ok: 0, warning: 0, blocked: 0, error: 0, skipped: 0, unchanged: 3 } });
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile({ fillMoveTo: '' }));

    expect(await screen.findByText(/No rows have a group filled in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply 0 moves' })).toBeDisabled();
  });

  test('a failure while checking against the schedule is shown, not swallowed', async () => {
    const user = userEvent.setup();
    previewReviewImport.mockRejectedValue(new Error('network down'));
    render(<ImportReviewDialog {...props()} />);
    await upload(user, buildFile());
    expect(await screen.findByText(/Could not check the file against the schedule: network down/)).toBeInTheDocument();
  });

  test('Cancel closes without applying anything', async () => {
    const user = userEvent.setup();
    const dialogProps = props();
    render(<ImportReviewDialog {...dialogProps} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(dialogProps.onClose).toHaveBeenCalled();
    expect(applyReviewImport).not.toHaveBeenCalled();
  });
});
