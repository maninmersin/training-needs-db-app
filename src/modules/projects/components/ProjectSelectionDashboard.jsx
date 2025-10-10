import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import CreateProjectModal from './CreateProjectModal';
import EditProjectModal from './EditProjectModal';
import ProjectTable from './ProjectTable';
import './ProjectSelectionDashboard.css';

const ProjectSelectionDashboard = ({ onProjectSelect }) => {
  const { 
    projects, 
    currentProject,
    isLoading, 
    error, 
    loadProjects, 
    createProject, 
    updateProject,
    deleteProject,
    switchProject,
    hasPermission,
    clearError 
  } = useProject();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');

  useEffect(() => {
    loadProjects();
  }, []);

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'created_at':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'updated_at':
        default:
          return new Date(b.updated_at) - new Date(a.updated_at);
      }
    });

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await createProject(projectData);
      setShowCreateModal(false);
      
      // Auto-select the new project 
      await switchProject(newProject.id);
      
      // Also call the callback if provided (for backward compatibility)
      if (onProjectSelect) {
        onProjectSelect(newProject);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      // Error handling is managed by ProjectContext
    }
  };

  const handleSelectProject = async (project) => {
    try {
      await switchProject(project.id);
      
      // Also call the callback if provided (for backward compatibility)
      if (onProjectSelect) {
        onProjectSelect(project);
      }
    } catch (err) {
      console.error('Failed to switch project:', err);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowEditModal(true);
  };

  const handleUpdateProject = async (projectId, updatedData) => {
    console.log('🔍 ProjectSelectionDashboard: handleUpdateProject called');
    console.log('🔍 Project ID:', projectId);
    console.log('🔍 Updated Data:', updatedData);
    console.log('🔍 updateProject function:', updateProject);
    
    try {
      console.log('🔄 Calling updateProject...');
      const result = await updateProject(projectId, updatedData);
      console.log('✅ updateProject completed successfully:', result);
      setShowEditModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error('❌ Failed to update project:', err);
      // Error handling is managed by ProjectContext
    }
  };

  if (isLoading) {
    return (
      <div className="project-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="project-selection-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-text">
            <h1>Project Management</h1>
            <p>Create and manage your projects. Use the project switcher on the home page to select a project to work on.</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Project
          </button>
        </div>
        
        {error && (
          <div className="error-banner">
            <div className="error-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>{error}</span>
              <button onClick={clearError} className="btn-link">Dismiss</button>
            </div>
          </div>
        )}
      </header>

      <div className="dashboard-filters">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sort-container">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="updated_at">Last Updated</option>
            <option value="created_at">Date Created</option>
            <option value="name">Name</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>

      <div className="projects-container">
        {filteredProjects.length === 0 && projects.length === 0 ? (
          <div className="no-projects">
            <div className="no-projects-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M9 9h6v6h-6z"/>
              </svg>
            </div>
            <h3>No Projects Yet</h3>
            <p>Get started by creating your first project. Projects help organize your training needs, impact assessments, and other work.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <>
            <ProjectTable
              projects={filteredProjects}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
              onSelect={handleSelectProject}
              currentProject={currentProject}
            />
            
            {filteredProjects.length === 0 && projects.length > 0 && (
              <div className="no-results">
                <div className="no-results-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <h3>No Projects Found</h3>
                <p>No projects match your search criteria.</p>
                <button 
                  className="btn btn-link"
                  onClick={() => setSearchTerm('')}
                >
                  Clear Search
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {showEditModal && (
        <EditProjectModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingProject(null);
          }}
          onSubmit={handleUpdateProject}
          project={editingProject}
        />
      )}
    </div>
  );
};

export default ProjectSelectionDashboard;