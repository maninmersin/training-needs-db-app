import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  createImpactAssessment, 
  addProcessToHierarchy 
} from '../services/impactAssessmentService';
import { getProcessTemplates } from '../services/templateService';
import './AssessmentWizard.css';

const AssessmentWizard = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  
  // Form data state
  const [assessmentData, setAssessmentData] = useState({
    name: '',
    description: '',
    assessment_type: 'business_process',
    template_id: '',
    use_template: false
  });

  // Process hierarchy state
  const [processHierarchy, setProcessHierarchy] = useState({
    l0_processes: [],
    custom_hierarchy: false
  });

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Assessment details and scope' },
    { number: 2, title: 'Process Structure', description: 'Define or select process hierarchy' },
    { number: 3, title: 'Review & Create', description: 'Confirm settings and create assessment' }
  ];

  useEffect(() => {
    if (currentProject?.id) {
      loadTemplates();
    }
  }, [currentProject?.id]);

  const loadTemplates = async () => {
    try {
      const templatesData = await getProcessTemplates(currentProject.id);
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInputChange = (field, value) => {
    setAssessmentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTemplateSelection = (templateId) => {
    setAssessmentData(prev => ({
      ...prev,
      template_id: templateId,
      use_template: !!templateId
    }));
  };

  const addL0Process = () => {
    const newProcess = {
      id: `l0_${Date.now()}`,
      code: '',
      name: '',
      level: 0,
      children: []
    };
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: [...prev.l0_processes, newProcess]
    }));
  };

  const updateL0Process = (processId, field, value) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(process => 
        process.id === processId ? { ...process, [field]: value } : process
      )
    }));
  };

  const removeL0Process = (processId) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.filter(process => process.id !== processId)
    }));
  };

  const addL1Process = (parentId) => {
    const newProcess = {
      id: `l1_${Date.now()}`,
      code: '',
      name: '',
      level: 1,
      children: []
    };
    
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === parentId 
          ? { ...l0Process, children: [...l0Process.children, newProcess] }
          : l0Process
      )
    }));
  };

  const updateL1Process = (parentId, processId, field, value) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === parentId 
          ? {
              ...l0Process,
              children: l0Process.children.map(l1Process =>
                l1Process.id === processId ? { ...l1Process, [field]: value } : l1Process
              )
            }
          : l0Process
      )
    }));
  };

  const removeL1Process = (parentId, processId) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === parentId 
          ? { ...l0Process, children: l0Process.children.filter(child => child.id !== processId) }
          : l0Process
      )
    }));
  };

  const addL2Process = (l0Id, l1Id) => {
    const newProcess = {
      id: `l2_${Date.now()}`,
      code: '',
      name: '',
      level: 2
    };
    
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === l0Id 
          ? {
              ...l0Process,
              children: l0Process.children.map(l1Process =>
                l1Process.id === l1Id
                  ? { ...l1Process, children: [...(l1Process.children || []), newProcess] }
                  : l1Process
              )
            }
          : l0Process
      )
    }));
  };

  const updateL2Process = (l0Id, l1Id, processId, field, value) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === l0Id 
          ? {
              ...l0Process,
              children: l0Process.children.map(l1Process =>
                l1Process.id === l1Id
                  ? {
                      ...l1Process,
                      children: (l1Process.children || []).map(l2Process =>
                        l2Process.id === processId ? { ...l2Process, [field]: value } : l2Process
                      )
                    }
                  : l1Process
              )
            }
          : l0Process
      )
    }));
  };

  const removeL2Process = (l0Id, l1Id, processId) => {
    setProcessHierarchy(prev => ({
      ...prev,
      l0_processes: prev.l0_processes.map(l0Process => 
        l0Process.id === l0Id 
          ? {
              ...l0Process,
              children: l0Process.children.map(l1Process =>
                l1Process.id === l1Id
                  ? { ...l1Process, children: (l1Process.children || []).filter(child => child.id !== processId) }
                  : l1Process
              )
            }
          : l0Process
      )
    }));
  };

  const createHierarchyFromCustom = async (assessmentId) => {
    const createProcessRecursive = async (processes, parentId = null, level = 0) => {
      for (const process of processes) {
        const processData = {
          assessment_id: assessmentId,
          process_code: process.code,
          process_name: process.name,
          level_number: level,
          parent_id: parentId,
          sort_order: 0
        };

        const createdProcess = await addProcessToHierarchy(processData);
        
        // Recursively create children
        if (process.children && process.children.length > 0) {
          await createProcessRecursive(process.children, createdProcess.id, level + 1);
        }
      }
    };

    await createProcessRecursive(processHierarchy.l0_processes);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validate form
      if (!assessmentData.name.trim()) {
        alert('Please enter an assessment name');
        return;
      }

      if (!assessmentData.use_template && processHierarchy.l0_processes.length === 0) {
        alert('Please add at least one L0 process or select a template');
        return;
      }

      // Create assessment
      const newAssessment = await createImpactAssessment({
        project_id: currentProject.id,
        name: assessmentData.name,
        description: assessmentData.description,
        assessment_type: assessmentData.assessment_type,
        template_id: assessmentData.use_template ? assessmentData.template_id : null
      });

      // Create custom hierarchy if not using template
      if (!assessmentData.use_template && processHierarchy.l0_processes.length > 0) {
        await createHierarchyFromCustom(newAssessment.id);
      }

      // Navigate to the new assessment
      navigate(`/impact-assessment/${newAssessment.id}`);
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Failed to create assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return assessmentData.name.trim().length > 0;
      case 2:
        return assessmentData.use_template || processHierarchy.l0_processes.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStep1 = () => (
    <div className="wizard-step">
      <h3>Basic Information</h3>
      <p>Provide the basic details for your impact assessment</p>

      <div className="form-group">
        <label htmlFor="assessment-name">Assessment Name *</label>
        <input
          id="assessment-name"
          type="text"
          placeholder="e.g., System Implementation Impact Assessment"
          value={assessmentData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="assessment-description">Description</label>
        <textarea
          id="assessment-description"
          placeholder="Describe the scope and purpose of this impact assessment..."
          value={assessmentData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="form-textarea"
          rows={4}
        />
      </div>

      <div className="form-group">
        <label htmlFor="assessment-type">Assessment Type</label>
        <select
          id="assessment-type"
          value={assessmentData.assessment_type}
          onChange={(e) => handleInputChange('assessment_type', e.target.value)}
          className="form-select"
        >
          <option value="business_process">Business Process</option>
          <option value="organizational">Organizational</option>
          <option value="technical">Technical</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step">
      <h3>Process Structure</h3>
      <p>Define your process hierarchy or select from available templates</p>

      <div className="template-selection">
        <div className="form-group">
          <label>
            <input
              type="radio"
              checked={assessmentData.use_template}
              onChange={() => handleTemplateSelection('')}
            />
            Use Template
          </label>
        </div>

        {assessmentData.use_template && (
          <div className="templates-list">
            {templates.length > 0 ? (
              templates.map(template => (
                <div key={template.id} className="template-option">
                  <label>
                    <input
                      type="radio"
                      name="template"
                      checked={assessmentData.template_id === template.id}
                      onChange={() => handleTemplateSelection(template.id)}
                    />
                    <div className="template-content">
                      <h4>{template.name}</h4>
                      <p>{template.description}</p>
                    </div>
                  </label>
                </div>
              ))
            ) : (
              <p className="no-templates">No templates available. Create a custom hierarchy below.</p>
            )}
          </div>
        )}

        <div className="form-group">
          <label>
            <input
              type="radio"
              checked={!assessmentData.use_template}
              onChange={() => setAssessmentData(prev => ({ ...prev, use_template: false, template_id: '' }))}
            />
            Create Custom Hierarchy
          </label>
        </div>
      </div>

      {!assessmentData.use_template && (
        <div className="custom-hierarchy">
          <div className="hierarchy-header">
            <h4>Process Hierarchy</h4>
            <button
              type="button"
              onClick={addL0Process}
              className="btn btn-secondary btn-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add L0 Process
            </button>
          </div>

          <div className="hierarchy-tree">
            {processHierarchy.l0_processes.map((l0Process, l0Index) => (
              <div key={l0Process.id} className="process-level l0-process">
                <div className="process-item">
                  <div className="process-inputs">
                    <input
                      type="text"
                      placeholder="L0 Code (e.g., 1, 2, 3)"
                      value={l0Process.code}
                      onChange={(e) => updateL0Process(l0Process.id, 'code', e.target.value)}
                      className="process-code-input"
                    />
                    <input
                      type="text"
                      placeholder="L0 Process Name"
                      value={l0Process.name}
                      onChange={(e) => updateL0Process(l0Process.id, 'name', e.target.value)}
                      className="process-name-input"
                    />
                  </div>
                  <div className="process-actions">
                    <button
                      type="button"
                      onClick={() => addL1Process(l0Process.id)}
                      className="btn btn-outline btn-xs"
                      title="Add L1 Process"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeL0Process(l0Process.id)}
                      className="btn btn-danger btn-xs"
                      title="Remove L0 Process"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* L1 Processes */}
                {l0Process.children.map((l1Process) => (
                  <div key={l1Process.id} className="process-level l1-process">
                    <div className="process-item">
                      <div className="process-inputs">
                        <input
                          type="text"
                          placeholder={`${l0Process.code}.1`}
                          value={l1Process.code}
                          onChange={(e) => updateL1Process(l0Process.id, l1Process.id, 'code', e.target.value)}
                          className="process-code-input"
                        />
                        <input
                          type="text"
                          placeholder="L1 Process Name"
                          value={l1Process.name}
                          onChange={(e) => updateL1Process(l0Process.id, l1Process.id, 'name', e.target.value)}
                          className="process-name-input"
                        />
                      </div>
                      <div className="process-actions">
                        <button
                          type="button"
                          onClick={() => addL2Process(l0Process.id, l1Process.id)}
                          className="btn btn-outline btn-xs"
                          title="Add L2 Process"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeL1Process(l0Process.id, l1Process.id)}
                          className="btn btn-danger btn-xs"
                          title="Remove L1 Process"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* L2 Processes */}
                    {(l1Process.children || []).map((l2Process) => (
                      <div key={l2Process.id} className="process-level l2-process">
                        <div className="process-item">
                          <div className="process-inputs">
                            <input
                              type="text"
                              placeholder={`${l1Process.code}.1`}
                              value={l2Process.code}
                              onChange={(e) => updateL2Process(l0Process.id, l1Process.id, l2Process.id, 'code', e.target.value)}
                              className="process-code-input"
                            />
                            <input
                              type="text"
                              placeholder="L2 Process Name"
                              value={l2Process.name}
                              onChange={(e) => updateL2Process(l0Process.id, l1Process.id, l2Process.id, 'name', e.target.value)}
                              className="process-name-input"
                            />
                          </div>
                          <div className="process-actions">
                            <button
                              type="button"
                              onClick={() => removeL2Process(l0Process.id, l1Process.id, l2Process.id)}
                              className="btn btn-danger btn-xs"
                              title="Remove L2 Process"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {processHierarchy.l0_processes.length === 0 && (
              <div className="empty-hierarchy">
                <p>No processes added yet. Click "Add L0 Process" to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step">
      <h3>Review & Create</h3>
      <p>Review your assessment configuration before creating</p>

      <div className="review-section">
        <div className="review-item">
          <strong>Assessment Name:</strong>
          <span>{assessmentData.name}</span>
        </div>
        <div className="review-item">
          <strong>Assessment Type:</strong>
          <span>{assessmentData.assessment_type}</span>
        </div>
        {assessmentData.description && (
          <div className="review-item">
            <strong>Description:</strong>
            <span>{assessmentData.description}</span>
          </div>
        )}
        <div className="review-item">
          <strong>Process Structure:</strong>
          <span>
            {assessmentData.use_template 
              ? `Using template: ${templates.find(t => t.id === assessmentData.template_id)?.name || 'Selected template'}`
              : `Custom hierarchy with ${processHierarchy.l0_processes.length} L0 processes`
            }
          </span>
        </div>
      </div>

      {!assessmentData.use_template && processHierarchy.l0_processes.length > 0 && (
        <div className="hierarchy-preview">
          <h4>Process Hierarchy Preview:</h4>
          <ul className="hierarchy-list">
            {processHierarchy.l0_processes.map(l0Process => (
              <li key={l0Process.id}>
                <strong>{l0Process.code} - {l0Process.name}</strong>
                {l0Process.children.length > 0 && (
                  <ul>
                    {l0Process.children.map(l1Process => (
                      <li key={l1Process.id}>
                        {l1Process.code} - {l1Process.name}
                        {l1Process.children && l1Process.children.length > 0 && (
                          <ul>
                            {l1Process.children.map(l2Process => (
                              <li key={l2Process.id}>
                                {l2Process.code} - {l2Process.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="assessment-wizard">
      <div className="wizard-header">
        <h1>Create Impact Assessment</h1>
        <button 
          className="btn btn-outline"
          onClick={() => navigate('/impact-assessment')}
        >
          Cancel
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="wizard-progress">
        {steps.map((step) => (
          <div 
            key={step.number}
            className={`progress-step ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
          >
            <div className="step-indicator">
              {currentStep > step.number ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : (
                step.number
              )}
            </div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>

      {/* Navigation */}
      <div className="wizard-navigation">
        <div className="nav-left">
          {currentStep > 1 && (
            <button 
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={loading}
            >
              Back
            </button>
          )}
        </div>
        <div className="nav-right">
          {currentStep < 3 ? (
            <button 
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!isStepValid()}
            >
              Next
            </button>
          ) : (
            <button 
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!isStepValid() || loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating...
                </>
              ) : (
                'Create Assessment'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentWizard;