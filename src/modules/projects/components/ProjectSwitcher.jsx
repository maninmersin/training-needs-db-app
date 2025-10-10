import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import './ProjectSwitcher.css';

const ProjectSwitcher = () => {
  const {
    currentProject,
    projects,
    switchProject,
    isLoading,
    error
  } = useProject();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle project selection
  const handleProjectSelect = async (project) => {
    if (project.id !== currentProject?.id) {
      try {
        await switchProject(project.id);
      } catch (err) {
        console.error('Failed to switch project:', err);
      }
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="project-switcher project-switcher-loading">
        <div className="loading-spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-switcher project-switcher-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Error loading projects</span>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="project-switcher project-switcher-none">
        <span>No Project Selected</span>
      </div>
    );
  }

  return (
    <div className="project-switcher" ref={dropdownRef}>
      <button
        className="project-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="current-project-info">
          <div className="project-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M9 9h6v6h-6z"/>
            </svg>
          </div>
          <div className="project-details">
            <div className="project-name">{currentProject.name}</div>
            <div className="project-title">{currentProject.title}</div>
          </div>
        </div>
        
        <div className="dropdown-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="project-switcher-dropdown">
          <div className="dropdown-header">
            <div className="search-container">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="projects-list" role="listbox">
            {filteredProjects.length === 0 ? (
              <div className="no-projects">
                {searchTerm ? 'No projects match your search' : 'No projects available'}
              </div>
            ) : (
              filteredProjects.map(project => (
                <button
                  key={project.id}
                  className={`project-option ${project.id === currentProject.id ? 'active' : ''}`}
                  onClick={() => handleProjectSelect(project)}
                  role="option"
                  aria-selected={project.id === currentProject.id}
                >
                  <div className="project-option-title">
                    {project.title}
                  </div>
                </button>
              ))
            )}
          </div>

          {projects.length > 0 && (
            <div className="dropdown-footer">
              <div className="project-count">
                {filteredProjects.length} of {projects.length} projects
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSwitcher;