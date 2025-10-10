import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { 
  saveProcessImpact,
  getImpactRatingDescription,
  getImpactColor,
  getSystemsReferenceData,
  getStakeholderRolesReferenceData,
  getStatusOptionsReferenceData
} from '../services/impactAssessmentService';
import './ProcessImpactModal.css';

const ProcessImpactModal = ({ 
  assessmentId, 
  processData, 
  existingImpact = null,
  onSave, 
  onCancel,
  projectId
}) => {
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [referenceData, setReferenceData] = useState({
    systems: [],
    stakeholderRoles: [],
    statusOptions: []
  });
  
  // Form state matching CSV structure exactly
  const [formData, setFormData] = useState({
    // Process identification (from processData)
    process_id: processData?.process_id || '',
    assessment_id: assessmentId,
    
    // As-Is Process Analysis (CSV columns)
    as_is_description: existingImpact?.as_is_description || '',
    as_is_raci_r: existingImpact?.as_is_raci_r || '', // Responsible
    as_is_raci_a: existingImpact?.as_is_raci_a || '', // Accountable  
    as_is_raci_c: existingImpact?.as_is_raci_c || '', // Consulted
    as_is_raci_i: existingImpact?.as_is_raci_i || '', // Informed
    as_is_core_system: existingImpact?.as_is_core_system || '',
    
    // To-Be Process Analysis (CSV columns)
    to_be_description: existingImpact?.to_be_description || '',
    to_be_raci_r: existingImpact?.to_be_raci_r || '',
    to_be_raci_a: existingImpact?.to_be_raci_a || '',
    to_be_raci_c: existingImpact?.to_be_raci_c || '',
    to_be_raci_i: existingImpact?.to_be_raci_i || '',
    to_be_core_system: existingImpact?.to_be_core_system || '',
    
    // Impact Ratings (CSV columns - exactly as in your example)
    process_rating: existingImpact?.process_rating || 0,
    role_rating: existingImpact?.role_rating || 0,
    new_role_rating: existingImpact?.new_role_rating || 0,
    workload_direction: existingImpact?.workload_direction || 'neutral', // +, -, neutral
    workload_rating: existingImpact?.workload_rating || 0,
    overall_impact_rating: existingImpact?.overall_impact_rating || 0, // Impact Rating from CSV
    
    // Change Analysis (CSV columns)
    change_statement: existingImpact?.change_statement || '',
    business_benefits: existingImpact?.business_benefits || '', // Separate from general benefits
    status: existingImpact?.status || '',
    actions: existingImpact?.actions || '',
    comments: existingImpact?.comments || '',
    
    // Additional fields
    priority: existingImpact?.priority || 'medium',
    training_required: existingImpact?.training_required || false,
    data_migration_required: existingImpact?.data_migration_required || false
  });

  // Load reference data on mount
  useEffect(() => {
    const loadReferenceData = async () => {
      if (!projectId) return;
      
      try {
        const [systems, stakeholderRoles, statusOptions] = await Promise.all([
          getSystemsReferenceData(projectId),
          getStakeholderRolesReferenceData(projectId),
          getStatusOptionsReferenceData(projectId)
        ]);
        
        setReferenceData({
          systems: systems || [],
          stakeholderRoles: stakeholderRoles || [],
          statusOptions: statusOptions || []
        });
      } catch (error) {
        console.error('Error loading reference data:', error);
      }
    };
    
    loadReferenceData();
  }, [projectId]);

  // Auto-calculate overall impact rating
  useEffect(() => {
    const total = formData.process_rating + formData.role_rating + formData.new_role_rating + formData.workload_rating;
    // Scale from 0-12 to 0-5 (matching your CSV logic)
    const calculatedRating = Math.min(Math.round((total / 12) * 5), 5);
    
    if (calculatedRating !== formData.overall_impact_rating) {
      setFormData(prev => ({
        ...prev,
        overall_impact_rating: calculatedRating
      }));
    }
  }, [formData.process_rating, formData.role_rating, formData.new_role_rating, formData.workload_rating]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleRatingChange = (field, value) => {
    const numericValue = parseInt(value) || 0;
    handleInputChange(field, numericValue);
  };

  const handleRACIChange = (column, value) => {
    // Convert comma-separated stakeholder codes
    const cleanValue = value.trim();
    handleInputChange(column, cleanValue);
  };

  const validateForm = () => {
    const errors = [];
    
    if (!formData.as_is_description.trim() && !formData.to_be_description.trim()) {
      errors.push('Please provide either As-Is or To-Be process description');
    }
    
    // Validate ratings are within bounds
    const ratings = ['process_rating', 'role_rating', 'new_role_rating', 'workload_rating'];
    ratings.forEach(rating => {
      if (formData[rating] < 0 || formData[rating] > 3) {
        errors.push(`${rating.replace('_', ' ')} must be between 0 and 3`);
      }
    });
    
    if (formData.overall_impact_rating < 0 || formData.overall_impact_rating > 5) {
      errors.push('Overall impact rating must be between 0 and 5');
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setLoading(true);
      
      const savedImpact = await saveProcessImpact({
        ...formData,
        id: existingImpact?.id // Include ID if updating
      });

      if (onSave) {
        onSave(savedImpact);
      }
    } catch (error) {
      console.error('Error saving impact:', error);
      setValidationErrors(['Failed to save impact analysis. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const renderRatingSlider = (field, label, maxValue = 3, description = '') => {
    const value = formData[field];
    const colorClass = getImpactColor(value);
    
    return (
      <div className="rating-group">
        <div className="rating-header">
          <label htmlFor={field}>{label}</label>
          <div className={`rating-display ${colorClass}`}>
            <span className="rating-value">{value}</span>
            <span className="rating-description">
              {getImpactRatingDescription(value, maxValue === 5 ? 'overall' : 'standard')}
            </span>
          </div>
        </div>
        
        <input
          type="range"
          id={field}
          min="0"
          max={maxValue}
          value={value}
          onChange={(e) => handleRatingChange(field, e.target.value)}
          className={`rating-slider ${colorClass}`}
        />
        
        <div className="slider-labels">
          <span>0</span>
          <span>{Math.floor(maxValue/2)}</span>
          <span>{maxValue}</span>
        </div>
        
        {description && (
          <p className="rating-help-text">{description}</p>
        )}
      </div>
    );
  };

  const renderRACIInput = (raciType, label) => {
    const asIsField = `as_is_raci_${raciType}`;
    const toBeField = `to_be_raci_${raciType}`;
    
    return (
      <div className="raci-input-group">
        <label className="raci-label">{label}</label>
        <div className="raci-inputs">
          <div className="raci-input">
            <label>As-Is</label>
            <input
              type="text"
              value={formData[asIsField]}
              onChange={(e) => handleRACIChange(asIsField, e.target.value)}
placeholder=""
              className="form-input"
              list="stakeholder-roles"
            />
          </div>
          <div className="raci-input">
            <label>To-Be</label>
            <input
              type="text"
              value={formData[toBeField]}
              onChange={(e) => handleRACIChange(toBeField, e.target.value)}
placeholder=""
              className="form-input"
              list="stakeholder-roles"
            />
          </div>
        </div>
      </div>
    );
  };

  const { systems: systemOptions, statusOptions, stakeholderRoles } = referenceData;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="process-impact-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          {/* Modal Header */}
          <div className="modal-header">
            <div className="process-info">
              <h2>Impact Analysis</h2>
              <div className="process-details">
                <span className="process-code">{processData?.process_code}</span>
                <span className="process-name">{processData?.process_name}</span>
              </div>
            </div>
            <button 
              type="button" 
              className="close-button" 
              onClick={onCancel}
              disabled={loading}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <ul>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="modal-content">
            {/* As-Is vs To-Be Process Analysis */}
            <section className="form-section">
              <h3>Process Analysis</h3>
              
              <div className="process-comparison">
                <div className="process-column">
                  <h4>As-Is Process</h4>
                  
                  <div className="form-group">
                    <label>Process Description</label>
                    <textarea
                      value={formData.as_is_description}
                      onChange={(e) => handleInputChange('as_is_description', e.target.value)}
                      placeholder="Describe current process..."
                      rows={4}
                      className="form-textarea"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Core System</label>
                    <select
                      value={formData.as_is_core_system}
                      onChange={(e) => handleInputChange('as_is_core_system', e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select system...</option>
                      {referenceData.systems.map(system => (
                        <option key={system.system_code} value={system.system_code}>
                          {system.system_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="arrow-separator">→</div>

                <div className="process-column">
                  <h4>To-Be Process</h4>
                  
                  <div className="form-group">
                    <label>Process Description</label>
                    <textarea
                      value={formData.to_be_description}
                      onChange={(e) => handleInputChange('to_be_description', e.target.value)}
                      placeholder="Describe future process..."
                      rows={4}
                      className="form-textarea"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Core System</label>
                    <select
                      value={formData.to_be_core_system}
                      onChange={(e) => handleInputChange('to_be_core_system', e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select system...</option>
                      {referenceData.systems.map(system => (
                        <option key={system.system_code} value={system.system_code}>
                          {system.system_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* RACI Assignment - CSV Format */}
            <section className="form-section">
              <h3>RACI Assignment</h3>
              <p className="section-description">
                Select the relevant Stakeholder code using the dropdown menus
              </p>
              
              <div className="raci-grid">
                {renderRACIInput('r', 'Responsible (R)')}
                {renderRACIInput('a', 'Accountable (A)')}
                {renderRACIInput('c', 'Consulted (C)')}
                {renderRACIInput('i', 'Informed (I)')}
              </div>
            </section>

            {/* Impact Ratings */}
            <section className="form-section">
              <h3>Impact Ratings (0-3 Scale)</h3>
              
              <div className="ratings-grid">
                {renderRatingSlider(
                  'process_rating', 
                  'Process Rating',
                  3,
                  'How much will the process change?'
                )}
                
                {renderRatingSlider(
                  'role_rating', 
                  'Role Rating',
                  3, 
                  'How much will roles change?'
                )}
                
                {renderRatingSlider(
                  'new_role_rating', 
                  'New Role Rating',
                  3,
                  'Impact of new roles being created?'
                )}
                
                {renderRatingSlider(
                  'workload_rating', 
                  'Workload Rating',
                  3,
                  'How much will workload change?'
                )}
              </div>
              
              {/* Workload Direction */}
              <div className="form-group">
                <label>Workload Direction (+/-)</label>
                <select
                  value={formData.workload_direction}
                  onChange={(e) => handleInputChange('workload_direction', e.target.value)}
                  className="form-select"
                >
                  <option value="neutral">No Change</option>
                  <option value="increase">Increase (+)</option>
                  <option value="decrease">Decrease (-)</option>
                </select>
              </div>
              
              {/* Calculated Overall Impact Rating */}
              <div className="calculated-rating">
                <label>Overall Impact Rating (Calculated)</label>
                <div className={`rating-display ${getImpactColor(formData.overall_impact_rating)}`}>
                  <span className="rating-value">{formData.overall_impact_rating}</span>
                  <span className="rating-scale">/5</span>
                  <span className="rating-description">
                    {getImpactRatingDescription(formData.overall_impact_rating, 'overall')}
                  </span>
                </div>
                <div className="calculation-info">
                  <small>
                    Process ({formData.process_rating}) + Role ({formData.role_rating}) + New Role ({formData.new_role_rating}) + Workload ({formData.workload_rating}) = {formData.process_rating + formData.role_rating + formData.new_role_rating + formData.workload_rating}/12
                  </small>
                </div>
              </div>
            </section>

            {/* Change Analysis */}
            <section className="form-section">
              <h3>Change Analysis</h3>
              
              <div className="form-group">
                <label>Change Statement</label>
                <textarea
                  value={formData.change_statement}
                  onChange={(e) => handleInputChange('change_statement', e.target.value)}
                  placeholder="Describe the specific changes..."
                  rows={3}
                  className="form-textarea"
                />
              </div>
              
              <div className="form-group">
                <label>Business Benefits</label>
                <textarea
                  value={formData.business_benefits}
                  onChange={(e) => handleInputChange('business_benefits', e.target.value)}
                  placeholder="List specific business benefits..."
                  rows={3}
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="form-select"
                  >
                    <option value="">No Status</option>
                    {statusOptions.map(status => (
                      <option key={status.status_code || status.id} value={status.status_code || status.status_name}>
                        {status.status_name}
                      </option>
                    ))}
                  </select>
                </div>
                
              </div>
              
              <div className="form-group">
                <label>Actions (Optional)</label>
                <textarea
                  value={formData.actions}
                  onChange={(e) => handleInputChange('actions', e.target.value)}
                  placeholder="Required actions and next steps..."
                  rows={3}
                  className="form-textarea"
                />
              </div>
              
              <div className="form-group">
                <label>Comments</label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  placeholder="Additional comments..."
                  rows={2}
                  className="form-textarea"
                />
              </div>
            </section>

          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (existingImpact ? 'Update Impact' : 'Save Impact')}
            </button>
          </div>

          {/* Datalist for stakeholder roles autocomplete */}
          <datalist id="stakeholder-roles">
            {stakeholderRoles.map(role => (
              <option key={role.role_code || role.id} value={role.role_code}>
                {role.role_name} ({role.role_code})
              </option>
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
};

export default ProcessImpactModal;