/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../ui/data-table';
import { FileDrop, ImportStepper } from '../ui/import-flow';

// react-table updates its state in a microtask, outside RTL's act(); that only prints a warning (the
// assertions still see the final DOM). Hide just that message so real errors stay visible.
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const PEOPLE = [
  { id: 1, name: 'Carol', courses: 5 },
  { id: 2, name: 'Alice', courses: 2 },
  { id: 3, name: 'Bob', courses: 9 }
];
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'courses', header: 'Courses', meta: { align: 'right' } }
];
const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).queryAllByRole('cell')[0]?.textContent).filter(Boolean);

describe('DataTable', () => {
  test('shows rows and the count', () => {
    render(<DataTable columns={columns} data={PEOPLE} getRowId={(r) => String(r.id)} />);
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-3 of 3')).toBeInTheDocument();
  });

  test('clicking a header sorts ascending, then descending, and marks it for screen readers', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={PEOPLE} getRowId={(r) => String(r.id)} />);
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Alice', 'Bob', 'Carol']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Carol', 'Bob', 'Alice']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'descending');
  });

  test('the search text filters rows and the count follows', () => {
    render(<DataTable columns={columns} data={PEOPLE} getRowId={(r) => String(r.id)} globalFilter="ali" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 of 1')).toBeInTheDocument();
  });

  test('shows the empty state when nothing matches', () => {
    render(<DataTable columns={columns} data={PEOPLE} globalFilter="zzz" emptyState={<p>No people found</p>} />);
    expect(screen.getByText('No people found')).toBeInTheDocument();
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });

  test('selecting rows reports them, and select-all selects the page', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    render(<DataTable columns={columns} data={PEOPLE} getRowId={(r) => String(r.id)} selectable onSelectionChange={onSelectionChange} />);
    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([PEOPLE[1]]);
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(PEOPLE);
  });

  test('pages through long lists', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Person ${String(i).padStart(2, '0')}`, courses: i }));
    render(<DataTable columns={columns} data={many} getRowId={(r) => String(r.id)} pageSize={25} />);
    expect(screen.getByText('Showing 1-25 of 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 26-30 of 30')).toBeInTheDocument();
    expect(screen.getByText('Person 29')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  test('clicking a row calls onRowClick', async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    render(<DataTable columns={columns} data={PEOPLE} onRowClick={onRowClick} />);
    await user.click(screen.getByText('Bob'));
    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[2]);
  });
});

describe('ImportStepper and FileDrop', () => {
  test('stepper marks the active step', () => {
    render(<ImportStepper current={1} />);
    expect(screen.getByText('Check').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Apply').closest('li')).not.toHaveAttribute('aria-current');
  });

  test('FileDrop passes the chosen file on', async () => {
    const user = userEvent.setup();
    const onFile = jest.fn();
    render(<FileDrop onFile={onFile} label="Review file" />);
    const file = new File(['x'], 'a.xlsx');
    await user.upload(screen.getByLabelText('Review file'), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
