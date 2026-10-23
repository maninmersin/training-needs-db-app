/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { validateProject, EMPTY_PROJECT_FORM } from '../projectValidation';
import ProjectTable from '../ProjectTable';
import CreateProjectModal from '../CreateProjectModal';
import EditProjectModal from '../EditProjectModal';
import { TooltipProvider } from '@/components/ui';

// react-table updates its state in a microtask, outside RTL's act(); hide just that warning.
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const form = (over = {}) => ({ ...EMPTY_PROJECT_FORM, name: 'acme-training', title: 'ACME Training', ...over });

describe('validateProject', () => {
  test('a good project has no errors', () => {
    expect(validateProject(form())).toEqual({});
  });

  test('name and title are required and length-checked', () => {
    expect(validateProject(form({ name: ' ' })).name).toBe('Project name is required');
    expect(validateProject(form({ name: 'ab' })).name).toBe('Project name must be at least 3 characters');
    expect(validateProject(form({ name: 'x'.repeat(51) })).name).toBe('Project name must be less than 50 characters');
    expect(validateProject(form({ title: '' })).title).toBe('Project title is required');
    expect(validateProject(form({ title: 'abcd' })).title).toBe('Project title must be at least 5 characters');
    expect(validateProject(form({ title: 'x'.repeat(101) })).title).toBe('Project title must be less than 100 characters');
  });

  test('code is optional but length-checked; end date must follow start date', () => {
    expect(validateProject(form({ project_code: '' }))).toEqual({});
    expect(validateProject(form({ project_code: 'A' })).project_code).toBe('Project code must be between 2-20 characters');
    expect(validateProject(form({ start_date: '2026-10-12', target_end_date: '2026-10-12' })).target_end_date).toBe('End date must be after start date');
    expect(validateProject(form({ start_date: '2026-10-12', target_end_date: '2026-11-01' }))).toEqual({});
    expect(validateProject(form({ start_date: '2026-10-12' }))).toEqual({});
  });
});

describe('project dialogs', () => {
  test('Create shows validation messages and does not submit an invalid form', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<CreateProjectModal isOpen onClose={jest.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(screen.getByText('Project name is required')).toBeInTheDocument();
    expect(screen.getByText('Project title is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('Create submits the entered values and closes', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue();
    const onClose = jest.fn();
    render(<CreateProjectModal isOpen onClose={onClose} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Project Name *'), 'acme-training');
    await user.type(screen.getByLabelText('Project Title *'), 'ACME Training');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'acme-training', title: 'ACME Training' }));
  });

  test('a failing save stays open and shows the reason', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error('Name already taken'));
    const onClose = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreateProjectModal isOpen onClose={onClose} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Project Name *'), 'acme-training');
    await user.type(screen.getByLabelText('Project Title *'), 'ACME Training');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name already taken');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('Edit is filled from the project and submits with the project id', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue();
    const project = { id: 'p1', name: 'acme', title: 'ACME Corp', description: 'Desc', training_data_source: 'app' };
    render(<EditProjectModal isOpen onClose={jest.fn()} onSubmit={onSubmit} project={project} />);
    expect(screen.getByLabelText('Project Title *')).toHaveValue('ACME Corp');
    expect(screen.getByLabelText('Description')).toHaveValue('Desc');
    expect(screen.getByRole('combobox', { name: 'Training Data Source' })).toHaveTextContent('Managed in app');
    await user.click(screen.getByRole('button', { name: 'Update Project' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'ACME Corp', training_data_source: 'app' })));
  });
});

describe('ProjectTable', () => {
  const projects = [
    { id: 'p1', name: 'acme', title: 'ACME Corp', description: 'Main project', status: 'active', user_role: 'admin' },
    { id: 'p2', name: 'beta', title: 'Beta Rollout', status: 'on_hold', user_role: 'viewer' }
  ];
  const setup = (over = {}) => {
    const props = { projects, onEdit: jest.fn(), onDelete: jest.fn(), onSelect: jest.fn(), currentProject: projects[0], ...over };
    render(<TooltipProvider><ProjectTable {...props} /></TooltipProvider>);
    return props;
  };

  test('lists projects with status and marks the current one', () => {
    setup();
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    expect(screen.getByText('@beta')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('On Hold')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  test('clicking a row selects it; the action buttons do not', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('Beta Rollout'));
    expect(props.onSelect).toHaveBeenCalledWith(projects[1]);
    await user.click(screen.getByRole('button', { name: 'Edit Project' }));
    expect(props.onEdit).toHaveBeenCalledWith(projects[0]);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  test('only people with the right role see Edit and Delete', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Edit Project' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete Project' })).toHaveLength(1);
  });

  test('deleting needs DELETE typed first', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Delete Project' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete Project Forever' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type "DELETE"/), 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/Type "DELETE"/));
    await user.type(within(dialog).getByLabelText(/Type "DELETE"/), 'DELETE');
    await user.click(confirm);
    expect(props.onDelete).toHaveBeenCalledWith('p1');
  });

  test('cancelling the delete changes nothing', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Delete Project' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(props.onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
