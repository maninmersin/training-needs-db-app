/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import ImportExportTrainingData from '../ImportExportTrainingData';
import { useProject } from '@core/contexts/ProjectContext';
import { loadAllTrainingData, loadCurrentStats, replaceTrainingData } from '../../import/accessImportService';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@core/contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('@core/services/supabaseClient', () => ({ supabase: {} }));
jest.mock('../../import/accessImportService', () => ({
  loadCurrentStats: jest.fn(),
  replaceTrainingData: jest.fn(),
  loadAllTrainingData: jest.fn()
}));

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const HEADER = 'ID,functional_area,sub_functional_area,est_duration_hrs,emp_id,name,email,training_location';
const csv = (...lines) => new File([[HEADER, ...lines].join('\n')], 'access_export.csv', { type: 'text/csv' });
const GOOD = ['24,Finance,Ledger Basics,3,1001,Amelia Brown,a@x.com,London', '25,HR,Onboarding,1.5,1002,Oliver Patel,o@x.com,Leeds'];
const STATS = { total_assignments: 120, unique_users: 40, unique_courses: 6, unique_locations: 2, unique_functional_areas: 3 };

const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

const setup = async () => {
  useProject.mockReturnValue({ currentProject: { id: 'p1', title: 'Access Project' } });
  loadCurrentStats.mockResolvedValue(STATS);
  replaceTrainingData.mockResolvedValue({ inserted: 2, removed: 120 });
  loadAllTrainingData.mockResolvedValue([{ user_id: '1', user_name: 'Amelia', training_location: 'London', course_id: '24' }]);
  const user = userEvent.setup();
  render(<ImportExportTrainingData />);
  await screen.findByText('Total Assignments');
  return user;
};

const upload = (user, file) => user.upload(screen.getByLabelText('Choose a file'), file);

beforeEach(() => jest.clearAllMocks());

describe('ImportExportTrainingData', () => {
  test('without a project it explains what to do', () => {
    useProject.mockReturnValue({ currentProject: null });
    render(<ImportExportTrainingData />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  test('shows what the project has now', async () => {
    await setup();
    expect(screen.getByText('Total Assignments').previousSibling).toHaveTextContent('120');
    expect(screen.getByText('Unique Users').previousSibling).toHaveTextContent('40');
    expect(loadCurrentStats).toHaveBeenCalledWith({}, 'p1');
  });

  test('a good file is checked first: it shows what it holds against what is there, and nothing is changed yet', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD));
    expect(await screen.findByText('access_export.csv')).toBeInTheDocument();
    expect(screen.getByText('2 rows read')).toBeInTheDocument();
    expect(screen.getByText('Rows to import').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('People').previousSibling).toHaveTextContent('2');
    expect(screen.getByText(/This will replace the/)).toHaveTextContent('This will replace the 120 records now in this project with 2 records from the file.');
    expect(replaceTrainingData).not.toHaveBeenCalled();
  });

  test('the import stays disabled until the replacement is confirmed', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD));
    const apply = await screen.findByRole('button', { name: 'Import CSV (Replace All)' });
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /I understand this replaces all 120 existing records/ }));
    expect(apply).toBeEnabled();
  });

  test('applying replaces the data with the rows mapped for this project, shows the result and refreshes the numbers', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD));
    await user.click(await screen.findByRole('checkbox', { name: /I understand/ }));
    loadCurrentStats.mockResolvedValue({ ...STATS, total_assignments: 2 });
    await user.click(screen.getByRole('button', { name: 'Import CSV (Replace All)' }));
    await waitFor(() => expect(replaceTrainingData).toHaveBeenCalledTimes(1));
    const [, projectId, rows] = replaceTrainingData.mock.calls[0];
    expect(projectId).toBe('p1');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ project_id: 'p1', user_id: '1001', user_name: 'Amelia Brown', course_id: '24', course_name: 'Ledger Basics', duration_hrs: 3, functional_area: 'Finance', training_location: 'London' });
    expect(await screen.findByText('Import complete: 2 records imported.')).toBeInTheDocument();
    expect(screen.getByText(/The previous 120 records for this project were replaced\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Total Assignments').previousSibling).toHaveTextContent('2'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByLabelText('Choose a file')).toBeInTheDocument();
  });

  test('rows with problems are listed and block the import until they are left out on purpose', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD, '26,Finance,Broken,abc,1003,Bad Row,b@x.com,London'));
    expect(await screen.findByText('Invalid est_duration_hrs: abc')).toBeInTheDocument();
    expect(screen.getByText('Rows with problems', { selector: 'div' }).previousSibling).toHaveTextContent('1');
    await user.click(screen.getByRole('checkbox', { name: /I understand/ }));
    expect(screen.getByRole('button', { name: 'Import CSV (Replace All)' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Leave out the rows with problems/ }));
    expect(screen.getByRole('button', { name: 'Import CSV (Replace All)' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Import CSV (Replace All)' }));
    await waitFor(() => expect(replaceTrainingData).toHaveBeenCalled());
    expect(replaceTrainingData.mock.calls[0][2]).toHaveLength(2);
    expect(await screen.findByText(/1 row with problems was left out\./)).toBeInTheDocument();
  });

  test('Download problems saves a CSV of the rows that need fixing', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD, ',Finance,No Id,3,1003,Bad Row,b@x.com,London'));
    await user.click(await screen.findByRole('button', { name: /Download problems/ }));
    expect(saveAs.mock.calls[0][1]).toBe('training_data_import_problems.csv');
    const text = await readBlob(saveAs.mock.calls[0][0]);
    expect(text).toContain('Row,Name,Problem');
    expect(text).toContain('Bad Row');
  });

  test('a file missing required columns is refused with the reason, and cannot be applied', async () => {
    const user = await setup();
    await upload(user, new File(['emp_id,name,training_location\n1,A,London'], 'wrong.csv'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Missing required columns: ID, functional_area, sub_functional_area, est_duration_hrs');
    expect(screen.queryByRole('button', { name: 'Import CSV (Replace All)' })).not.toBeInTheDocument();
  });

  test('a file with no usable rows says there is nothing to import', async () => {
    const user = await setup();
    await upload(user, csv('26,Finance,Broken,abc,1003,Bad Row,b@x.com,London'));
    expect(await screen.findByText(/no usable rows in this file/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Leave out the rows/ }));
    expect(screen.getByRole('button', { name: 'Import CSV (Replace All)' })).toBeDisabled();
  });

  test('Cancel goes back to choosing a file without changing anything', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Choose a file')).toBeInTheDocument();
    expect(replaceTrainingData).not.toHaveBeenCalled();
  });

  test('if the import fails the reason is shown, the file stays, and the numbers are re-read', async () => {
    const user = await setup();
    replaceTrainingData.mockRejectedValue(new Error('The import stopped at batch 2: insert refused. Your existing data was kept.'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await upload(user, csv(...GOOD));
    await user.click(await screen.findByRole('checkbox', { name: /I understand/ }));
    loadCurrentStats.mockClear();
    await user.click(screen.getByRole('button', { name: 'Import CSV (Replace All)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your existing data was kept.');
    expect(screen.getByText('access_export.csv')).toBeInTheDocument();
    expect(loadCurrentStats).toHaveBeenCalled();
  });
});

describe('ImportExportTrainingData export', () => {
  const choose = async (user, name) => {
    await user.click(screen.getByRole('button', { name: /Export All Training Data/ }));
    await user.click(await screen.findByRole('menuitem', { name }));
  };

  test('Export downloads every training data row as CSV, with the same columns as before', async () => {
    const user = await setup();
    await choose(user, 'CSV');
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(loadAllTrainingData).toHaveBeenCalledWith({}, 'p1');
    expect(saveAs.mock.calls[0][1]).toBe('training_data_export.csv');
    const lines = (await readBlob(saveAs.mock.calls[0][0])).split('\r\n');
    expect(lines[0]).toBe('user_id,user_name,user_email,business_unit,organization,user_country,user_department,user_job_title,user_location,training_location,user_project_role,course_id,course_name,duration_hrs,course_topic,course_sub_topic,course_application,course_priority,functional_area,sub_functional_area,functional_area_short,assigned_by,assigned_date,assignment_notes');
    expect(lines[1].startsWith('1,Amelia,,')).toBe(true);
  });

  test('Excel export gives an .xlsx file', async () => {
    const user = await setup();
    await choose(user, 'Excel (.xlsx)');
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toBe('training_data_export.xlsx');
  });

  test('with no data there is nothing to download', async () => {
    const user = await setup();
    loadAllTrainingData.mockResolvedValue([]);
    await choose(user, 'CSV');
    await waitFor(() => expect(loadAllTrainingData).toHaveBeenCalled());
    expect(saveAs).not.toHaveBeenCalled();
  });

  test('a backup of the current data can be downloaded before importing', async () => {
    const user = await setup();
    await upload(user, csv(...GOOD));
    await user.click(await screen.findByRole('button', { name: /Download a backup of the current data/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toBe('training_data_backup_before_import.csv');
    expect(replaceTrainingData).not.toHaveBeenCalled();
  });

  test('a failed export shows a message', async () => {
    const user = await setup();
    loadAllTrainingData.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await choose(user, 'CSV');
    expect(await screen.findByRole('alert')).toHaveTextContent('Export error: boom');
  });
});
