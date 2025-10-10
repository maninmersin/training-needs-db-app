import React, { useState } from 'react';
import './ProjectCard.css';

const ProjectCard = ({ project, onSelect, onDelete, onEdit, canDelete = false, canEdit = false, isSelected = false }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e) => {
    e.stopPropagation();
    if (deleteConfirmText === 'DELETE') {
      onDelete(project.id);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(project);
  };

  return (
    <div className={`project-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="project-card-header">
        <div className="project-info">
          <h3 className="project-title">{project.title}</h3>
          <p className="project-name">@{project.name}</p>
        </div>
        
        <div className="project-actions">
          <div 
            className="project-status"
            style={{ backgroundColor: getStatusColor(project.status) }}
          >
            {getStatusLabel(project.status)}
          </div>
          
          {canEdit && (
            <button 
              className="edit-btn"
              onClick={handleEditClick}
              title="Edit Project"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          
          {canDelete && (
            <button 
              className="delete-btn"
              onClick={handleDeleteClick}
              title="Delete Project"
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

      {project.description && (
        <p className="project-description">{project.description}</p>
      )}

      <div className="project-stats">
        <div className="stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{project.member_count || 0} members</span>
        </div>
        
        <div className="stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{project.schedule_count || 0} schedules</span>
        </div>

        <div className="stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <span>{project.course_count || 0} courses</span>
        </div>
      </div>

      <div className="project-footer">
        <div className="project-dates">
          <div className="date-info">
            <small>Created: {formatDate(project.created_at)}</small>
          </div>
          <div className="date-info">
            <small>Updated: {formatDate(project.updated_at)}</small>
          </div>
        </div>

        {project.project_code && (
          <div className="project-code">
            <small>{project.project_code}</small>
          </div>
        )}
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
            <p>Are you sure you want to delete "{project.title}"?</p>
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
    </div>
  );
};

export default ProjectCard;