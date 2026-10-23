import React, { useEffect, useState } from 'react';
import { FolderPlus, Loader2, Plus, Search, X } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import {
  Button, EmptyState, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast, Toolbar
} from '@/components/ui';
import CreateProjectModal from './CreateProjectModal';
import EditProjectModal from './EditProjectModal';
import ProjectTable from './ProjectTable';

const SORTS = {
  updated_at: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
  created_at: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  name: (a, b) => a.name.localeCompare(b.name),
  title: (a, b) => a.title.localeCompare(b.title)
};

const matches = (project, term) => {
  const needle = term.toLowerCase();
  return (
    project.name.toLowerCase().includes(needle) ||
    project.title.toLowerCase().includes(needle) ||
    Boolean(project.description && project.description.toLowerCase().includes(needle))
  );
};

const ProjectSelectionDashboard = ({ onProjectSelect }) => {
  const { projects, currentProject, isLoading, error, loadProjects, createProject, updateProject, deleteProject, switchProject, clearError } = useProject();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProjects = projects.filter((project) => matches(project, searchTerm)).sort(SORTS[sortBy]);

  const handleCreateProject = async (projectData) => {
    const newProject = await createProject(projectData);
    toast.success('Project created', { description: newProject.title });
    // Auto-select the new project
    await switchProject(newProject.id);
    if (onProjectSelect) onProjectSelect(newProject);
  };

  const handleSelectProject = async (project) => {
    try {
      await switchProject(project.id);
      if (onProjectSelect) onProjectSelect(project);
    } catch (err) {
      console.error('Failed to switch project:', err);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
      toast.success('Project deleted');
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleUpdateProject = async (projectId, updatedData) => {
    await updateProject(projectId, updatedData);
    toast.success('Project updated');
  };

  if (isLoading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading projects...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Project Management"
        description="Create and manage your projects. Click a project to work on it."
        actions={
          <Button variant="default" onClick={() => setShowCreateModal(true)}>
            <Plus /> New Project
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={FolderPlus}
            title="No Projects Yet"
            description="Get started by creating your first project. Projects help organize your training needs, impact assessments, and other work."
            action={<Button variant="default" onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>}
          />
        </div>
      ) : (
        <>
          <Toolbar>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search projects"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground" id="sort-label">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger aria-labelledby="sort-label" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at">Last Updated</SelectItem>
                  <SelectItem value="created_at">Date Created</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Toolbar>

          <ProjectTable
            projects={filteredProjects}
            onEdit={setEditingProject}
            onDelete={handleDeleteProject}
            onSelect={handleSelectProject}
            currentProject={currentProject}
          />

          {filteredProjects.length === 0 && searchTerm && (
            <div>
              <Button variant="link" onClick={() => setSearchTerm('')}>
                <X /> Clear Search
              </Button>
            </div>
          )}
        </>
      )}

      <CreateProjectModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateProject} />
      <EditProjectModal isOpen={Boolean(editingProject)} onClose={() => setEditingProject(null)} onSubmit={handleUpdateProject} project={editingProject} />
    </div>
  );
};

export default ProjectSelectionDashboard;
