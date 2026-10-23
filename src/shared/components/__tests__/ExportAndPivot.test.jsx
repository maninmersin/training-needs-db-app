/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import ExportAllData from '../ExportAllData';
import PivotReport from '../PivotReport';
import { useProject } from '@core/contexts/ProjectContext';
import { loadUserCourseEntries } from '../userCourses/userCourseService';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../userCourses/userCourseService', () => ({ loadUserCourseEntries: jest.fn() }));
// The real pivot table needs a browser layout engine; this stand-in shows what it was given
jest.mock('react-pivottable/PivotTableUI', () => ({
  __esModule: true,
  default: ({ data, onChange, hiddenAttributes, aggregatorName, vals }) => (
    <div data-testid="pivot">
      <span data-testid="pivot-rows">{data.length}</span>
      <span data-testid="pivot-hidden">{hiddenAttributes.join(',')}</span>
      <span data-testid="pivot-aggregator">{aggregatorName}:{vals.join(',')}</span>
      <span data-testid="pivot-sources">{[...new Set(data.map((row) => row.course_source))].join(',')}</span>
      <button onClick={() => onChange({ rows: ['division', 'course_name'], cols: ['training_location'] })}>choose fields</button>
    </div>
  )
}));
jest.mock('react-pivottable/pivottable.css', () => ({}), { virtual: true });

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const PROJECT = { id: 'p1', name: 'acme', title: 'ACME Corp' };
const entry = (userOver, courseOver, source = 'Role') => ({
  user: { id: 1, name: 'Amelia Brown', email: 'amelia@x.com', job_title: 'Analyst', country: 'UK', division: 'Finance', sub_division: 'AP', location_name: 'HQ', training_location: 'London', project_role: 'Buyer', ...userOver },
  course: { course_id: 'C1', course_name: 'Ledger Basics', functional_area: 'Finance', duration_hrs: 3, ...courseOver },
  source
});
const ENTRIES = [
  entry({}, {}),
  entry({}, { course_id: 'C2', course_name: 'Stock "Counts", advanced' }, 'Individual'),
  entry({ id: 2, name: 'Oliver Patel', email: null, training_location: 'Leeds' }, {})
];

const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

beforeEach(() => {
  jest.clearAllMocks();
  useProject.mockReturnValue({ currentProject: PROJECT });
  loadUserCourseEntries.mockResolvedValue(ENTRIES);
});

describe('ExportAllData', () => {
  const setup = async () => {
    const user = userEvent.setup();
    render(<ExportAllData />);
    await screen.findByText('Oliver Patel');
    return user;
  };

  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    render(<ExportAllData />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('lists every person with each course, saying whether it came from the role or was assigned individually', async () => {
    await setup();
    expect(loadUserCourseEntries).toHaveBeenCalledWith({}, 'p1');
    expect(screen.getByRole('heading', { name: 'Export User Course Assignments' })).toBeInTheDocument();
    expect(screen.getAllByText('Amelia Brown')).toHaveLength(2);
    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getAllByText('Role')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Export \(3 assignments\)/ })).toBeInTheDocument();
  });

  test('searching narrows what is shown, and the export follows it', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Search assignments'), 'leeds');
    expect(screen.queryByText('Amelia Brown')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export \(1 assignments\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    const text = await readBlob(saveAs.mock.calls[0][0]);
    expect(text.split('\r\n')).toHaveLength(2);
    expect(text).toContain('Oliver Patel');
  });

  test('the CSV has the old columns plus the source, and quotes and empty values are written correctly', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    expect(saveAs.mock.calls[0][1]).toMatch(/^acme_user_course_assignments_\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await readBlob(saveAs.mock.calls[0][0])).split('\r\n');
    expect(lines[0]).toBe('user_id,user_name,user_email,job_title,country,division,sub_division,location_name,training_location,project_role,course_id,course_name,functional_area,duration_hrs,course_source');
    expect(lines[2]).toContain('"Stock ""Counts"", advanced"');
    expect(lines[2].endsWith(',Individual')).toBe(true);
    expect(lines[3]).toContain('2,Oliver Patel,,Analyst'); // a missing email is empty, not the word null
    expect(lines.join('')).not.toContain('null');
  });

  test('Excel export gives an .xlsx file', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Excel (.xlsx)' }));
    expect(saveAs.mock.calls[0][1]).toMatch(/\.xlsx$/);
  });

  test('with nothing to export the button is disabled and the empty state says what to do', async () => {
    loadUserCourseEntries.mockResolvedValue([]);
    render(<ExportAllData />);
    expect(await screen.findByText('No assignments yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled();
  });

  test('a failed load shows the reason', async () => {
    loadUserCourseEntries.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ExportAllData />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Error: boom');
  });
});

describe('PivotReport', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    render(<PivotReport />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('builds the pivot from the same table, counting people, hiding technical fields, and offering the course source', async () => {
    render(<PivotReport />);
    expect(await screen.findByTestId('pivot')).toBeInTheDocument();
    expect(screen.getByTestId('pivot-rows')).toHaveTextContent('3');
    expect(screen.getByTestId('pivot-aggregator')).toHaveTextContent('Count:id');
    expect(screen.getByTestId('pivot-hidden')).toHaveTextContent('project_id,unique_key,created_at,updated_at');
    expect(screen.getByTestId('pivot-sources')).toHaveTextContent('Role,Individual');
    expect(screen.getByText('Training Needs Pivot Report')).toBeInTheDocument();
  });

  test('shows what it is grouped by once fields are chosen', async () => {
    const user = userEvent.setup();
    render(<PivotReport />);
    expect((await screen.findByText(/Grouping By:/)).parentElement).toHaveTextContent('Grouping By: None');
    await user.click(screen.getByRole('button', { name: 'choose fields' }));
    expect(screen.getByText(/Grouping By:/).parentElement).toHaveTextContent('Grouping By: division → course_name → training_location');
  });

  test('with no data it says so instead of showing an empty pivot', async () => {
    loadUserCourseEntries.mockResolvedValue([]);
    render(<PivotReport />);
    expect(await screen.findByText('No Training Data Available')).toBeInTheDocument();
    expect(screen.queryByTestId('pivot')).not.toBeInTheDocument();
  });

  test('a failed load shows the reason', async () => {
    loadUserCourseEntries.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<PivotReport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Error Loading Report: boom');
    expect(screen.queryByTestId('pivot')).not.toBeInTheDocument();
  });
});
