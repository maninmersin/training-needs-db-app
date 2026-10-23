import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';

const projectName = (project) => project?.title || project?.name || 'Untitled project';

/** Shows the current project and lets the user switch to another one. */
export default function ProjectSwitcher({ collapsed, onNavigate }) {
  const { currentProject, projects, switchProject, isLoading } = useProject();
  const navigate = useNavigate();
  const name = currentProject ? projectName(currentProject) : isLoading ? 'Loading...' : 'No project selected';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Project: ${name}. Change project`}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-card px-2.5 text-left text-sm font-medium',
            'hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? (
            <FolderKanban className="size-4" aria-hidden="true" />
          ) : (
            <>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] font-medium leading-none text-subtle-foreground">Project</span>
                <span className="truncate leading-tight">{name}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch project</DropdownMenuLabel>
        {(projects || []).map((project) => (
          <DropdownMenuItem key={project.id} onSelect={() => switchProject(project.id)}>
            <Check className={cn('size-4', project.id === currentProject?.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
            <span className="truncate">{projectName(project)}</span>
          </DropdownMenuItem>
        ))}
        {(!projects || projects.length === 0) && <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet</div>}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            navigate('/projects');
            onNavigate?.();
          }}
        >
          <FolderKanban aria-hidden="true" /> Manage projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
