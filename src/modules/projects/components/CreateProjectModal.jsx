import React, { useState } from 'react';
import './CreateProjectModal.css';

const CreateProjectModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    project_code: '',
    start_date: '',
    target_end_date: '',
    settings: {},
    branding: {}
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Project name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Project name must be less than 50 characters';
    }
    
    if (!formData.title.trim()) {
      newErrors.title = 'Project title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Project title must be at least 5 characters';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Project title must be less than 100 characters';
    }

    if (formData.project_code && (formData.project_code.length < 2 || formData.project_code.length > 20)) {
      newErrors.project_code = 'Project code must be between 2-20 characters';
    }

    if (formData.start_date && formData.target_end_date) {
      if (new Date(formData.start_date) >= new Date(formData.target_end_date)) {
        newErrors.target_end_date = 'End date must be after start date';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error creating project:', error);
      setErrors({ submit: error.message || 'Failed to create project' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      title: '',
      description: '',
      project_code: '',
      start_date: '',
      target_end_date: '',
      settings: {},
      branding: {}
    });
    setErrors({});
    setIsSubmitting(false);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-project-modal-overlay" onClick={handleBackdropClick}>
      <div className="create-project-modal">
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button 
            className="close-btn"
            onClick={handleClose}
            type="button"
            disabled={isSubmitting}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Project Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., acme-corp-training"
              className={errors.name ? 'error' : ''}
              disabled={isSubmitting}
              autoFocus
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
            <small>A unique identifier for this project (used in URLs and references)</small>
          </div>

          <div className="form-group">
            <label htmlFor="title">Project Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., ACME Corp Training Initiative"
              className={errors.title ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
            <small>A descriptive title for display purposes</small>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the purpose and scope of this project..."
              rows="3"
              disabled={isSubmitting}
            />
            <small>Optional description of the project's goals and scope</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="project_code">Project Code</label>
              <input
                type="text"
                id="project_code"
                name="project_code"
                value={formData.project_code}
                onChange={handleChange}
                placeholder="e.g., ACT-2025"
                className={errors.project_code ? 'error' : ''}
                disabled={isSubmitting}
              />
              {errors.project_code && <span className="error-text">{errors.project_code}</span>}
              <small>Optional code for tracking and reporting</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">Start Date</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <small>When does this project begin?</small>
            </div>

            <div className="form-group">
              <label htmlFor="target_end_date">Target End Date</label>
              <input
                type="date"
                id="target_end_date"
                name="target_end_date"
                value={formData.target_end_date}
                onChange={handleChange}
                className={errors.target_end_date ? 'error' : ''}
                disabled={isSubmitting}
              />
              {errors.target_end_date && <span className="error-text">{errors.target_end_date}</span>}
              <small>When do you plan to complete this project?</small>
            </div>
          </div>

          {errors.submit && (
            <div className="error-banner">
              <div className="error-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>{errors.submit}</span>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating Project...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;