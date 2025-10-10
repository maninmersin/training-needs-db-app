import React, { useState } from 'react';
import { format } from 'date-fns';

const ProjectTable = ({ 
  projects, 
  onEdit, 
  onDelete,
  onSelect,
  currentProject
}) => {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);


  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'on_hold': return '#f59e0b';
      case 'completed': return '#6366f1';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'on_hold': return 'On Hold';
      case 'completed': return 'Completed';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const handleDeleteClick = (project, e) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmText === 'DELETE' && projectToDelete) {
      onDelete(projectToDelete.id);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setProjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    setProjectToDelete(null);
  };

  const canDelete = (project) => {
    return project.user_role === 'admin' || project.user_role === 'owner';
  };

  const canEdit = (project) => {
    return project.user_role === 'owner' || project.user_role === 'admin' || project.user_role === 'member';
  };

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <h3>📁 No Projects Found</h3>
          <p>No projects match your current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="project-table">
        <div className="table-header">
          <div className="header-row">
            <div className="header-cell name-cell">Project Name</div>
            <div className="header-cell id-cell">Project ID</div>
            <div className="header-cell status-cell">Status</div>
            <div className="header-cell actions-cell">Actions</div>
          </div>
        </div>

        <div className="table-body">
          {projects.map(project => {
            return (
              <div 
                key={project.id} 
                className="table-row"
                onClick={() => onSelect(project)}
              >
                <div className="table-cell name-cell">
                  <div className="project-info">
                    <div className="project-title">{project.title}</div>
                    <div className="project-name">@{project.name}</div>
                    {project.description && (
                      <div className="project-description">{project.description}</div>
                    )}
                  </div>
                </div>
                
                <div className="table-cell id-cell">
                  <code className="project-id">{project.id}</code>
                </div>
                
                <div className="table-cell status-cell">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(project.status) }}
                  >
                    {getStatusLabel(project.status)}
                  </span>
                </div>
                
                <div className="table-cell actions-cell" onClick={e => e.stopPropagation()}>
                  {canEdit(project) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(project);
                      }}
                      className="action-btn edit-btn"
                      title="Edit Project"
                      style={{ backgroundColor: '#f8f9fa', border: '1px solid #007bff', padding: '4px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                  
                  {canDelete(project) && (
                    <button
                      onClick={(e) => {
                        handleDeleteClick(project, e);
                      }}
                      className="action-btn delete-btn"
                      title="Delete Project"
                      style={{ backgroundColor: '#f8f9fa', border: '1px solid #dc3545', padding: '4px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="table-footer">
        <div className="table-stats">
          Showing {projects.length} project(s)
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            
            <h4>Delete Project</h4>
            <p>Are you sure you want to delete "{projectToDelete?.title}"?</p>
            <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '16px' }}>
              ⚠️ This will permanently delete ALL associated data including:
            </p>
            <ul style={{ textAlign: 'left', margin: '0 0 16px 0', color: '#dc2626' }}>
              <li>Training schedules and sessions</li>
              <li>Courses and assignments</li>
              <li>User data and roles</li>
              <li>All project settings</li>
            </ul>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Type "DELETE" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '2px solid #dc2626',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
            
            <div className="delete-confirm-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE'}
                style={{
                  opacity: deleteConfirmText !== 'DELETE' ? 0.5 : 1,
                  cursor: deleteConfirmText !== 'DELETE' ? 'not-allowed' : 'pointer'
                }}
              >
                Delete Project Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectTable;