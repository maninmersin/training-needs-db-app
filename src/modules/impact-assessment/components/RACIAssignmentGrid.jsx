import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { getStakeholders } from '@modules/stakeholders/services/stakeholderService';
import { 
  getProcessRACIAssignments, 
  upsertRACIAssignment, 
  deleteRACIAssignment,
  validateRACIAssignments
} from '../services/impactAssessmentService';
import './RACIAssignmentGrid.css';

/**
 * RACI Assignment Grid Component
 * Interactive grid for assigning Responsible, Accountable, Consulted, and Informed roles 
 * to stakeholders for a specific process with As-Is vs To-Be comparison
 */
const RACIAssignmentGrid = ({ processImpactId, processName, onAssignmentsChange }) => {
  const { currentProject } = useProject();
  const [stakeholders, setStakeholders] = useState([]);
  const [raciAssignments, setRaciAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState('');
  const [viewMode, setViewMode] = useState('as-is'); // as-is, to-be, comparison

  useEffect(() => {
    if (currentProject?.id && processImpactId) {
      loadData();
    }
  }, [currentProject?.id, processImpactId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stakeholdersData, raciData] = await Promise.all([
        getStakeholders(currentProject.id),
        getProcessRACIAssignments(processImpactId)
      ]);

      setStakeholders(stakeholdersData || []);
      setRaciAssignments(raciData || []);

      // Validate assignments
      const errors = validateRACIAssignments(raciData || []);
      setValidationErrors(errors);

    } catch (err) {
      console.error('Error loading RACI data:', err);
      setError(err.message || 'Failed to load RACI assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleRACIChange = async (stakeholderId, raciType, checked) => {
    try {
      const existingAssignment = raciAssignments.find(
        raci => raci.stakeholder_id === stakeholderId
      );

      const updatedAssignment = {
        id: existingAssignment?.id,
        process_impact_id: processImpactId,
        stakeholder_id: stakeholderId,
        // Preserve existing values
        as_is_responsible: existingAssignment?.as_is_responsible || false,
        as_is_accountable: existingAssignment?.as_is_accountable || false,
        as_is_consulted: existingAssignment?.as_is_consulted || false,
        as_is_informed: existingAssignment?.as_is_informed || false,
        to_be_responsible: existingAssignment?.to_be_responsible || false,
        to_be_accountable: existingAssignment?.to_be_accountable || false,
        to_be_consulted: existingAssignment?.to_be_consulted || false,
        to_be_informed: existingAssignment?.to_be_informed || false,
        // Update the specific field
        [raciType]: checked
      };

      const savedAssignment = await upsertRACIAssignment(updatedAssignment);

      // Update local state
      const updatedAssignments = existingAssignment 
        ? raciAssignments.map(raci => 
            raci.stakeholder_id === stakeholderId ? savedAssignment : raci
          )
        : [...raciAssignments, savedAssignment];

      setRaciAssignments(updatedAssignments);

      // Validate and notify parent
      const errors = validateRACIAssignments(updatedAssignments);
      setValidationErrors(errors);
      
      if (onAssignmentsChange) {
        onAssignmentsChange(updatedAssignments, errors);
      }

    } catch (err) {
      console.error('Error updating RACI assignment:', err);
      setError(err.message || 'Failed to update RACI assignment');
    }
  };

  const addStakeholder = async () => {
    if (!selectedStakeholder) return;

    try {
      const newAssignment = {
        process_impact_id: processImpactId,
        stakeholder_id: parseInt(selectedStakeholder),
        as_is_responsible: false,
        as_is_accountable: false,
        as_is_consulted: false,
        as_is_informed: false,
        to_be_responsible: false,
        to_be_accountable: false,
        to_be_consulted: false,
        to_be_informed: false
      };

      const savedAssignment = await upsertRACIAssignment(newAssignment);
      setRaciAssignments([...raciAssignments, savedAssignment]);
      setSelectedStakeholder('');

      if (onAssignmentsChange) {
        onAssignmentsChange([...raciAssignments, savedAssignment], validationErrors);
      }

    } catch (err) {
      console.error('Error adding stakeholder:', err);
      setError(err.message || 'Failed to add stakeholder');
    }
  };

  const removeStakeholder = async (raciId) => {
    try {
      await deleteRACIAssignment(raciId);
      
      const updatedAssignments = raciAssignments.filter(raci => raci.id !== raciId);
      setRaciAssignments(updatedAssignments);

      const errors = validateRACIAssignments(updatedAssignments);
      setValidationErrors(errors);

      if (onAssignmentsChange) {
        onAssignmentsChange(updatedAssignments, errors);
      }

    } catch (err) {
      console.error('Error removing stakeholder:', err);
      setError(err.message || 'Failed to remove stakeholder');
    }
  };

  const getRACIValue = (stakeholderId, raciType) => {
    const assignment = raciAssignments.find(
      raci => raci.stakeholder_id === stakeholderId
    );
    return assignment?.[raciType] || false;
  };

  const hasResponsibilityChange = (stakeholderId) => {
    const assignment = raciAssignments.find(
      raci => raci.stakeholder_id === stakeholderId
    );
    
    if (!assignment) return false;

    return (
      assignment.as_is_responsible !== assignment.to_be_responsible ||
      assignment.as_is_accountable !== assignment.to_be_accountable ||
      assignment.as_is_consulted !== assignment.to_be_consulted ||
      assignment.as_is_informed !== assignment.to_be_informed
    );
  };

  const assignedStakeholderIds = raciAssignments.map(raci => raci.stakeholder_id);
  const availableStakeholders = stakeholders.filter(
    stakeholder => !assignedStakeholderIds.includes(stakeholder.id)
  );

  if (loading) {
    return (
      <div className="raci-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading RACI assignments...</p>
      </div>
    );
  }

  return (
    <div className="raci-assignment-grid">
      <div className="raci-header">
        <h3>RACI Assignments for {processName}</h3>
        <div className="raci-controls">
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${viewMode === 'as-is' ? 'active' : ''}`}
              onClick={() => setViewMode('as-is')}
            >
              As-Is
            </button>
            <button
              className={`toggle-btn ${viewMode === 'to-be' ? 'active' : ''}`}
              onClick={() => setViewMode('to-be')}
            >
              To-Be
            </button>
            <button
              className={`toggle-btn ${viewMode === 'comparison' ? 'active' : ''}`}
              onClick={() => setViewMode('comparison')}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="raci-error">
          <p>Error: {error}</p>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="raci-validation-errors">
          <h4>Validation Issues:</h4>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="stakeholder-add-section">
        <select
          value={selectedStakeholder}
          onChange={(e) => setSelectedStakeholder(e.target.value)}
          className="stakeholder-select"
        >
          <option value="">Add Stakeholder to RACI...</option>
          {availableStakeholders.map(stakeholder => (
            <option key={stakeholder.id} value={stakeholder.id}>
              {stakeholder.name} - {stakeholder.title || 'No title'}
            </option>
          ))}
        </select>
        <button
          onClick={addStakeholder}
          disabled={!selectedStakeholder}
          className="add-stakeholder-btn"
        >
          Add
        </button>
      </div>

      <div className="raci-grid-container">
        {viewMode === 'comparison' ? (
          // Comparison view showing both As-Is and To-Be
          <div className="raci-comparison-grid">
            <div className="comparison-header">
              <div className="stakeholder-column">Stakeholder</div>
              <div className="as-is-section">
                <div className="section-title">As-Is</div>
                <div className="raci-columns">
                  <div className="raci-col">R</div>
                  <div className="raci-col">A</div>
                  <div className="raci-col">C</div>
                  <div className="raci-col">I</div>
                </div>
              </div>
              <div className="to-be-section">
                <div className="section-title">To-Be</div>
                <div className="raci-columns">
                  <div className="raci-col">R</div>
                  <div className="raci-col">A</div>
                  <div className="raci-col">C</div>
                  <div className="raci-col">I</div>
                </div>
              </div>
              <div className="actions-column">Actions</div>
            </div>

            {raciAssignments.map(raci => (
              <div
                key={raci.id}
                className={`raci-comparison-row ${hasResponsibilityChange(raci.stakeholder_id) ? 'has-change' : ''}`}
              >
                <div className="stakeholder-info">
                  <div className="stakeholder-name">{raci.stakeholder?.name}</div>
                  <div className="stakeholder-title">{raci.stakeholder?.title}</div>
                  {hasResponsibilityChange(raci.stakeholder_id) && (
                    <span className="change-indicator">Changed</span>
                  )}
                </div>

                <div className="as-is-section">
                  <div className="raci-columns">
                    {['as_is_responsible', 'as_is_accountable', 'as_is_consulted', 'as_is_informed'].map(raciType => (
                      <div key={raciType} className="raci-col">
                        <input
                          type="checkbox"
                          checked={getRACIValue(raci.stakeholder_id, raciType)}
                          onChange={(e) => handleRACIChange(raci.stakeholder_id, raciType, e.target.checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="to-be-section">
                  <div className="raci-columns">
                    {['to_be_responsible', 'to_be_accountable', 'to_be_consulted', 'to_be_informed'].map(raciType => (
                      <div key={raciType} className="raci-col">
                        <input
                          type="checkbox"
                          checked={getRACIValue(raci.stakeholder_id, raciType)}
                          onChange={(e) => handleRACIChange(raci.stakeholder_id, raciType, e.target.checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="actions-column">
                  <button
                    onClick={() => removeStakeholder(raci.id)}
                    className="remove-btn"
                    title="Remove stakeholder from RACI"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Single view (As-Is or To-Be)
          <div className="raci-single-grid">
            <div className="grid-header">
              <div className="stakeholder-column">Stakeholder</div>
              <div className="raci-col">Responsible</div>
              <div className="raci-col">Accountable</div>
              <div className="raci-col">Consulted</div>
              <div className="raci-col">Informed</div>
              <div className="actions-column">Actions</div>
            </div>

            {raciAssignments.map(raci => {
              const prefix = viewMode === 'as-is' ? 'as_is_' : 'to_be_';
              return (
                <div key={raci.id} className="raci-row">
                  <div className="stakeholder-info">
                    <div className="stakeholder-name">{raci.stakeholder?.name}</div>
                    <div className="stakeholder-title">{raci.stakeholder?.title}</div>
                  </div>

                  {['responsible', 'accountable', 'consulted', 'informed'].map(raciType => (
                    <div key={raciType} className="raci-col">
                      <input
                        type="checkbox"
                        checked={getRACIValue(raci.stakeholder_id, `${prefix}${raciType}`)}
                        onChange={(e) => handleRACIChange(raci.stakeholder_id, `${prefix}${raciType}`, e.target.checked)}
                      />
                    </div>
                  ))}

                  <div className="actions-column">
                    <button
                      onClick={() => removeStakeholder(raci.id)}
                      className="remove-btn"
                      title="Remove stakeholder from RACI"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {raciAssignments.length === 0 && (
        <div className="no-assignments">
          <p>No RACI assignments yet. Add stakeholders above to define responsibilities.</p>
        </div>
      )}

      <div className="raci-legend">
        <h4>RACI Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <strong>R</strong> - Responsible: Those who do the work
          </div>
          <div className="legend-item">
            <strong>A</strong> - Accountable: The one ultimately answerable (only one per process)
          </div>
          <div className="legend-item">
            <strong>C</strong> - Consulted: Those who provide input
          </div>
          <div className="legend-item">
            <strong>I</strong> - Informed: Those who are kept updated
          </div>
        </div>
      </div>
    </div>
  );
};

export default RACIAssignmentGrid;