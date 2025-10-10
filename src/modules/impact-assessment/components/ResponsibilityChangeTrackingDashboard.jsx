import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { getStakeholders } from '@modules/stakeholders/services/stakeholderService';
import { 
  getRACISummary, 
  getProcessImpacts,
  getImpactColor,
  getImpactAssessments
} from '../services/impactAssessmentService';
import './ResponsibilityChangeTrackingDashboard.css';

/**
 * Responsibility Change Tracking Dashboard
 * Comprehensive dashboard for tracking responsibility changes across stakeholders and processes
 * Provides executive visibility into change management impact and readiness
 */
const ResponsibilityChangeTrackingDashboard = ({ assessmentId: propAssessmentId }) => {
  const { assessmentId: urlAssessmentId } = useParams();
  const assessmentId = propAssessmentId || urlAssessmentId;
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stakeholders: [],
    processImpacts: [],
    changes: [],
    summary: {},
    timeline: []
  });
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, high-impact, critical-changes
  const [selectedTimeframe, setSelectedTimeframe] = useState('current'); // current, upcoming, completed
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
      loadDashboardData();
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stakeholdersData, processImpactsData, raciSummaryData] = await Promise.all([
        getStakeholders(currentProject.id),
        getProcessImpacts(selectedAssessmentId),
        getRACISummary(selectedAssessmentId)
      ]);

      const processedData = processChangeData(stakeholdersData, processImpactsData, raciSummaryData);
      setDashboardData(processedData);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load responsibility change tracking data');
    } finally {
      setLoading(false);
    }
  };

  const processChangeData = (stakeholders, processImpacts, raciSummary) => {
    const changes = [];
    const changesByStakeholder = {};
    const changesByProcess = {};

    // Process all process impacts for RACI changes (simplified for text-based RACI)
    processImpacts.forEach(processImpact => {
      // Check if there are differences between As-Is and To-Be RACI text fields
      const hasRACIChange = (
        processImpact.as_is_raci_r !== processImpact.to_be_raci_r ||
        processImpact.as_is_raci_a !== processImpact.to_be_raci_a ||
        processImpact.as_is_raci_c !== processImpact.to_be_raci_c ||
        processImpact.as_is_raci_i !== processImpact.to_be_raci_i
      );

      if (hasRACIChange) {
        // Create a simplified change record for text-based RACI
        const change = {
          id: processImpact.process_id,
          process: {
            process_code: processImpact.process_code,
            process_name: processImpact.process_name
          },
          processImpact: processImpact,
          changeType: 'raci-change',
          changeDescription: getRACIChangeDescription(processImpact),
          impactLevel: processImpact.overall_impact_rating || 0,
          trainingRequired: false,
          readinessScore: 3, // Default readiness score
          priority: getChangePriority(processImpact.overall_impact_rating, 2),
          stakeholder: null // No specific stakeholder for text-based RACI
        };

        changes.push(change);

        // Group by process
        if (!changesByProcess[processImpact.process_id]) {
          changesByProcess[processImpact.process_id] = {
            process: {
              process_code: processImpact.process_code,
              process_name: processImpact.process_name
            },
            processImpact: processImpact,
            changes: [],
            totalChanges: 0,
            stakeholdersAffected: 1,
            averageReadiness: 3
          };
        }
        changesByProcess[processImpact.process_id].changes.push(change);
        changesByProcess[processImpact.process_id].totalChanges++;
      }
    });

    // Since we don't have individual stakeholder RACI assignments in the text-based approach,
    // we'll create a simplified structure
    processImpacts.forEach(processImpact => {
      if (processImpact.raci_assignments) {
        processImpact.raci_assignments.forEach(raci => {
          const hasChange = (
            raci.as_is_responsible !== raci.to_be_responsible ||
            raci.as_is_accountable !== raci.to_be_accountable ||
            raci.as_is_consulted !== raci.to_be_consulted ||
            raci.as_is_informed !== raci.to_be_informed
          );

          if (hasChange) {
            const change = {
              id: raci.id,
              stakeholder: raci.stakeholder,
              process: processImpact.process,
              processImpact: processImpact,
              changeType: getChangeType(raci),
              changeDescription: getChangeDescription(raci),
              impactLevel: raci.responsibility_change_impact || 0,
              trainingRequired: raci.training_requirements ? true : false,
              readinessScore: raci.change_readiness_score || 0,
              priority: getChangePriority(processImpact.overall_impact_rating, raci.responsibility_change_impact),
              raci: raci
            };

            changes.push(change);

            // Group by stakeholder
            if (!changesByStakeholder[raci.stakeholder_id]) {
              changesByStakeholder[raci.stakeholder_id] = {
                stakeholder: raci.stakeholder,
                changes: [],
                totalChanges: 0,
                highImpactChanges: 0,
                averageReadiness: 0,
                trainingNeeded: 0
              };
            }
            changesByStakeholder[raci.stakeholder_id].changes.push(change);
            changesByStakeholder[raci.stakeholder_id].totalChanges++;
            
            if (change.impactLevel >= 2) {
              changesByStakeholder[raci.stakeholder_id].highImpactChanges++;
            }
            
            if (change.trainingRequired) {
              changesByStakeholder[raci.stakeholder_id].trainingNeeded++;
            }

            // Group by process
            if (!changesByProcess[processImpact.id]) {
              changesByProcess[processImpact.id] = {
                process: processImpact.process,
                processImpact: processImpact,
                changes: [],
                totalChanges: 0,
                stakeholdersAffected: new Set(),
                averageReadiness: 0
              };
            }
            changesByProcess[processImpact.id].changes.push(change);
            changesByProcess[processImpact.id].totalChanges++;
            changesByProcess[processImpact.id].stakeholdersAffected.add(raci.stakeholder_id);
          }
        });
      }
    });

    // Calculate averages for stakeholders
    Object.values(changesByStakeholder).forEach(stakeholderData => {
      const readinessScores = stakeholderData.changes
        .map(c => c.readinessScore)
        .filter(score => score > 0);
      
      stakeholderData.averageReadiness = readinessScores.length > 0 
        ? readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length
        : 0;
    });

    // Calculate averages for processes
    Object.values(changesByProcess).forEach(processData => {
      const readinessScores = processData.changes
        .map(c => c.readinessScore)
        .filter(score => score > 0);
      
      processData.averageReadiness = readinessScores.length > 0 
        ? readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length
        : 0;
      
      processData.stakeholdersAffected = processData.stakeholdersAffected.size;
    });

    // Generate summary statistics
    const summary = {
      totalChanges: changes.length,
      stakeholdersAffected: Object.keys(changesByStakeholder).length,
      processesAffected: Object.keys(changesByProcess).length,
      highImpactChanges: changes.filter(c => c.impactLevel >= 2).length,
      criticalChanges: changes.filter(c => c.impactLevel >= 3).length,
      trainingRequired: changes.filter(c => c.trainingRequired).length,
      lowReadinessChanges: changes.filter(c => c.readinessScore > 0 && c.readinessScore <= 2).length,
      averageReadinessScore: calculateAverageReadiness(changes),
      changesByPriority: {
        critical: changes.filter(c => c.priority === 'critical').length,
        high: changes.filter(c => c.priority === 'high').length,
        medium: changes.filter(c => c.priority === 'medium').length,
        low: changes.filter(c => c.priority === 'low').length
      }
    };

    return {
      stakeholders,
      processImpacts,
      changes,
      changesByStakeholder: Object.values(changesByStakeholder),
      changesByProcess: Object.values(changesByProcess),
      summary,
      timeline: generateChangeTimeline(changes)
    };
  };

  const getChangeType = (raci) => {
    const asIsRoles = [];
    const toBeRoles = [];

    if (raci.as_is_responsible) asIsRoles.push('R');
    if (raci.as_is_accountable) asIsRoles.push('A');
    if (raci.as_is_consulted) asIsRoles.push('C');
    if (raci.as_is_informed) asIsRoles.push('I');

    if (raci.to_be_responsible) toBeRoles.push('R');
    if (raci.to_be_accountable) toBeRoles.push('A');
    if (raci.to_be_consulted) toBeRoles.push('C');
    if (raci.to_be_informed) toBeRoles.push('I');

    if (asIsRoles.length === 0) return 'new-role';
    if (toBeRoles.length === 0) return 'role-removal';
    if (asIsRoles.join('') !== toBeRoles.join('')) return 'role-change';
    return 'responsibility-shift';
  };

  const getChangeDescription = (raci) => {
    const asIsRoles = [];
    const toBeRoles = [];

    if (raci.as_is_responsible) asIsRoles.push('Responsible');
    if (raci.as_is_accountable) asIsRoles.push('Accountable');
    if (raci.as_is_consulted) asIsRoles.push('Consulted');
    if (raci.as_is_informed) asIsRoles.push('Informed');

    if (raci.to_be_responsible) toBeRoles.push('Responsible');
    if (raci.to_be_accountable) toBeRoles.push('Accountable');
    if (raci.to_be_consulted) toBeRoles.push('Consulted');
    if (raci.to_be_informed) toBeRoles.push('Informed');

    const asIsText = asIsRoles.length > 0 ? asIsRoles.join(', ') : 'No role';
    const toBeText = toBeRoles.length > 0 ? toBeRoles.join(', ') : 'No role';

    return `${asIsText} → ${toBeText}`;
  };

  const getChangePriority = (processImpact, changeImpact) => {
    const totalScore = (processImpact || 0) + (changeImpact || 0);
    if (totalScore >= 7) return 'critical';
    if (totalScore >= 5) return 'high';
    if (totalScore >= 3) return 'medium';
    return 'low';
  };

  const calculateAverageReadiness = (changes) => {
    const scoresWithValues = changes
      .map(c => c.readinessScore)
      .filter(score => score > 0);
    
    return scoresWithValues.length > 0 
      ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
      : 0;
  };

  const getRACIChangeDescription = (processImpact) => {
    const asIsRoles = [];
    const toBeRoles = [];

    if (processImpact.as_is_raci_r) asIsRoles.push(`R: ${processImpact.as_is_raci_r}`);
    if (processImpact.as_is_raci_a) asIsRoles.push(`A: ${processImpact.as_is_raci_a}`);
    if (processImpact.as_is_raci_c) asIsRoles.push(`C: ${processImpact.as_is_raci_c}`);
    if (processImpact.as_is_raci_i) asIsRoles.push(`I: ${processImpact.as_is_raci_i}`);

    if (processImpact.to_be_raci_r) toBeRoles.push(`R: ${processImpact.to_be_raci_r}`);
    if (processImpact.to_be_raci_a) toBeRoles.push(`A: ${processImpact.to_be_raci_a}`);
    if (processImpact.to_be_raci_c) toBeRoles.push(`C: ${processImpact.to_be_raci_c}`);
    if (processImpact.to_be_raci_i) toBeRoles.push(`I: ${processImpact.to_be_raci_i}`);

    const asIsText = asIsRoles.length > 0 ? asIsRoles.join(', ') : 'No RACI';
    const toBeText = toBeRoles.length > 0 ? toBeRoles.join(', ') : 'No RACI';

    return `${asIsText} → ${toBeText}`;
  };

  const generateChangeTimeline = (changes) => {
    // For now, return a simple timeline based on priority
    // In a real system, this would be based on actual implementation dates
    const timeline = [];
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    
    priorityOrder.forEach((priority, index) => {
      const priorityChanges = changes.filter(c => c.priority === priority);
      if (priorityChanges.length > 0) {
        timeline.push({
          phase: index + 1,
          priority,
          label: `Phase ${index + 1}: ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
          changes: priorityChanges,
          estimatedWeeks: (index + 1) * 2 // Simple estimation
        });
      }
    });

    return timeline;
  };

  const getFilteredChanges = () => {
    if (selectedFilter === 'high-impact') {
      return dashboardData.changes.filter(c => c.impactLevel >= 2);
    }
    if (selectedFilter === 'critical-changes') {
      return dashboardData.changes.filter(c => c.priority === 'critical' || c.priority === 'high');
    }
    return dashboardData.changes;
  };

  const getReadinessColor = (score) => {
    if (score === 0) return 'readiness-unknown';
    if (score <= 2) return 'readiness-low';
    if (score <= 3) return 'readiness-medium';
    return 'readiness-high';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading responsibility change tracking dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>Error: {error}</p>
        <button onClick={() => selectedAssessmentId ? loadDashboardData() : loadAssessments()} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (availableAssessments.length === 0) {
    return (
      <div className="no-changes-data">
        <h2>No Impact Assessments Found</h2>
        <p>No impact assessments have been created for this project yet.</p>
        <p>Create an assessment first to view responsibility change tracking.</p>
      </div>
    );
  }

  if (!selectedAssessmentId) {
    return (
      <div className="assessment-selection">
        <h3>Select an Assessment</h3>
        <p>Choose an assessment to view responsibility change tracking:</p>
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

  if (dashboardData.changes.length === 0) {
    return (
      <div className="no-changes-data">
        <h2>No Responsibility Changes Detected</h2>
        <p>No differences found between As-Is and To-Be RACI assignments.</p>
        <p>This could mean:</p>
        <ul>
          <li>No RACI assignments have been created yet</li>
          <li>All As-Is and To-Be roles are identical</li>
          <li>The change analysis is not yet complete</li>
        </ul>
      </div>
    );
  }

  const filteredChanges = getFilteredChanges();

  return (
    <div className="responsibility-change-tracking-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-info">
          <h1>Responsibility Change Tracking</h1>
          <p>Monitor and manage responsibility changes across stakeholders and processes</p>
        </div>

        <div className="dashboard-controls">
          <div className="filter-group">
            <label>Show:</label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Changes ({dashboardData.changes.length})</option>
              <option value="high-impact">High Impact ({dashboardData.changes.filter(c => c.impactLevel >= 2).length})</option>
              <option value="critical-changes">Critical/High Priority ({dashboardData.changes.filter(c => c.priority === 'critical' || c.priority === 'high').length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="executive-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Changes</h3>
            <div className="card-value">{dashboardData.summary.totalChanges}</div>
            <div className="card-subtitle">Responsibility changes identified</div>
          </div>

          <div className="summary-card">
            <h3>Stakeholders Affected</h3>
            <div className="card-value">{dashboardData.summary.stakeholdersAffected}</div>
            <div className="card-subtitle">People impacted by changes</div>
          </div>

          <div className="summary-card">
            <h3>Critical Changes</h3>
            <div className="card-value critical">{dashboardData.summary.criticalChanges}</div>
            <div className="card-subtitle">High-priority interventions needed</div>
          </div>

          <div className="summary-card">
            <h3>Training Required</h3>
            <div className="card-value warning">{dashboardData.summary.trainingRequired}</div>
            <div className="card-subtitle">Changes requiring training</div>
          </div>

          <div className="summary-card">
            <h3>Readiness Score</h3>
            <div className={`card-value ${getReadinessColor(dashboardData.summary.averageReadinessScore)}`}>
              {dashboardData.summary.averageReadinessScore.toFixed(1)}/5
            </div>
            <div className="card-subtitle">Average change readiness</div>
          </div>

          <div className="summary-card">
            <h3>Low Readiness</h3>
            <div className="card-value alert">{dashboardData.summary.lowReadinessChanges}</div>
            <div className="card-subtitle">Changes with readiness ≤ 2</div>
          </div>
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="priority-breakdown">
        <h2>Changes by Priority</h2>
        <div className="priority-bars">
          {Object.entries(dashboardData.summary.changesByPriority).map(([priority, count]) => (
            <div key={priority} className="priority-bar">
              <div className="bar-header">
                <span className="priority-label">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                <span className="priority-count">{count}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${(count / dashboardData.summary.totalChanges) * 100}%`,
                    backgroundColor: getPriorityColor(priority)
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Details Table */}
      <div className="changes-table-section">
        <h2>Change Details ({filteredChanges.length})</h2>
        
        <div className="table-container">
          <table className="changes-table">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Process</th>
                <th>Change Type</th>
                <th>Change Description</th>
                <th>Impact</th>
                <th>Priority</th>
                <th>Readiness</th>
                <th>Training</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.map((change, index) => (
                <tr key={index} className={`change-row priority-${change.priority}`}>
                  <td className="stakeholder-cell">
                    <div className="stakeholder-info">
                      <span className="stakeholder-name">{change.stakeholder?.name}</span>
                      <span className="stakeholder-title">{change.stakeholder?.title}</span>
                    </div>
                  </td>
                  
                  <td className="process-cell">
                    <div className="process-info">
                      <span className="process-code">{change.process?.process_code}</span>
                      <span className="process-name">{change.process?.process_name}</span>
                    </div>
                  </td>
                  
                  <td className="change-type">
                    <span className={`type-badge ${change.changeType}`}>
                      {change.changeType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </td>
                  
                  <td className="change-description">
                    {change.changeDescription}
                  </td>
                  
                  <td className="impact-cell">
                    <span className={`impact-badge ${getImpactColor(change.impactLevel)}`}>
                      {change.impactLevel}/3
                    </span>
                  </td>
                  
                  <td className="priority-cell">
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(change.priority) }}
                    >
                      {change.priority.charAt(0).toUpperCase() + change.priority.slice(1)}
                    </span>
                  </td>
                  
                  <td className="readiness-cell">
                    <span className={`readiness-badge ${getReadinessColor(change.readinessScore)}`}>
                      {change.readinessScore > 0 ? `${change.readinessScore}/5` : 'N/A'}
                    </span>
                  </td>
                  
                  <td className="training-cell">
                    {change.trainingRequired ? (
                      <span className="training-required">Yes</span>
                    ) : (
                      <span className="training-not-required">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Implementation Timeline */}
      <div className="implementation-timeline">
        <h2>Suggested Implementation Timeline</h2>
        <div className="timeline-phases">
          {dashboardData.timeline.map((phase, index) => (
            <div key={index} className="timeline-phase">
              <div className="phase-header">
                <div className="phase-number">{phase.phase}</div>
                <div className="phase-info">
                  <h3>{phase.label}</h3>
                  <span className="phase-duration">~{phase.estimatedWeeks} weeks</span>
                  <span className="phase-count">{phase.changes.length} changes</span>
                </div>
              </div>
              
              <div className="phase-changes">
                {phase.changes.slice(0, 5).map((change, changeIndex) => (
                  <div key={changeIndex} className="timeline-change">
                    <span className="change-stakeholder">{change.stakeholder?.name}</span>
                    <span className="change-process">{change.process?.process_code}</span>
                    <span className="change-type">{change.changeType}</span>
                  </div>
                ))}
                {phase.changes.length > 5 && (
                  <div className="timeline-more">+{phase.changes.length - 5} more changes</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResponsibilityChangeTrackingDashboard;