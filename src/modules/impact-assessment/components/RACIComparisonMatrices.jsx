import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { getStakeholders } from '@modules/stakeholders/services/stakeholderService';
import { 
  getProcessImpacts,
  getRACISummary,
  getImpactColor,
  getImpactAssessments
} from '../services/impactAssessmentService';
import './RACIComparisonMatrices.css';

/**
 * RACI Comparison Matrices Component
 * Side-by-side comparison of As-Is vs To-Be RACI assignments
 * Shows detailed changes at the process and stakeholder level
 */
const RACIComparisonMatrices = ({ assessmentId: propAssessmentId }) => {
  const { assessmentId: urlAssessmentId } = useParams();
  const assessmentId = propAssessmentId || urlAssessmentId;
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState({
    processes: [],
    stakeholders: [],
    raciMatrix: {},
    changesSummary: {}
  });
  const [viewMode, setViewMode] = useState('by-process'); // by-process, by-stakeholder, changes-only
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [filterChangesOnly, setFilterChangesOnly] = useState(false);
  const [error, setError] = useState(null);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessmentId || '');

  useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (currentProject?.id && selectedAssessmentId) {
      loadComparisonData();
    } else {
      setLoading(false);
    }
  }, [currentProject?.id, selectedAssessmentId]);

  const loadAssessments = async () => {
    try {
      const assessmentsData = await getImpactAssessments(currentProject.id);
      setAvailableAssessments(assessmentsData || []);
      
      if (!selectedAssessmentId && assessmentsData && assessmentsData.length > 0) {
        setSelectedAssessmentId(assessmentsData[0].id);
      }
    } catch (err) {
      console.error('Error loading assessments:', err);
      setError(`Failed to load assessments: ${err.message}`);
      setLoading(false);
    }
  };

  const loadComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stakeholdersData, processImpactsData, raciSummaryData] = await Promise.all([
        getStakeholders(currentProject.id),
        getProcessImpacts(selectedAssessmentId),
        getRACISummary(selectedAssessmentId)
      ]);

      const processedData = processComparisonData(stakeholdersData, processImpactsData, raciSummaryData);
      setComparisonData(processedData);

    } catch (err) {
      console.error('Error loading comparison data:', err);
      setError(err.message || 'Failed to load RACI comparison data');
    } finally {
      setLoading(false);
    }
  };

  const processComparisonData = (stakeholders, processImpacts, raciSummary) => {
    const raciMatrix = {};
    const changesSummary = {
      totalChanges: 0,
      processesWithChanges: new Set(),
      stakeholdersWithChanges: 0,
      changesByType: {}
    };

    // Build simplified RACI matrix for text-based RACI fields
    processImpacts.forEach(processImpact => {
      const processKey = processImpact.process_code || processImpact.process_id;
      
      // Check if there are RACI changes in text fields
      const hasChanges = (
        processImpact.as_is_raci_r !== processImpact.to_be_raci_r ||
        processImpact.as_is_raci_a !== processImpact.to_be_raci_a ||
        processImpact.as_is_raci_c !== processImpact.to_be_raci_c ||
        processImpact.as_is_raci_i !== processImpact.to_be_raci_i
      );

      if (processImpact.as_is_raci_r || processImpact.as_is_raci_a || 
          processImpact.as_is_raci_c || processImpact.as_is_raci_i ||
          processImpact.to_be_raci_r || processImpact.to_be_raci_a || 
          processImpact.to_be_raci_c || processImpact.to_be_raci_i) {
        
        raciMatrix[processKey] = {
          process: {
            process_code: processImpact.process_code,
            process_name: processImpact.process_name
          },
          processImpact: processImpact,
          hasChanges: hasChanges,
          asIsRaci: {
            responsible: processImpact.as_is_raci_r || '',
            accountable: processImpact.as_is_raci_a || '',
            consulted: processImpact.as_is_raci_c || '',
            informed: processImpact.as_is_raci_i || ''
          },
          toBeRaci: {
            responsible: processImpact.to_be_raci_r || '',
            accountable: processImpact.to_be_raci_a || '',
            consulted: processImpact.to_be_raci_c || '',
            informed: processImpact.to_be_raci_i || ''
          },
          changeDescription: hasChanges ? getProcessRACIChangeDescription(processImpact) : 'No changes'
        };

        if (hasChanges) {
          changesSummary.totalChanges++;
          changesSummary.processesWithChanges.add(processKey);
          changesSummary.changesByType['raci-change'] = (changesSummary.changesByType['raci-change'] || 0) + 1;
        }
      }
    });

    // Convert sets to counts
    changesSummary.processesWithChanges = changesSummary.processesWithChanges.size;

    return {
      processes: processImpacts.filter(p => 
        p.as_is_raci_r || p.as_is_raci_a || p.as_is_raci_c || p.as_is_raci_i ||
        p.to_be_raci_r || p.to_be_raci_a || p.to_be_raci_c || p.to_be_raci_i
      ),
      stakeholders: [], // Not applicable for text-based RACI
      raciMatrix,
      changesSummary
    };
  };

  const getProcessRACIChangeDescription = (processImpact) => {
    const changes = [];
    
    if (processImpact.as_is_raci_r !== processImpact.to_be_raci_r) {
      changes.push(`R: "${processImpact.as_is_raci_r || 'None'}" → "${processImpact.to_be_raci_r || 'None'}"`);
    }
    if (processImpact.as_is_raci_a !== processImpact.to_be_raci_a) {
      changes.push(`A: "${processImpact.as_is_raci_a || 'None'}" → "${processImpact.to_be_raci_a || 'None'}"`);
    }
    if (processImpact.as_is_raci_c !== processImpact.to_be_raci_c) {
      changes.push(`C: "${processImpact.as_is_raci_c || 'None'}" → "${processImpact.to_be_raci_c || 'None'}"`);
    }
    if (processImpact.as_is_raci_i !== processImpact.to_be_raci_i) {
      changes.push(`I: "${processImpact.as_is_raci_i || 'None'}" → "${processImpact.to_be_raci_i || 'None'}"`);
    }

    return changes.join('; ');
  };

  const hasRACIChange = (raci) => {
    return (
      raci.as_is_responsible !== raci.to_be_responsible ||
      raci.as_is_accountable !== raci.to_be_accountable ||
      raci.as_is_consulted !== raci.to_be_consulted ||
      raci.as_is_informed !== raci.to_be_informed
    );
  };

  const getRACIChangeType = (raci) => {
    const asIsRoles = getRACIRoles(raci, 'as_is');
    const toBeRoles = getRACIRoles(raci, 'to_be');
    
    if (asIsRoles.length === 0) return 'new-assignment';
    if (toBeRoles.length === 0) return 'removed-assignment';
    if (asIsRoles.join('') !== toBeRoles.join('')) return 'role-change';
    return 'no-change';
  };

  const getRACIChangeDescription = (raci) => {
    const asIsRoles = getRACIRoles(raci, 'as_is');
    const toBeRoles = getRACIRoles(raci, 'to_be');
    
    const asIsText = asIsRoles.length > 0 ? asIsRoles.join('') : '—';
    const toBeText = toBeRoles.length > 0 ? toBeRoles.join('') : '—';
    
    return `${asIsText} → ${toBeText}`;
  };

  const getRACIRoles = (raci, period) => {
    const roles = [];
    const prefix = period === 'as_is' ? 'as_is_' : 'to_be_';
    
    if (raci[`${prefix}responsible`]) roles.push('R');
    if (raci[`${prefix}accountable`]) roles.push('A');
    if (raci[`${prefix}consulted`]) roles.push('C');
    if (raci[`${prefix}informed`]) roles.push('I');
    
    return roles;
  };

  const getRACIDisplayValue = (raci, period) => {
    const roles = getRACIRoles(raci, period);
    return roles.length > 0 ? roles.join('') : '—';
  };

  const getChangeTypeColor = (changeType) => {
    switch (changeType) {
      case 'new-assignment': return '#10b981';
      case 'removed-assignment': return '#ef4444';
      case 'role-change': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getFilteredProcesses = () => {
    if (!filterChangesOnly) return comparisonData.processes;
    
    return comparisonData.processes.filter(processImpact => {
      const processKey = processImpact.process?.process_code || processImpact.id;
      const processData = comparisonData.raciMatrix[processKey];
      
      return processData && Object.values(processData.stakeholderAssignments)
        .some(assignment => assignment.hasChange);
    });
  };

  const getFilteredStakeholders = () => {
    if (!filterChangesOnly) return comparisonData.stakeholders;
    
    return comparisonData.stakeholders.filter(stakeholder => {
      return Object.values(comparisonData.raciMatrix)
        .some(processData => {
          const assignment = processData.stakeholderAssignments[stakeholder.id];
          return assignment && assignment.hasChange;
        });
    });
  };

  if (loading) {
    return (
      <div className="matrices-loading">
        <div className="loading-spinner"></div>
        <p>Loading RACI comparison matrices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matrices-error">
        <p>Error: {error}</p>
        <button onClick={() => selectedAssessmentId ? loadComparisonData() : loadAssessments()} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (availableAssessments.length === 0) {
    return (
      <div className="no-matrices-data">
        <h2>No Impact Assessments Found</h2>
        <p>No impact assessments have been created for this project yet.</p>
        <p>Create an assessment first to view RACI comparison matrices.</p>
      </div>
    );
  }

  if (!selectedAssessmentId) {
    return (
      <div className="assessment-selection">
        <h3>Select an Assessment</h3>
        <p>Choose an assessment to view RACI comparison matrices:</p>
        <select 
          value={selectedAssessmentId} 
          onChange={(e) => setSelectedAssessmentId(e.target.value)}
          className="assessment-select"
        >
          <option value="">Choose an assessment...</option>
          {availableAssessments.map(assessment => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.name} ({assessment.status})
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (Object.keys(comparisonData.raciMatrix).length === 0) {
    return (
      <div className="no-matrices-data">
        <h2>No RACI Assignments Available</h2>
        <p>No RACI assignments have been created for this assessment yet.</p>
        <p>Complete RACI assignments for processes to enable comparison matrices.</p>
      </div>
    );
  }

  const filteredProcesses = getFilteredProcesses();
  const filteredStakeholders = getFilteredStakeholders();

  return (
    <div className="raci-comparison-matrices">
      {/* Header */}
      <div className="matrices-header">
        <div className="header-info">
          <h2>RACI Comparison Matrices</h2>
          <p>As-Is vs To-Be responsibility assignments with change tracking</p>
        </div>

        <div className="matrices-controls">
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${viewMode === 'by-process' ? 'active' : ''}`}
              onClick={() => setViewMode('by-process')}
            >
              By Process
            </button>
            <button
              className={`toggle-btn ${viewMode === 'by-stakeholder' ? 'active' : ''}`}
              onClick={() => setViewMode('by-stakeholder')}
            >
              By Stakeholder
            </button>
            <button
              className={`toggle-btn ${viewMode === 'changes-only' ? 'active' : ''}`}
              onClick={() => setViewMode('changes-only')}
            >
              Changes Summary
            </button>
          </div>

          <div className="filter-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filterChangesOnly}
                onChange={(e) => setFilterChangesOnly(e.target.checked)}
              />
              <span>Show only items with changes</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="changes-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{comparisonData.changesSummary.totalChanges}</span>
            <span className="stat-label">Total Changes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{comparisonData.changesSummary.processesWithChanges}</span>
            <span className="stat-label">Processes Affected</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{comparisonData.changesSummary.stakeholdersWithChanges}</span>
            <span className="stat-label">Stakeholders Affected</span>
          </div>
        </div>
      </div>

      {/* By Process View */}
      {viewMode === 'by-process' && (
        <div className="by-process-view">
          <h3>RACI Matrix by Process ({Object.keys(comparisonData.raciMatrix).length})</h3>
          
          {Object.entries(comparisonData.raciMatrix).map(([processKey, processData]) => {
            if (filterChangesOnly && !processData.hasChanges) return null;
            
            return (
              <div key={processKey} className="process-matrix">
                <div className="process-header">
                  <div className="process-info">
                    <span className="process-code">{processData.process.process_code}</span>
                    <span className="process-name">{processData.process.process_name}</span>
                    <span className={`impact-badge ${getImpactColor(processData.processImpact.overall_impact_rating)}`}>
                      Impact: {processData.processImpact.overall_impact_rating}/5
                    </span>
                  </div>
                  {processData.hasChanges && (
                    <span className="changes-badge">Has changes</span>
                  )}
                </div>

                <div className="comparison-table-container">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th className="raci-type-col">RACI Role</th>
                        <th className="as-is-col">As-Is Assignment</th>
                        <th className="to-be-col">To-Be Assignment</th>
                        <th className="change-col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={processData.asIsRaci.responsible !== processData.toBeRaci.responsible ? 'has-change' : ''}>
                        <td className="raci-type"><strong>Responsible</strong></td>
                        <td className="raci-cell as-is">
                          <span className="raci-value">{processData.asIsRaci.responsible || '—'}</span>
                        </td>
                        <td className="raci-cell to-be">
                          <span className="raci-value">{processData.toBeRaci.responsible || '—'}</span>
                        </td>
                        <td className="change-cell">
                          {processData.asIsRaci.responsible !== processData.toBeRaci.responsible ? (
                            <span className="change-indicator" style={{ backgroundColor: '#f59e0b' }}>
                              Changed
                            </span>
                          ) : (
                            <span className="no-change">No Change</span>
                          )}
                        </td>
                      </tr>
                      
                      <tr className={processData.asIsRaci.accountable !== processData.toBeRaci.accountable ? 'has-change' : ''}>
                        <td className="raci-type"><strong>Accountable</strong></td>
                        <td className="raci-cell as-is">
                          <span className="raci-value">{processData.asIsRaci.accountable || '—'}</span>
                        </td>
                        <td className="raci-cell to-be">
                          <span className="raci-value">{processData.toBeRaci.accountable || '—'}</span>
                        </td>
                        <td className="change-cell">
                          {processData.asIsRaci.accountable !== processData.toBeRaci.accountable ? (
                            <span className="change-indicator" style={{ backgroundColor: '#f59e0b' }}>
                              Changed
                            </span>
                          ) : (
                            <span className="no-change">No Change</span>
                          )}
                        </td>
                      </tr>
                      
                      <tr className={processData.asIsRaci.consulted !== processData.toBeRaci.consulted ? 'has-change' : ''}>
                        <td className="raci-type"><strong>Consulted</strong></td>
                        <td className="raci-cell as-is">
                          <span className="raci-value">{processData.asIsRaci.consulted || '—'}</span>
                        </td>
                        <td className="raci-cell to-be">
                          <span className="raci-value">{processData.toBeRaci.consulted || '—'}</span>
                        </td>
                        <td className="change-cell">
                          {processData.asIsRaci.consulted !== processData.toBeRaci.consulted ? (
                            <span className="change-indicator" style={{ backgroundColor: '#f59e0b' }}>
                              Changed
                            </span>
                          ) : (
                            <span className="no-change">No Change</span>
                          )}
                        </td>
                      </tr>
                      
                      <tr className={processData.asIsRaci.informed !== processData.toBeRaci.informed ? 'has-change' : ''}>
                        <td className="raci-type"><strong>Informed</strong></td>
                        <td className="raci-cell as-is">
                          <span className="raci-value">{processData.asIsRaci.informed || '—'}</span>
                        </td>
                        <td className="raci-cell to-be">
                          <span className="raci-value">{processData.toBeRaci.informed || '—'}</span>
                        </td>
                        <td className="change-cell">
                          {processData.asIsRaci.informed !== processData.toBeRaci.informed ? (
                            <span className="change-indicator" style={{ backgroundColor: '#f59e0b' }}>
                              Changed
                            </span>
                          ) : (
                            <span className="no-change">No Change</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {processData.hasChanges && (
                  <div className="change-summary">
                    <p><strong>Summary:</strong> {processData.changeDescription}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By Stakeholder View */}
      {viewMode === 'by-stakeholder' && (
        <div className="by-stakeholder-view">
          <div className="stakeholder-view-notice">
            <h3>By Stakeholder View</h3>
            <p>This view is not available with text-based RACI assignments.</p>
            <p>The current system uses simple text fields for RACI roles rather than individual stakeholder assignments.</p>
            <p>Use the "By Process" view to see RACI assignments for each process.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setViewMode('by-process')}
            >
              View By Process
            </button>
          </div>
        </div>
      )}

      {/* Changes Summary View */}
      {viewMode === 'changes-only' && (
        <div className="changes-only-view">
          <h3>Changes Summary</h3>
          
          <div className="change-types-breakdown">
            <h4>Changes by Type</h4>
            <div className="change-types-list">
              {Object.entries(comparisonData.changesSummary.changesByType).map(([type, count]) => (
                <div key={type} className="change-type-item">
                  <span 
                    className="change-type-color"
                    style={{ backgroundColor: getChangeTypeColor(type) }}
                  ></span>
                  <span className="change-type-label">
                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <span className="change-type-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="all-changes-table">
            <h4>Processes with RACI Changes</h4>
            <div className="table-container">
              <table className="changes-detail-table">
                <thead>
                  <tr>
                    <th>Process</th>
                    <th>Impact Rating</th>
                    <th>Change Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(comparisonData.raciMatrix)
                    .filter(([processKey, processData]) => processData.hasChanges)
                    .map(([processKey, processData]) => (
                      <tr key={processKey} className="change-detail-row">
                        <td className="process-cell">
                          <div className="process-code">{processData.process.process_code}</div>
                          <div className="process-name">{processData.process.process_name}</div>
                        </td>
                        
                        <td className="impact-cell">
                          <span className={`impact-value ${getImpactColor(processData.processImpact.overall_impact_rating)}`}>
                            {processData.processImpact.overall_impact_rating}/5
                          </span>
                        </td>
                        
                        <td className="change-details-cell">
                          <div className="change-description">
                            {processData.changeDescription}
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
          
          {comparisonData.changesSummary.totalChanges === 0 && (
            <div className="no-changes-notice">
              <p>No RACI changes detected between As-Is and To-Be states.</p>
              <p>All RACI assignments are identical across both states.</p>
            </div>
          )}
        </div>
      )}

      {/* RACI Legend */}
      <div className="raci-legend">
        <h4>RACI Legend</h4>
        <div className="legend-grid">
          <div className="legend-item">
            <strong>R</strong> - Responsible: Does the work
          </div>
          <div className="legend-item">
            <strong>A</strong> - Accountable: Ultimately answerable
          </div>
          <div className="legend-item">
            <strong>C</strong> - Consulted: Provides input
          </div>
          <div className="legend-item">
            <strong>I</strong> - Informed: Kept in the loop
          </div>
        </div>
      </div>
    </div>
  );
};

export default RACIComparisonMatrices;