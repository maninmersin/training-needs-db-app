import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { getStakeholders } from '@modules/stakeholders/services/stakeholderService';
import { 
  getRACISummary, 
  getProcessImpacts,
  getImpactColor,
  getImpactRatingDescription,
  getImpactAssessments
} from '../services/impactAssessmentService';
import './StakeholderImpactCorrelationView.css';

/**
 * Simplified Stakeholder Impact Correlation View
 * Shows RACI statistics and process impacts in a simplified format
 * that works with text-based RACI fields
 */
const StakeholderImpactCorrelationView = ({ assessmentId: propAssessmentId }) => {
  console.log('🚀 StakeholderImpactCorrelationView component mounted');
  
  const { assessmentId: urlAssessmentId } = useParams();
  const assessmentId = propAssessmentId || urlAssessmentId;
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [stakeholders, setStakeholders] = useState([]);
  const [processImpacts, setProcessImpacts] = useState([]);
  const [raciSummary, setRaciSummary] = useState({});
  const [error, setError] = useState(null);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessmentId || '');

  console.log('🔍 Component state:', {
    assessmentId,
    propAssessmentId,
    urlAssessmentId,
    currentProject: currentProject?.id,
    loading,
    error
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  useEffect(() => {
    console.log('🔄 useEffect triggered for data loading:', { 
      projectId: currentProject?.id, 
      selectedAssessmentId,
      willLoad: !!(currentProject?.id && selectedAssessmentId)
    });
    
    if (currentProject?.id && selectedAssessmentId) {
      loadData();
    } else {
      console.log('⚠️ Missing required data:', {
        projectId: currentProject?.id,
        selectedAssessmentId
      });
      setLoading(false);
    }
  }, [currentProject?.id, selectedAssessmentId]);

  const loadAssessments = async () => {
    try {
      console.log('📋 Loading available assessments...');
      const assessmentsData = await getImpactAssessments(currentProject.id);
      console.log('✅ Assessments loaded:', assessmentsData?.length || 0, 'items');
      
      setAvailableAssessments(assessmentsData || []);
      
      // Auto-select first assessment if none is selected
      if (!selectedAssessmentId && assessmentsData && assessmentsData.length > 0) {
        console.log('🎯 Auto-selecting first assessment:', assessmentsData[0].name);
        setSelectedAssessmentId(assessmentsData[0].id);
      }
    } catch (err) {
      console.error('❌ Error loading assessments:', err);
      setError(`Failed to load assessments: ${err.message}`);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Starting to load stakeholder correlation data...');
      console.log('📊 Project ID:', currentProject?.id);
      console.log('📋 Assessment ID:', assessmentId);

      // Load each service individually with detailed logging
      console.log('👥 Loading stakeholders...');
      const stakeholdersData = await getStakeholders(currentProject.id);
      console.log('✅ Stakeholders loaded:', stakeholdersData?.length || 0, 'items');

      console.log('📈 Loading process impacts...');
      const processImpactsData = await getProcessImpacts(selectedAssessmentId);
      console.log('✅ Process impacts loaded:', processImpactsData?.length || 0, 'items');

      console.log('📊 Loading RACI summary...');
      const raciSummaryData = await getRACISummary(selectedAssessmentId);
      console.log('✅ RACI summary loaded:', raciSummaryData);

      setStakeholders(stakeholdersData || []);
      setProcessImpacts(processImpactsData || []);
      setRaciSummary(raciSummaryData || {});

      console.log('🎉 All data loaded successfully!');

    } catch (err) {
      console.error('❌ Error loading data:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        stack: err.stack
      });
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getProcessesWithRACICount = () => {
    return processImpacts.filter(process => {
      return [
        process.as_is_raci_r, process.as_is_raci_a, 
        process.as_is_raci_c, process.as_is_raci_i,
        process.to_be_raci_r, process.to_be_raci_a,
        process.to_be_raci_c, process.to_be_raci_i
      ].some(field => field && field.trim().length > 0);
    }).length;
  };

  const getHighImpactProcesses = () => {
    return processImpacts.filter(process => process.overall_impact_rating >= 4);
  };

  const getAverageImpactRating = () => {
    const ratings = processImpacts
      .map(p => p.overall_impact_rating)
      .filter(r => r !== null && r !== undefined);
    
    if (ratings.length === 0) return 0;
    return (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1);
  };

  if (loading) {
    return (
      <div className="correlation-view-loading">
        <div className="loading-spinner"></div>
        <p>Loading stakeholder impact correlation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="correlation-view-error">
        <p>Error: {error}</p>
        <button onClick={() => selectedAssessmentId ? loadData() : loadAssessments()} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (availableAssessments.length === 0) {
    return (
      <div className="no-correlation-data">
        <h3>No Impact Assessments Found</h3>
        <p>No impact assessments have been created for this project yet.</p>
        <p>Create an assessment first to view stakeholder correlation data.</p>
      </div>
    );
  }

  if (!selectedAssessmentId) {
    return (
      <div className="assessment-selection">
        <h3>Select an Assessment</h3>
        <p>Choose an assessment to view stakeholder impact correlation:</p>
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

  return (
    <div className="stakeholder-impact-correlation-view">
      <div className="correlation-header">
        <div className="header-info">
          <h2>Stakeholder Impact Overview</h2>
          <p>Summary of RACI assignments and process impacts</p>
        </div>
      </div>

      <div className="correlation-content">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-header">
              <h3>Total Stakeholders</h3>
            </div>
            <div className="card-value">{stakeholders.length}</div>
            <div className="card-description">Registered in project</div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <h3>Total Processes</h3>
            </div>
            <div className="card-value">{processImpacts.length}</div>
            <div className="card-description">In assessment</div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <h3>Processes with RACI</h3>
            </div>
            <div className="card-value">{getProcessesWithRACICount()}</div>
            <div className="card-description">Have role assignments</div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <h3>High Impact</h3>
            </div>
            <div className="card-value">{getHighImpactProcesses().length}</div>
            <div className="card-description">Rating 4-5 processes</div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <h3>Avg Impact Rating</h3>
            </div>
            <div className="card-value">{getAverageImpactRating()}</div>
            <div className="card-description">Overall average</div>
          </div>
        </div>

        {/* RACI Summary */}
        <div className="raci-summary-section">
          <h3>RACI Assignment Summary</h3>
          <div className="raci-summary-grid">
            <div className="raci-summary-card">
              <h4>As-Is State</h4>
              <div className="raci-counts">
                <div className="raci-count">
                  <span className="raci-label">Responsible:</span>
                  <span className="raci-value">{raciSummary.as_is_assignments?.responsible || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Accountable:</span>
                  <span className="raci-value">{raciSummary.as_is_assignments?.accountable || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Consulted:</span>
                  <span className="raci-value">{raciSummary.as_is_assignments?.consulted || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Informed:</span>
                  <span className="raci-value">{raciSummary.as_is_assignments?.informed || 0}</span>
                </div>
              </div>
            </div>

            <div className="raci-summary-card">
              <h4>To-Be State</h4>
              <div className="raci-counts">
                <div className="raci-count">
                  <span className="raci-label">Responsible:</span>
                  <span className="raci-value">{raciSummary.to_be_assignments?.responsible || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Accountable:</span>
                  <span className="raci-value">{raciSummary.to_be_assignments?.accountable || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Consulted:</span>
                  <span className="raci-value">{raciSummary.to_be_assignments?.consulted || 0}</span>
                </div>
                <div className="raci-count">
                  <span className="raci-label">Informed:</span>
                  <span className="raci-value">{raciSummary.to_be_assignments?.informed || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* High Impact Processes List */}
        {getHighImpactProcesses().length > 0 && (
          <div className="high-impact-section">
            <h3>High Impact Processes</h3>
            <div className="processes-list">
              {getHighImpactProcesses().map((process, index) => (
                <div key={index} className="process-item high-impact">
                  <div className="process-info">
                    <span className="process-code">{process.process_code}</span>
                    <span className="process-name">{process.process_name}</span>
                  </div>
                  <div className="impact-rating">
                    <span 
                      className={`rating-badge ${getImpactColor(process.overall_impact_rating)}`}
                    >
                      {process.overall_impact_rating}
                    </span>
                    <span className="rating-description">
                      {getImpactRatingDescription(process.overall_impact_rating)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="next-steps-section">
          <h3>Next Steps</h3>
          <div className="next-steps-content">
            {raciSummary.processes_without_raci > 0 && (
              <div className="next-step-item">
                <span className="step-icon">⚠️</span>
                <span className="step-text">
                  {raciSummary.processes_without_raci} processes need RACI assignments
                </span>
              </div>
            )}
            {getHighImpactProcesses().length > 0 && (
              <div className="next-step-item">
                <span className="step-icon">🎯</span>
                <span className="step-text">
                  Focus stakeholder engagement on {getHighImpactProcesses().length} high-impact processes
                </span>
              </div>
            )}
            <div className="next-step-item">
              <span className="step-icon">📊</span>
              <span className="step-text">
                Use RACI Comparison and Responsibility Tracking for detailed analysis
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakeholderImpactCorrelationView;