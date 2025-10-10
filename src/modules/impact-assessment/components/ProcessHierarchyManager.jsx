import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  getImpactAssessments,
  getProcessHierarchyTree,
  upsertProcessHierarchy,
  deleteProcessHierarchy,
  validateProcessHierarchy
} from '../services/impactAssessmentService';
import './ProcessHierarchyManager.css';

/**
 * Process Hierarchy Manager Component
 * Visual tree editor for managing L0/L1/L2 process hierarchies
 * Supports adding, editing, deleting, and reordering processes
 */
const ProcessHierarchyManager = () => {
  const { assessmentId: urlAssessmentId } = useParams();
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(urlAssessmentId || '');
  const [processTree, setProcessTree] = useState([]);
  const [flatProcesses, setFlatProcesses] = useState([]);
  const [editingProcess, setEditingProcess] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Form state for adding/editing processes
  const [formData, setFormData] = useState({
    process_code: '',
    process_name: '',
    level_number: 0,
    parent_id: '',
    sort_order: 0
  });

  // Tree expansion state
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (selectedAssessmentId) {
      loadProcessHierarchy();
    }
  }, [selectedAssessmentId]);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const assessmentsData = await getImpactAssessments(currentProject.id);
      setAssessments(assessmentsData);
      
      if (!selectedAssessmentId && assessmentsData.length > 0) {
        setSelectedAssessmentId(assessmentsData[0].id);
      }
    } catch (err) {
      console.error('Error loading assessments:', err);
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const loadProcessHierarchy = async () => {
    try {
      setError(null);
      
      const hierarchyTree = await getProcessHierarchyTree(selectedAssessmentId);
      setProcessTree(hierarchyTree);
      
      // Also create flat array for easier operations
      const flatArray = flattenTree(hierarchyTree);
      setFlatProcesses(flatArray);
      
      // Auto-expand first level by default for better UX
      const rootNodes = hierarchyTree.map(node => node.id);
      setExpandedNodes(new Set(rootNodes));
    } catch (err) {
      console.error('Error loading process hierarchy:', err);
      setError(err.message || 'Failed to load process hierarchy');
    }
  };

  const flattenTree = (tree) => {
    const result = [];
    
    const traverse = (nodes) => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    
    traverse(tree);
    return result;
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors when user makes changes
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const validateForm = () => {
    const errors = validateProcessHierarchy(formData, flatProcesses);
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSaveProcess = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const processData = {
        ...formData,
        assessment_id: selectedAssessmentId,
        id: editingProcess?.id || undefined
      };

      await upsertProcessHierarchy(processData);
      await loadProcessHierarchy();
      
      // Reset form
      setFormData({
        process_code: '',
        process_name: '',
        level_number: 0,
        parent_id: '',
        sort_order: 0
      });
      setEditingProcess(null);
      setShowAddForm(false);
      setValidationErrors([]);
    } catch (err) {
      console.error('Error saving process:', err);
      setError(err.message || 'Failed to save process');
    }
  };

  const handleEditProcess = (process) => {
    setFormData({
      process_code: process.process_code,
      process_name: process.process_name,
      level_number: process.level_number,
      parent_id: process.parent_id || '',
      sort_order: process.sort_order || 0
    });
    setEditingProcess(process);
    setShowAddForm(true);
  };

  const handleDeleteProcess = async (processId) => {
    if (!confirm('Are you sure you want to delete this process? This will also delete all child processes.')) {
      return;
    }

    try {
      await deleteProcessHierarchy(processId);
      await loadProcessHierarchy();
    } catch (err) {
      console.error('Error deleting process:', err);
      setError(err.message || 'Failed to delete process');
    }
  };

  const handleAddChild = (parentProcess) => {
    setFormData({
      process_code: '',
      process_name: '',
      level_number: parentProcess.level_number + 1,
      parent_id: parentProcess.id,
      sort_order: 0
    });
    setEditingProcess(null);
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setFormData({
      process_code: '',
      process_name: '',
      level_number: 0,
      parent_id: '',
      sort_order: 0
    });
    setEditingProcess(null);
    setShowAddForm(false);
    setValidationErrors([]);
  };

  const getLevelLabel = (level) => {
    switch (level) {
      case 0: return 'L0';
      case 1: return 'L1';
      case 2: return 'L2';
      case 3: return 'L3';
      default: return `L${level}`;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 0: return 'level-0';
      case 1: return 'level-1';
      case 2: return 'level-2';
      case 3: return 'level-3';
      default: return 'level-default';
    }
  };

  const getParentOptions = () => {
    if (formData.level_number === 0) {
      return []; // L0 processes have no parent
    }
    
    return flatProcesses.filter(p => 
      p.level_number < formData.level_number && 
      p.id !== editingProcess?.id
    );
  };

  const toggleExpansion = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const hasChildren = (process) => {
    return process.children && process.children.length > 0;
  };

  const renderProcessNode = (process, depth = 0, isLast = false, parentPath = []) => {
    const isExpanded = expandedNodes.has(process.id);
    const children = process.children || [];
    const nodeHasChildren = children.length > 0;
    
    return (
      <div key={process.id} className="tree-node">
        <div className="tree-line-container">
          {/* Tree connecting lines */}
          <div className="tree-lines">
            {parentPath.map((isParentLast, index) => (
              <div 
                key={index} 
                className={`tree-line ${isParentLast ? 'tree-line-empty' : 'tree-line-vertical'}`}
              />
            ))}
            {depth > 0 && (
              <div className={`tree-line ${isLast ? 'tree-line-last' : 'tree-line-branch'}`} />
            )}
          </div>
          
          {/* Node content */}
          <div className={`tree-node-content ${getLevelColor(process.level_number)}`}>
            {/* Expand/collapse button */}
            <div className="tree-node-toggle">
              {nodeHasChildren ? (
                <button
                  onClick={() => toggleExpansion(process.id)}
                  className="expand-btn"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className={isExpanded ? 'expanded' : ''}
                  >
                    <polyline points="9,18 15,12 9,6"/>
                  </svg>
                </button>
              ) : (
                <div className="tree-node-dot" />
              )}
            </div>
            
            {/* Process info */}
            <div className="tree-node-info">
              <div className="process-header">
                <span className={`process-level-badge level-${process.level_number}`}>
                  {getLevelLabel(process.level_number)}
                </span>
                <span className="process-code">{process.process_code}</span>
                <span className="process-name">{process.process_name}</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="tree-node-actions">
              <button
                onClick={() => handleEditProcess(process)}
                className="action-btn edit-btn"
                title="Edit process"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              
              {process.level_number < 3 && (
                <button
                  onClick={() => handleAddChild(process)}
                  className="action-btn add-btn"
                  title="Add child process"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
              )}
              
              <button
                onClick={() => handleDeleteProcess(process.id)}
                className="action-btn delete-btn"
                title="Delete process"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Children */}
        {nodeHasChildren && isExpanded && (
          <div className="tree-children">
            {children.map((child, index) => 
              renderProcessNode(
                child, 
                depth + 1, 
                index === children.length - 1,
                [...parentPath, isLast]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="hierarchy-manager-loading">
        <div className="loading-spinner"></div>
        <p>Loading process hierarchy manager...</p>
      </div>
    );
  }

  return (
    <div className="process-hierarchy-manager">
      {/* Header */}
      <div className="manager-header">
        <h1>Process Hierarchy Manager</h1>
        <p>Manage your L0/L1/L2/L3 process hierarchy structure</p>
      </div>

      {/* Assessment Selection */}
      <div className="assessment-selector">
        <label htmlFor="assessment-select">Select Assessment:</label>
        <select
          id="assessment-select"
          value={selectedAssessmentId}
          onChange={(e) => setSelectedAssessmentId(e.target.value)}
          className="assessment-select"
        >
          <option value="">Choose an assessment...</option>
          {assessments.map(assessment => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.name} ({assessment.status})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {selectedAssessmentId && (
        <>
          {/* Controls */}
          <div className="hierarchy-controls">
            <button
              onClick={() => {
                setFormData({
                  process_code: '',
                  process_name: '',
                  level_number: 0,
                  parent_id: '',
                  sort_order: 0
                });
                setEditingProcess(null);
                setShowAddForm(true);
              }}
              className="btn btn-primary"
            >
              Add Root Process (L0)
            </button>

            <div className="hierarchy-stats">
              <span>Total Processes: {flatProcesses.length}</span>
              <span>L0: {flatProcesses.filter(p => p.level_number === 0).length}</span>
              <span>L1: {flatProcesses.filter(p => p.level_number === 1).length}</span>
              <span>L2: {flatProcesses.filter(p => p.level_number === 2).length}</span>
              <span>L3: {flatProcesses.filter(p => p.level_number === 3).length}</span>
            </div>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="process-form">
              <h3>{editingProcess ? 'Edit Process' : 'Add New Process'}</h3>
              
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

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="process_code">Process Code *</label>
                  <input
                    type="text"
                    id="process_code"
                    value={formData.process_code}
                    onChange={(e) => handleFormChange('process_code', e.target.value)}
                    placeholder="e.g., 2.3.1, PRC-001, etc."
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="process_name">Process Name *</label>
                  <input
                    type="text"
                    id="process_name"
                    value={formData.process_name}
                    onChange={(e) => handleFormChange('process_name', e.target.value)}
                    placeholder="Enter process name"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="level_number">Level *</label>
                  <select
                    id="level_number"
                    value={formData.level_number}
                    onChange={(e) => handleFormChange('level_number', parseInt(e.target.value))}
                    className="form-select"
                  >
                    <option value={0}>L0 - High Level Process</option>
                    <option value={1}>L1 - Major Process</option>
                    <option value={2}>L2 - Sub Process</option>
                    <option value={3}>L3 - Detail Process</option>
                  </select>
                </div>

                {formData.level_number > 0 && (
                  <div className="form-group">
                    <label htmlFor="parent_id">Parent Process *</label>
                    <select
                      id="parent_id"
                      value={formData.parent_id}
                      onChange={(e) => handleFormChange('parent_id', e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select parent process...</option>
                      {getParentOptions().map(parent => (
                        <option key={parent.id} value={parent.id}>
                          {getLevelLabel(parent.level_number)} - {parent.process_code} - {parent.process_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="sort_order">Sort Order</label>
                  <input
                    type="number"
                    id="sort_order"
                    value={formData.sort_order}
                    onChange={(e) => handleFormChange('sort_order', parseInt(e.target.value) || 0)}
                    className="form-input"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button onClick={cancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveProcess} className="btn btn-primary">
                  {editingProcess ? 'Update Process' : 'Add Process'}
                </button>
              </div>
            </div>
          )}

          {/* Process Tree */}
          <div className="process-tree">
            <h3>Process Hierarchy</h3>
            
            {processTree.length === 0 ? (
              <div className="empty-hierarchy">
                <p>No processes defined yet. Add a root process to get started.</p>
              </div>
            ) : (
              <div className="compact-tree-container">
                {processTree.map((rootProcess, index) => 
                  renderProcessNode(
                    rootProcess, 
                    0, 
                    index === processTree.length - 1, 
                    []
                  )
                )}
              </div>
            )}
          </div>

          {/* Level Guide */}
          <div className="level-guide">
            <h4>Level Guide:</h4>
            <div className="guide-items">
              <div className="guide-item level-0">
                <strong>L0</strong> - High Level Process (e.g., "Sales Process")
              </div>
              <div className="guide-item level-1">
                <strong>L1</strong> - Major Process (e.g., "Lead Generation")
              </div>
              <div className="guide-item level-2">
                <strong>L2</strong> - Sub Process (e.g., "Qualify Leads")
              </div>
              <div className="guide-item level-3">
                <strong>L3</strong> - Detail Process (e.g., "Score Lead Quality")
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProcessHierarchyManager;