import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  createStakeholder, 
  updateStakeholder, 
  validateStakeholder 
} from '../services/stakeholderService';
import { getAllReferenceData } from '../services/stakeholderReferenceService';
import { supabase } from '@core/services/supabaseClient';
import './StakeholderForm.css';

const StakeholderForm = ({ stakeholder, onSubmit, onCancel }) => {
  const { currentProject } = useProject();
  const [formData, setFormData] = useState({
    // Basic Information
    name: '',
    title: '',
    department: '',
    organization: '',
    email: '',
    phone: '',
    
    // Classification
    stakeholder_category: 'Internal',
    stakeholder_priority: 'Primary',
    stakeholder_type: 'General',
    
    // Power & Influence (1-5 scales)
    power_level: 3,
    interest_level: 3,
    
    // Engagement Tracking (0-5 scales)
    current_engagement_level: 0,
    target_engagement_level: 3,
    position_on_change: 'Neutral',
    
    // Relationship Management
    relationship_owner: '',
    engagement_purpose: '',
    last_contact_date: '',
    
    // Status & Tracking
    engagement_status: 'A',
    actions_required: '',
    comments: ''
  });
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [referenceData, setReferenceData] = useState({
    types: [],
    categories: [],
    priorities: []
  });
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);

  const isEditing = !!stakeholder;

  // Load available users for relationship owner dropdown
  useEffect(() => {
    const loadUsers = async () => {
      if (!currentProject?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            auth_users!inner(
              id,
              email
            )
          `)
          .eq('project_id', currentProject.id);

        if (error) throw error;
        
        const usersList = data?.map(pu => ({
          id: pu.auth_users.id,
          name: pu.auth_users.email.split('@')[0],
          email: pu.auth_users.email
        })) || [];
        
        setUsers(usersList);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [currentProject?.id]);

  // Load reference data for dropdowns
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const data = await getAllReferenceData(currentProject?.id);
        setReferenceData(data);
      } catch (err) {
        console.error('Error loading reference data:', err);
        // Use defaults on error
        setReferenceData({
          types: ['Executive', 'Senior Manager', 'Manager', 'Supervisor', 'Key User', 'Subject Matter Expert', 'Union Representative', 'External Partner', 'Vendor', 'Customer', 'General'],
          categories: ['Internal', 'External'],
          priorities: ['Primary', 'Secondary']
        });
      } finally {
        setLoadingReferenceData(false);
      }
    };

    loadReferenceData();
  }, [currentProject?.id]);

  // Load stakeholder data if editing
  useEffect(() => {
    if (stakeholder) {
      setFormData({
        name: stakeholder.name || '',
        title: stakeholder.title || '',
        department: stakeholder.department || '',
        organization: stakeholder.organization || '',
        email: stakeholder.email || '',
        phone: stakeholder.phone || '',
        stakeholder_category: stakeholder.stakeholder_category || 'Internal',
        stakeholder_priority: stakeholder.stakeholder_priority || 'Primary',
        stakeholder_type: stakeholder.stakeholder_type || 'General',
        power_level: stakeholder.power_level || 3,
        interest_level: stakeholder.interest_level || 3,
        current_engagement_level: stakeholder.current_engagement_level || 0,
        target_engagement_level: stakeholder.target_engagement_level || 3,
        position_on_change: stakeholder.position_on_change || 'Neutral',
        relationship_owner: stakeholder.relationship_owner || '',
        engagement_purpose: stakeholder.engagement_purpose || '',
        last_contact_date: stakeholder.last_contact_date || '',
        engagement_status: stakeholder.engagement_status || 'A',
        actions_required: stakeholder.actions_required || '',
        comments: stakeholder.comments || ''
      });
    }
  }, [stakeholder]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSliderChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value)
    }));
    
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prepare form data and handle empty dates
    const processedFormData = {
      ...formData,
      // Convert empty date strings to null for database
      last_contact_date: formData.last_contact_date?.trim() === '' ? null : formData.last_contact_date,
      // Convert empty strings to null for relationship_owner
      relationship_owner: formData.relationship_owner?.trim() === '' ? null : formData.relationship_owner
    };
    
    // Validate form data
    const validation = validateStakeholder(processedFormData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setErrors([]);

    try {
      if (isEditing) {
        await updateStakeholder(stakeholder.id, processedFormData, currentProject.id);
      } else {
        await createStakeholder(processedFormData, currentProject.id);
      }
      
      onSubmit();
    } catch (error) {
      console.error('Error saving stakeholder:', error);
      setErrors([error.message || 'Failed to save stakeholder']);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  // Helper functions for display
  const getPowerDescription = (level) => {
    const descriptions = {
      1: 'Very Low - Minimal ability to influence',
      2: 'Low - Limited influence on outcomes',
      3: 'Medium - Some impact on decisions',
      4: 'High - Significant influence on success',
      5: 'Very High - Critical influence on outcomes'
    };
    return descriptions[level] || '';
  };

  const getInterestDescription = (level) => {
    const descriptions = {
      1: 'Very Low - Minimal interest or concern',
      2: 'Low - Limited interest in the change',
      3: 'Medium - Moderate level of interest',
      4: 'High - Highly interested and engaged',
      5: 'Very High - Extremely interested and concerned'
    };
    return descriptions[level] || '';
  };

  const getEngagementDescription = (level) => {
    const descriptions = {
      0: 'Not Aware - Unaware of the change',
      1: 'Aware - Knows about the change',
      2: 'Understanding - Understands the impact',
      3: 'Ready to Collaborate - Willing to participate',
      4: 'Committed - Actively supporting',
      5: 'Champion - Advocating for the change'
    };
    return descriptions[level] || '';
  };

  const getStatusColor = (status) => {
    const colors = {
      'R': '#ef4444', // Red
      'A': '#f59e0b', // Amber/Orange
      'G': '#10b981'  // Green
    };
    return colors[status] || '#6b7280';
  };

  const getQuadrant = (power, interest) => {
    if (interest >= 4 && power >= 4) return 'Manage Closely';
    if (interest < 3 && power >= 4) return 'Keep Satisfied';
    if (interest >= 4 && power < 3) return 'Keep Informed';
    return 'Monitor';
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="stakeholder-form-modal enhanced" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Stakeholder' : 'Add New Stakeholder'}</h2>
          <button
            onClick={handleCancel}
            className="close-btn"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {errors.length > 0 && (
          <div className="error-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div className="error-content">
              <strong>Please fix the following errors:</strong>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="stakeholder-form enhanced">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group required">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter full name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Job title or role"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="department">Department</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="Department or team"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="organization">Organization</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder="Company or organization"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>

          {/* Stakeholder Classification */}
          <div className="form-section">
            <h3>Stakeholder Classification</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stakeholder_category">Category</label>
                <select
                  id="stakeholder_category"
                  name="stakeholder_category"
                  value={formData.stakeholder_category}
                  onChange={handleInputChange}
                  disabled={loadingReferenceData}
                >
                  {referenceData.categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="stakeholder_priority">Priority</label>
                <select
                  id="stakeholder_priority"
                  name="stakeholder_priority"
                  value={formData.stakeholder_priority}
                  onChange={handleInputChange}
                  disabled={loadingReferenceData}
                >
                  {referenceData.priorities.map(priority => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stakeholder_type">Type</label>
                <select
                  id="stakeholder_type"
                  name="stakeholder_type"
                  value={formData.stakeholder_type}
                  onChange={handleInputChange}
                  disabled={loadingReferenceData}
                >
                  {referenceData.types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Power & Influence Analysis */}
          <div className="form-section">
            <h3>Power & Influence Analysis</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="power_level">
                  Power Level: {formData.power_level}
                  <span className="level-description">{getPowerDescription(formData.power_level)}</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    id="power_level"
                    name="power_level"
                    min="1"
                    max="5"
                    value={formData.power_level}
                    onChange={(e) => handleSliderChange('power_level', e.target.value)}
                    className="level-slider power-slider"
                  />
                  <div className="slider-labels">
                    <span>1 - Very Low</span>
                    <span>5 - Very High</span>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="interest_level">
                  Interest Level: {formData.interest_level}
                  <span className="level-description">{getInterestDescription(formData.interest_level)}</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    id="interest_level"
                    name="interest_level"
                    min="1"
                    max="5"
                    value={formData.interest_level}
                    onChange={(e) => handleSliderChange('interest_level', e.target.value)}
                    className="level-slider interest-slider"
                  />
                  <div className="slider-labels">
                    <span>1 - Very Low</span>
                    <span>5 - Very High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quadrant Indicator */}
            <div className="quadrant-indicator">
              <span className="quadrant-label">Strategic Quadrant:</span>
              <span className="quadrant-value">{getQuadrant(formData.power_level, formData.interest_level)}</span>
            </div>
          </div>

          {/* Engagement & Change Readiness */}
          <div className="form-section">
            <h3>Engagement & Change Readiness</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="current_engagement_level">
                  Current Engagement Level: {formData.current_engagement_level}
                  <span className="level-description">{getEngagementDescription(formData.current_engagement_level)}</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    id="current_engagement_level"
                    name="current_engagement_level"
                    min="0"
                    max="5"
                    value={formData.current_engagement_level}
                    onChange={(e) => handleSliderChange('current_engagement_level', e.target.value)}
                    className="level-slider engagement-slider"
                  />
                  <div className="slider-labels">
                    <span>0 - Not Aware</span>
                    <span>5 - Champion</span>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="target_engagement_level">
                  Target Engagement Level: {formData.target_engagement_level}
                  <span className="level-description">{getEngagementDescription(formData.target_engagement_level)}</span>
                </label>
                <div className="slider-container">
                  <input
                    type="range"
                    id="target_engagement_level"
                    name="target_engagement_level"
                    min="0"
                    max="5"
                    value={formData.target_engagement_level}
                    onChange={(e) => handleSliderChange('target_engagement_level', e.target.value)}
                    className="level-slider engagement-slider target"
                  />
                  <div className="slider-labels">
                    <span>0 - Not Aware</span>
                    <span>5 - Champion</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagement Gap Indicator */}
            {formData.target_engagement_level !== formData.current_engagement_level && (
              <div className="engagement-gap">
                <span className="gap-label">Engagement Gap:</span>
                <span className={`gap-value ${formData.target_engagement_level > formData.current_engagement_level ? 'behind' : 'ahead'}`}>
                  {formData.target_engagement_level > formData.current_engagement_level ? 
                    `${formData.target_engagement_level - formData.current_engagement_level} levels behind target` :
                    `${formData.current_engagement_level - formData.target_engagement_level} levels ahead of target`
                  }
                </span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="position_on_change">Position on Change</label>
                <select
                  id="position_on_change"
                  name="position_on_change"
                  value={formData.position_on_change}
                  onChange={handleInputChange}
                >
                  <option value="Champion">Champion - Actively promotes the change</option>
                  <option value="Supporter">Supporter - Supports the change</option>
                  <option value="Neutral">Neutral - No strong opinion</option>
                  <option value="Skeptic">Skeptic - Has concerns or doubts</option>
                  <option value="Resistor">Resistor - Opposes the change</option>
                </select>
              </div>
            </div>
          </div>

          {/* Relationship Management */}
          <div className="form-section">
            <h3>Relationship Management</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="relationship_owner">Relationship Owner</label>
                <select
                  id="relationship_owner"
                  name="relationship_owner"
                  value={formData.relationship_owner}
                  onChange={handleInputChange}
                  disabled={loadingUsers}
                >
                  <option value="">Select relationship owner...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {loadingUsers && <small>Loading users...</small>}
              </div>
              
              <div className="form-group">
                <label htmlFor="last_contact_date">Last Contact Date</label>
                <input
                  type="date"
                  id="last_contact_date"
                  name="last_contact_date"
                  value={formData.last_contact_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="engagement_purpose">Engagement Purpose</label>
                <textarea
                  id="engagement_purpose"
                  name="engagement_purpose"
                  value={formData.engagement_purpose}
                  onChange={handleInputChange}
                  rows="2"
                  placeholder="Why are we engaging with this stakeholder?"
                />
              </div>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="form-section">
            <h3>Status & Action Tracking</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="engagement_status">RAG Status</label>
                <div className="rag-status-container">
                  <select
                    id="engagement_status"
                    name="engagement_status"
                    value={formData.engagement_status}
                    onChange={handleInputChange}
                    className="rag-status-select"
                  >
                    <option value="R">🔴 Red - Action Required</option>
                    <option value="A">🟠 Amber - Issues Being Addressed</option>
                    <option value="G">🟢 Green - Engaged as Needed</option>
                  </select>
                  <div 
                    className="rag-indicator"
                    style={{ backgroundColor: getStatusColor(formData.engagement_status) }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="actions_required">Actions Required</label>
                <textarea
                  id="actions_required"
                  name="actions_required"
                  value={formData.actions_required}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="What actions need to be taken for this stakeholder?"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="comments">Comments & Notes</label>
                <textarea
                  id="comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Additional comments, concerns, or observations..."
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="loading-spinner small"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Stakeholder' : 'Create Stakeholder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StakeholderForm;