/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CoursesForm from '../CoursesForm';
import { TooltipProvider } from '@/components/ui';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { saveAs } from 'file-saver';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

// react-table and Radix update state outside RTL's act(); hide only that warning.
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const courses = () => [
  { course_id: 'FIN-101', course_name: 'Ledger Basics', functional_area: 'Finance', duration_hrs: 3, application: 'ERP', priority: 1 },
  { course_id: 'HR-201', course_name: 'Onboarding', functional_area: 'HR', duration_hrs: 1.5, application: '', priority: 2 },
  { course_id: 'OPS-301', course_name: 'Stock Counts', functional_area: 'Operations', duration_hrs: 3, application: 'WMS', priority: 3 }
];

// A small fake of the query builder: records writes and answers reads per table.
const installDatabase = ({ insertError = null } = {}) => {
  const log = [];
  supabase.from.mockImplementation((table) => {
    const state = { table, op: 'select' };
    const answer = () => {
      if (state.op === 'update') { log.push(['update', state.changes, state.eq]); return { error: null }; }
      if (state.op === 'insert') { log.push(['insert', state.rows]); return insertError ? { data: null, error: insertError } : { data: state.rows, error: null }; }
      if (state.op === 'delete') { log.push(['delete', state.eq]); return { error: null }; }
      if (table === 'functional_areas') return { data: [{ name: 'Finance' }, { name: 'HR' }, { name: 'Operations' }], error: null };
      return { data: courses(), error: null };
    };
    const query = {
      select: () => query,
      insert: (r) => { state.op = 'insert'; state.rows = r; return query; },
      update: (c) => { state.op = 'update'; state.changes = c; return query; },
      delete: () => { state.op = 'delete'; return query; },
      eq: (c, v) => { state.eq = [c, v]; return query; },
      order: () => query,
      then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject)
    };
    return query;
  });
  return log;
};

const setup = async (options) => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', name: 'acme', title: 'ACME Corp' } });
  const log = installDatabase(options);
  render(<MemoryRouter><TooltipProvider><CoursesForm /></TooltipProvider></MemoryRouter>);
  await screen.findByText('Ledger Basics');
  return log;
};

beforeEach(() => jest.clearAllMocks());

describe('CoursesForm', () => {
  test('lists the project\'s courses with the count', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Courses Management' })).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'span' })).toBeInTheDocument();
  });

  test('without a project it explains what to do', async () => {
    useProject.mockReturnValue({ currentProject: null });
    installDatabase();
    render(<MemoryRouter><TooltipProvider><CoursesForm /></TooltipProvider></MemoryRouter>);
    expect(await screen.findByText('No Project Selected')).toBeInTheDocument();
  });

  test('searching and filtering narrow the list', async () => {
    const user = userEvent.setup();
    await setup();
    await user.type(screen.getByLabelText('Search courses'), 'stock');
    expect(screen.queryByText('Ledger Basics')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search courses'));

    await user.click(screen.getByRole('button', { name: /Filter by Functional Area/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'HR' }));
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.queryByText('Ledger Basics')).not.toBeInTheDocument();
  });

  test('editing saves only what changed, with duration as a number, and keeps the ID read-only', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Edit course' })[0]);
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByLabelText('Course ID')).toBeDisabled();
    const duration = within(panel).getByLabelText('Duration (hrs)');
    await user.clear(duration);
    await user.type(duration, '4.5');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(log).toEqual([['update', { duration_hrs: 4.5 }, ['course_id', 'FIN-101']]]);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  test('bad numbers are refused in the panel and nothing is written', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByText('Onboarding'));
    const panel = await screen.findByRole('dialog');
    await user.clear(within(panel).getByLabelText('Duration (hrs)'));
    await user.clear(within(panel).getByLabelText('Priority'));
    await user.type(within(panel).getByLabelText('Priority'), '0');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(within(panel).getByText('Enter the duration in hours')).toBeInTheDocument();
    expect(within(panel).getByText(/Priority must be a whole number/)).toBeInTheDocument();
    expect(log).toEqual([]);
  });

  test('adding needs an ID, then inserts with the project id and the first functional area', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByRole('button', { name: /Add New Course/ }));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add course' }));
    expect(within(panel).getByText('Course ID is required')).toBeInTheDocument();

    await user.type(within(panel).getByLabelText('Course ID'), 'NEW-1');
    await user.type(within(panel).getByLabelText('Course Name'), 'Brand New');
    await user.click(within(panel).getByRole('button', { name: 'Add course' }));
    await waitFor(() => expect(log).toHaveLength(1));
    expect(log[0][1][0]).toEqual({
      course_id: 'NEW-1', course_name: 'Brand New', functional_area: 'Finance', duration_hrs: 0, application: '', priority: 1, project_id: 'p1'
    });
    expect(await screen.findByText('Brand New')).toBeInTheDocument();
  });

  test('a rejected insert (for example a duplicate ID) is shown in the panel', async () => {
    const user = userEvent.setup();
    await setup({ insertError: new Error('duplicate key value violates unique constraint') });
    await user.click(screen.getByRole('button', { name: /Add New Course/ }));
    const panel = await screen.findByRole('dialog');
    await user.type(within(panel).getByLabelText('Course ID'), 'FIN-101');
    await user.click(within(panel).getByRole('button', { name: 'Add course' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('duplicate key value');
  });

  test('deleting from the table asks first and mentions the assignments', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getAllByRole('button', { name: 'Delete course' })[1]);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/delete course HR-201\? Any individual course assignments/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Onboarding')).not.toBeInTheDocument());
    expect(log).toEqual([['delete', ['course_id', 'HR-201']]]);
  });

  test('the edit panel can delete too, and cancelling keeps the course', async () => {
    const user = userEvent.setup();
    const log = await setup();
    await user.click(screen.getByText('Stock Counts'));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Delete course' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel', hidden: false }));
    expect(log).toEqual([]);
    expect(screen.getByText('Stock Counts')).toBeInTheDocument();
  });
});

const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

describe('CoursesForm import and export', () => {
  const renderAt = async (path) => {
    useProject.mockReturnValue({ currentProject: { id: 'p1', name: 'acme', title: 'ACME Corp' } });
    installDatabase();
    render(<MemoryRouter initialEntries={[path]}><TooltipProvider><CoursesForm /></TooltipProvider></MemoryRouter>);
    await screen.findByText('Ledger Basics');
  };

  test('the Import button opens the courses importer', async () => {
    const user = userEvent.setup();
    await renderAt('/courses');
    await user.click(screen.getByRole('button', { name: /Import/ }));
    expect(await screen.findByRole('heading', { name: 'Import courses' })).toBeInTheDocument();
  });

  test('the old /import-export-courses link opens the importer straight away', async () => {
    await renderAt('/courses?import=courses');
    expect(await screen.findByRole('heading', { name: 'Import courses' })).toBeInTheDocument();
  });

  test('Export downloads the courses currently shown', async () => {
    const user = userEvent.setup();
    await renderAt('/courses');
    await user.type(screen.getByLabelText('Search courses'), 'stock');
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    expect(saveAs.mock.calls[0][1]).toBe('courses_export.csv');
    const text = await readBlob(saveAs.mock.calls[0][0]);
    expect(text.split(String.fromCharCode(13, 10))[0]).toBe('course_id,course_name,functional_area,duration_hrs,application,priority');
    expect(text).toContain('OPS-301');
    expect(text).not.toContain('FIN-101');
  });
});
