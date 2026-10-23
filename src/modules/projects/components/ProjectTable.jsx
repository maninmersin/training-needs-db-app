import React, { useMemo, useState } from 'react';
import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, DataTable, EmptyState, Input, Label, Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui';

const STATUS = {
  active: { label: 'Active', variant: 'success' },
  on_hold: { label: 'On Hold', variant: 'warning' },
  completed: { label: 'Completed', variant: 'primary' },
  archived: { label: 'Archived', variant: 'neutral' }
};

const canDelete = (project) => project.user_role === 'admin' || project.user_role === 'owner';
const canEdit = (project) => ['owner', 'admin', 'member'].includes(project.user_role);

function RowAction({ label, onClick, children, destructive = false }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={destructive ? 'destructive' : 'ghost'} size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const ProjectTable = ({ projects, onEdit, onDelete, onSelect, currentProject }) => {
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const columns = useMemo(
    () => [
      {
        id: 'project',
        header: 'Project Name',
        accessorFn: (project) => project.title,
        meta: { className: 'min-w-72 whitespace-normal py-1.5' },
        cell: ({ row }) => {
          const project = row.original;
          return (
            <div className="flex flex-col leading-tight">
              <span className="flex items-center gap-2 font-medium">
                {project.title}
                {project.id === currentProject?.id && <Badge variant="primary">Current</Badge>}
              </span>
              <span className="text-xs text-subtle-foreground">@{project.name}</span>
              {project.description && <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{project.description}</span>}
            </div>
          );
        }
      },
      {
        accessorKey: 'id',
        header: 'Project ID',
        meta: { className: 'font-mono text-xs text-subtle-foreground' }
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = STATUS[getValue()] || { label: getValue(), variant: 'neutral' };
          return <Badge variant={status.variant}>{status.label}</Badge>;
        }
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const project = row.original;
          return (
            <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              {canEdit(project) && (
                <RowAction label="Edit Project" onClick={() => onEdit(project)}>
                  <Pencil />
                </RowAction>
              )}
              {canDelete(project) && (
                <RowAction label="Delete Project" destructive onClick={() => setProjectToDelete(project)}>
                  <Trash2 />
                </RowAction>
              )}
            </div>
          );
        }
      }
    ],
    [currentProject?.id, onEdit]
  );

  const closeDelete = () => {
    setProjectToDelete(null);
    setConfirmText('');
  };

  const confirmDelete = () => {
    if (confirmText !== 'DELETE' || !projectToDelete) return;
    onDelete(projectToDelete.id);
    closeDelete();
  };

  return (
    <>
      <DataTable
        caption="Projects"
        columns={columns}
        data={projects}
        getRowId={(project) => project.id}
        onRowClick={onSelect}
        emptyState={<EmptyState icon={FolderOpen} title="No Projects Found" description="No projects match your current filters." />}
      />

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3">
              <p>Are you sure you want to delete "{projectToDelete?.title}"?</p>
              <p className="font-semibold text-destructive">This will permanently delete ALL associated data including:</p>
              <ul className="list-disc pl-5 text-destructive">
                <li>Training schedules and sessions</li>
                <li>Courses and assignments</li>
                <li>User data and roles</li>
                <li>All project settings</li>
              </ul>
              <div className="flex flex-col gap-1">
                <Label htmlFor="delete-confirm">Type "DELETE" to confirm:</Label>
                <Input
                  id="delete-confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive disabled={confirmText !== 'DELETE'} onClick={confirmDelete}>
              Delete Project Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectTable;
