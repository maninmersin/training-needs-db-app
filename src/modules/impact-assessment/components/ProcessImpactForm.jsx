import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  saveProcessImpact, 
  validateImpactRatings, 
  getImpactRatingDescription,
  getImpactColor,
  calculateOverallImpactRating,
  getOverallImpactBreakdown
} from '../services/impactAssessmentService';
import { getStakeholders } from '@modules/stakeholders/services/stakeholderService';
import RACIAssignmentGrid from './RACIAssignmentGrid';
import ImpactRatingGuide from './ImpactRatingGuide';
import './ProcessImpactForm.css';

const ProcessImpactForm = ({ 
  assessmentId, 
  processData, 
  existingImpact = null, 
  onSave, 
  onCancel 
}) => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [stakeholders, setStakeholders] = useState([]);
  const [raciAssignments, setRaciAssignments] = useState([]);
  const [raciValidationErrors, setRaciValidationErrors] = useState([]);
  const [savedProcessImpactId, setSavedProcessImpactId] = useState(existingImpact?.id || null);
  const [ratingGuideOpen, setRatingGuideOpen] = useState(false);
  
  // Form state matching your data structure exactly
  const [formData, setFormData] = useState({
    // Basic process info
    process_id: processData?.id || '',
    assessment_id: assessmentId,
    
    // As-Is vs To-Be Analysis
    as_is_description: existingImpact?.as_is_description || '',
    to_be_description: existingImpact?.to_be_description || '',
    as_is_core_system: existingImpact?.as_is_core_system || '',
    to_be_core_system: existingImpact?.to_be_core_system || '',
    
    // Change Analysis
    change_statement: existingImpact?.change_statement || '',
    benefits: existingImpact?.benefits || '',
    comments: existingImpact?.comments || '',
    
    // Multi-dimensional Impact Ratings (0-3 scale as per your example)
    process_rating: existingImpact?.process_rating || 0,
    role_rating: existingImpact?.role_rating || 0,
    new_role_rating: existingImpact?.new_role_rating || 0,
    workload_rating: existingImpact?.workload_rating || 0,
    workload_direction: existingImpact?.workload_direction || 'neutral',
    overall_impact_rating: existingImpact?.overall_impact_rating || 0,
    impact_direction: existingImpact?.impact_direction || 'neutral',
    
    // Additional fields
    system_complexity_rating: existingImpact?.system_complexity_rating || 0,
    data_migration_required: existingImpact?.data_migration_required || false,
    training_required: existingImpact?.training_required || false,
    priority: existingImpact?.priority || 'medium'
  });

  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    if (currentProject?.id) {
      loadStakeholders();
    }
  }, [currentProject?.id]);

  // Auto-calculate overall impact rating when individual ratings change
  useEffect(() => {
    const calculatedRating = calculateOverallImpactRating(formData);
    if (calculatedRating !== formData.overall_impact_rating) {
      setFormData(prev => ({
        ...prev,
        overall_impact_rating: calculatedRating
      }));
    }
  }, [
    formData.process_rating,
    formData.role_rating, 
    formData.new_role_rating,
    formData.workload_rating,
    formData.system_complexity_rating
  ]);

  const loadStakeholders = async () => {
    try {
      const stakeholderData = await getStakeholders(currentProject.id);
      setStakeholders(stakeholderData);
    } catch (error) {
      console.error('Error loading stakeholders:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation errors when user makes changes
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleRatingChange = (field, value) => {
    const numericValue = parseInt(value);
    handleInputChange(field, numericValue);
  };

  const handleRACIAssignmentsChange = (assignments, errors) => {
    setRaciAssignments(assignments);
    setRaciValidationErrors(errors);
  };

  const validateForm = () => {
    const errors = [];
    
    // Basic validation
    if (!formData.as_is_description.trim() && !formData.to_be_description.trim()) {
      errors.push('Please provide either As-Is or To-Be process description');
    }

    // Validate ratings
    const ratingErrors = validateImpactRatings({
      process_rating: formData.process_rating,
      role_rating: formData.role_rating,
      workload_rating: formData.workload_rating,
      overall_impact_rating: formData.overall_impact_rating,
      system_complexity_rating: formData.system_complexity_rating
    });
    
    errors.push(...ratingErrors);
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
        id: existingImpact?.id // Include ID if updating existing record
      });

      // Update the savedProcessImpactId for RACI assignments
      setSavedProcessImpactId(savedImpact.id);

      if (onSave) {
        onSave(savedImpact);
      }
    } catch (error) {
      console.error('Error saving process impact:', error);
      setValidationErrors(['Failed to save process impact. Please try again.']);
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
        
        <div className="rating-slider-container">
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
            <span className="slider-label">0</span>
            <span className="slider-label">{Math.floor(maxValue/2)}</span>
            <span className="slider-label">{maxValue}</span>
          </div>
        </div>
        
        {description && (
          <p className="rating-help-text">{description}</p>
        )}
      </div>
    );
  };

  return (
    <div className="process-impact-form">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="form-header">
          <div className="process-info">
            <h2>Process Impact Analysis</h2>
            {/* Process Hierarchy Breadcrumb */}
            {processData && (
              <div className="process-hierarchy-breadcrumb">
                <span className="hierarchy-level">L{processData.level}</span>
                {processData.parent_process_code && (
                  <>
                    <span className="breadcrumb-separator">›</span>
                    <span className="parent-process">{processData.parent_process_code}</span>
                  </>
                )}
                <span className="breadcrumb-separator">›</span>
                <span className="current-process">{processData.process_code}</span>
              </div>
            )}
            <div className="process-details">
              <span className="process-code">{processData?.process_code}</span>
              <span className="process-name">{processData?.process_name}</span>
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
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
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Saving...
                </>
              ) : (
                existingImpact ? 'Update Impact' : 'Save Impact'
              )}
            </button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <h4>Please correct the following errors:</h4>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rating Guide */}
        <ImpactRatingGuide 
          isOpen={ratingGuideOpen}
          onToggle={() => setRatingGuideOpen(!ratingGuideOpen)}
        />

        {/* Form Content */}
        <div className="form-content">
          
          {/* As-Is vs To-Be Analysis */}
          <section className="form-section">
            <h3>Process Analysis</h3>
            
            <div className="process-comparison">
              <div className="process-column">
                <div className="form-group">
                  <label htmlFor="as-is-description">As-Is Process Description</label>
                  <textarea
                    id="as-is-description"
                    value={formData.as_is_description}
                    onChange={(e) => handleInputChange('as_is_description', e.target.value)}
                    placeholder="Describe the current process..."
                    className="form-textarea large"
                    rows={6}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="as-is-system">As-Is Core System</label>
                  <input
                    type="text"
                    id="as-is-system"
                    value={formData.as_is_core_system}
                    onChange={(e) => handleInputChange('as_is_core_system', e.target.value)}
                    placeholder="e.g., ISCM, BAA, Extranet"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="arrow-separator">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12,5 19,12 12,19"/>
                </svg>
              </div>

              <div className="process-column">
                <div className="form-group">
                  <label htmlFor="to-be-description">To-Be Process Description</label>
                  <textarea
                    id="to-be-description"
                    value={formData.to_be_description}
                    onChange={(e) => handleInputChange('to_be_description', e.target.value)}
                    placeholder="Describe the future process..."
                    className="form-textarea large"
                    rows={6}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="to-be-system">To-Be Core System</label>
                  <input
                    type="text"
                    id="to-be-system"
                    value={formData.to_be_core_system}
                    onChange={(e) => handleInputChange('to_be_core_system', e.target.value)}
                    placeholder="e.g., Manhattan, Portal, ISCM"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Change Analysis */}
          <section className="form-section">
            <h3>Change Analysis</h3>
            
            <div className="form-group">
              <label htmlFor="change-statement">Change Statement</label>
              <textarea
                id="change-statement"
                value={formData.change_statement}
                onChange={(e) => handleInputChange('change_statement', e.target.value)}
                placeholder="Describe the specific changes and their implications..."
                className="form-textarea"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="benefits">Benefits</label>
              <textarea
                id="benefits"
                value={formData.benefits}
                onChange={(e) => handleInputChange('benefits', e.target.value)}
                placeholder="List the expected benefits of this change..."
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="comments">Comments</label>
              <textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder="Additional comments, considerations, or notes..."
                className="form-textarea"
                rows={3}
              />
            </div>
          </section>

          {/* Impact Ratings */}
          <section className="form-section">
            <h3>Impact Ratings</h3>
            <p className="section-description">
              Rate the impact of this change across different dimensions using the scales below.
            </p>
            
            <div className="ratings-grid">
              {renderRatingSlider(
                'process_rating', 
                'Process Rating', 
                3,
                'How much will the core process change? (0 = No change, 3 = Major change)'
              )}
              
              {renderRatingSlider(
                'role_rating', 
                'Role Rating', 
                3,
                'How much will existing roles and responsibilities change? (0 = No change, 3 = Major change)'
              )}

              {renderRatingSlider(
                'new_role_rating', 
                'New Role Rating', 
                3,
                'What is the impact of new roles being created? (0 = No new roles, 3 = Many new roles required)'
              )}
              
              {renderRatingSlider(
                'workload_rating', 
                'Workload Rating', 
                3,
                'How much will the workload/effort change? (0 = No change, 3 = Major increase)'
              )}
              
              {renderRatingSlider(
                'system_complexity_rating', 
                'System Complexity Rating', 
                3,
                'How complex is the system integration? (0 = Simple, 3 = Very complex)'
              )}
              
              {/* Calculated Overall Impact Rating Display */}
              <div className="form-group calculated-rating">
                <label className="calculated-rating-label">
                  Overall Impact Rating (Calculated)
                </label>
                <div className="calculated-rating-display">
                  <div className="rating-breakdown-container">
                    <div className="rating-score">
                      <span className={`score-value ${getImpactColor(formData.overall_impact_rating)}`}>
                        {formData.overall_impact_rating}
                      </span>
                      <span className="score-scale">/5</span>
                    </div>
                    <div className="rating-description">
                      <span className="description-text">
                        {getOverallImpactBreakdown(formData).description}
                      </span>
                      <span className="breakdown-text">
                        {getOverallImpactBreakdown(formData).breakdown}
                      </span>
                    </div>
                  </div>
                  <div className="calculation-formula">
                    <small>
                      Process ({formData.process_rating}) + Role ({formData.role_rating}) + New Role ({formData.new_role_rating}) + Workload ({formData.workload_rating}) + System ({formData.system_complexity_rating}) = {getOverallImpactBreakdown(formData).totalPoints}/15
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="impact-direction">Overall Impact Direction</label>
                <select
                  id="impact-direction"
                  value={formData.impact_direction}
                  onChange={(e) => handleInputChange('impact_direction', e.target.value)}
                  className="form-select"
                >
                  <option value="neutral">Neutral</option>
                  <option value="positive">Positive (+)</option>
                  <option value="negative">Negative (-)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="workload-direction">Workload Direction (+/-)</label>
                <select
                  id="workload-direction"
                  value={formData.workload_direction}
                  onChange={(e) => handleInputChange('workload_direction', e.target.value)}
                  className="form-select"
                >
                  <option value="neutral">No Change</option>
                  <option value="increase">Increase (+)</option>
                  <option value="decrease">Decrease (-)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="form-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </section>

          {/* RACI Assignments */}
          <section className="form-section">
            <h3>RACI Assignments</h3>
            <p className="section-description">
              Define who is Responsible, Accountable, Consulted, and Informed for this process.
              Save the impact analysis first to enable RACI assignments.
            </p>
            
            {savedProcessImpactId ? (
              <RACIAssignmentGrid
                processImpactId={savedProcessImpactId}
                processName={processData?.process_name || 'Process'}
                onAssignmentsChange={handleRACIAssignmentsChange}
              />
            ) : (
              <div className="raci-placeholder">
                <div className="placeholder-content">
                  <p>Save the impact analysis above to enable RACI assignments for this process.</p>
                  <button 
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      // Trigger form submission to save the impact first
                      const form = document.querySelector('.process-impact-form form');
                      if (form) {
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(submitEvent);
                      }
                    }}
                    disabled={loading}
                  >
                    Save Impact Analysis First
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Additional Requirements */}
          <section className="form-section">
            <h3>Additional Requirements</h3>
            
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.data_migration_required}
                  onChange={(e) => handleInputChange('data_migration_required', e.target.checked)}
                />
                <span className="checkbox-text">Data Migration Required</span>
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.training_required}
                  onChange={(e) => handleInputChange('training_required', e.target.checked)}
                />
                <span className="checkbox-text">Training Required</span>
              </label>
            </div>
          </section>

          {/* Impact Summary */}
          <section className="form-section">
            <h3>Impact Summary</h3>
            <div className="impact-summary">
              <div className="summary-item">
                <span className="summary-label">Process Impact:</span>
                <span className={`summary-value ${getImpactColor(formData.process_rating)}`}>
                  {formData.process_rating}/3 - {getImpactRatingDescription(formData.process_rating)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Role Impact:</span>
                <span className={`summary-value ${getImpactColor(formData.role_rating)}`}>
                  {formData.role_rating}/3 - {getImpactRatingDescription(formData.role_rating)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Workload Impact:</span>
                <span className={`summary-value ${getImpactColor(formData.workload_rating)}`}>
                  {formData.workload_rating}/3 - {getImpactRatingDescription(formData.workload_rating)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Overall Impact:</span>
                <span className={`summary-value ${getImpactColor(formData.overall_impact_rating)}`}>
                  {formData.overall_impact_rating}/5 - {getImpactRatingDescription(formData.overall_impact_rating, 'overall')}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Direction:</span>
                <span className={`summary-value direction-${formData.impact_direction}`}>
                  {formData.impact_direction === 'positive' ? 'Positive (+)' : 
                   formData.impact_direction === 'negative' ? 'Negative (-)' : 'Neutral'}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Form Footer */}
        <div className="form-footer">
          <div className="footer-info">
            <span className="required-note">* Required fields</span>
          </div>
          
          <div className="footer-actions">
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
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Saving...
                </>
              ) : (
                existingImpact ? 'Update Impact Analysis' : 'Save Impact Analysis'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProcessImpactForm;