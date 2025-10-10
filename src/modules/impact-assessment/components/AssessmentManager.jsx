import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  getImpactAssessments, 
  createImpactAssessment, 
  updateImpactAssessment, 
  deleteImpactAssessment 
} from '../services/impactAssessmentService';
import './AssessmentManager.css';

const AssessmentManager = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assessment_type: 'business_process'
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const data = await getImpactAssessments(currentProject.id);
      setAssessments(data || []);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      assessment_type: 'business_process'
    });
    setShowCreateForm(false);
    setEditingAssessment(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter an assessment name');
      return;
    }

    try {
      await createImpactAssessment({
        project_id: currentProject.id,
        name: formData.name,
        description: formData.description,
        assessment_type: formData.assessment_type
      });
      
      resetForm();
      loadAssessments();
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Failed to create assessment. Please try again.');
    }
  };

  const handleEdit = (assessment) => {
    setFormData({
      name: assessment.name,
      description: assessment.description || '',
      assessment_type: assessment.assessment_type
    });
    setEditingAssessment(assessment);
    setShowCreateForm(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter an assessment name');
      return;
    }

    try {
      await updateImpactAssessment(editingAssessment.id, {
        name: formData.name,
        description: formData.description,
        assessment_type: formData.assessment_type
      });
      
      resetForm();
      loadAssessments();
    } catch (error) {
      console.error('Error updating assessment:', error);
      alert('Failed to update assessment. Please try again.');
    }
  };

  const handleDelete = async (assessmentId) => {
    try {
      await deleteImpactAssessment(assessmentId);
      setDeleteConfirm(null);
      loadAssessments();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert('Failed to delete assessment. Please try again.');
    }
  };

  const getAssessmentTypeLabel = (type) => {
    const types = {
      business_process: 'Business Process',
      organizational: 'Organizational',
      technical: 'Technical',
      hybrid: 'Hybrid'
    };
    return types[type] || type;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="assessment-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-manager">
      <div className="manager-header">
        <h1>Manage Assessments</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create New Assessment
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="form-overlay">
          <div className="form-modal">
            <div className="form-header">
              <h2>{editingAssessment ? 'Edit Assessment' : 'Create New Assessment'}</h2>
              <button 
                className="close-btn"
                onClick={resetForm}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={editingAssessment ? handleUpdate : handleCreate}>
              <div className="form-group">
                <label htmlFor="assessment-name">Assessment Name *</label>
                <input
                  id="assessment-name"
                  type="text"
                  placeholder="e.g., System Implementation Impact Assessment"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="assessment-description">Description</label>
                <textarea
                  id="assessment-description"
                  placeholder="Describe the scope and purpose of this impact assessment..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="form-textarea"
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label htmlFor="assessment-type">Assessment Type</label>
                <select
                  id="assessment-type"
                  value={formData.assessment_type}
                  onChange={(e) => handleInputChange('assessment_type', e.target.value)}
                  className="form-select"
                >
                  <option value="business_process">Business Process</option>
                  <option value="organizational">Organizational</option>
                  <option value="technical">Technical</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAssessment ? 'Update Assessment' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="form-overlay">
          <div className="form-modal small">
            <div className="form-header">
              <h2>Confirm Delete</h2>
            </div>
            <p>Are you sure you want to delete "{deleteConfirm.name}"?</p>
            <p className="warning-text">This action cannot be undone and will delete all associated process impacts and RACI assignments.</p>
            
            <div className="form-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDelete(deleteConfirm.id)}
              >
                Delete Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessments List */}
      <div className="assessments-container">
        {assessments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <path d="M16 13H8M16 17H8M10 9H8"/>
              </svg>
            </div>
            <h3>No Assessments Yet</h3>
            <p>Create your first impact assessment to get started with process analysis.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create Your First Assessment
            </button>
          </div>
        ) : (
          <div className="assessments-table">
            <div className="table-header">
              <div className="header-cell">Name</div>
              <div className="header-cell">Type</div>
              <div className="header-cell">Created</div>
              <div className="header-cell">Processes</div>
              <div className="header-cell">Actions</div>
            </div>

            {assessments.map(assessment => (
              <div key={assessment.id} className="table-row">
                <div className="table-cell">
                  <div className="assessment-info">
                    <div className="assessment-name">{assessment.name}</div>
                    {assessment.description && (
                      <div className="assessment-description">{assessment.description}</div>
                    )}
                  </div>
                </div>
                <div className="table-cell">
                  <span className={`type-badge ${assessment.assessment_type}`}>
                    {getAssessmentTypeLabel(assessment.assessment_type)}
                  </span>
                </div>
                <div className="table-cell">
                  {formatDate(assessment.created_at)}
                </div>
                <div className="table-cell">
                  <span className="process-count">
                    {assessment.statistics?.total_processes || 0} processes
                  </span>
                </div>
                <div className="table-cell actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/impact-assessment/${assessment.id}`)}
                    title="View Assessment"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    View
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleEdit(assessment)}
                    title="Edit Assessment"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                  </button>
                  <button
                    className="btn btn-outline btn-sm danger"
                    onClick={() => setDeleteConfirm(assessment)}
                    title="Delete Assessment"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentManager;