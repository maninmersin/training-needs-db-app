import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { getImpactAssessments } from '../../services/impactAssessmentService';
import { 
  getProcessImpactHeatmapData,
  getRoleImpactMatrix,
  getExecutiveSummaryMetrics,
  getCrossDimensionalAnalysis
} from '../../services/analyticsService';
import ExecutiveSummaryCards from './ExecutiveSummaryCards';
import ProcessImpactHeatmap from './ProcessImpactHeatmap';
import RoleImpactMatrix from './RoleImpactMatrix';
import ImpactFilters from './ImpactFilters';
import './ImpactAnalytics.css';

/**
 * Impact Analytics Dashboard - Main container for heatmap visualizations
 * Provides executive-level insights into process impacts and role assignments
 */
const ImpactAnalyticsDashboard = ({ assessmentId: propAssessmentId }) => {
  console.log('🚀 ImpactAnalyticsDashboard component mounted');
  
  const { assessmentId: urlAssessmentId } = useParams();
  const assessmentId = propAssessmentId || urlAssessmentId;
  const { currentProject } = useProject();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessmentId || '');
  
  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState({
    processHeatmap: null,
    roleMatrix: null,
    executiveMetrics: null,
    crossDimensional: null
  });
  
  // Filter and view state
  const [activeView, setActiveView] = useState('overview'); // overview, processes, roles, cross-analysis
  const [filters, setFilters] = useState({
    processLevel: 'all', // all, L0, L1, L2
    department: 'all',
    impactThreshold: 0, // 0-5
    showChangesOnly: false
  });
  
  console.log('🔍 Component state:', {
    selectedAssessmentId,
    activeView,
    filters,
    loading,
    error
  });

  // Load available assessments on mount
  useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  // Load analytics data when assessment is selected
  useEffect(() => {
    console.log('🔄 useEffect triggered for analytics loading:', { 
      projectId: currentProject?.id, 
      selectedAssessmentId,
      willLoad: !!(currentProject?.id && selectedAssessmentId)
    });
    
    if (currentProject?.id && selectedAssessmentId) {
      loadAnalyticsData();
    } else {
      setLoading(false);
    }
  }, [currentProject?.id, selectedAssessmentId]);

  const loadAssessments = async () => {
    try {
      console.log('📋 Loading available assessments for analytics...');
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

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Starting to load analytics data...');
      console.log('📋 Assessment ID:', selectedAssessmentId);

      // Load all analytics data in parallel
      const [
        processHeatmapData,
        roleMatrixData,
        executiveMetricsData,
        crossDimensionalData
      ] = await Promise.all([
        getProcessImpactHeatmapData(selectedAssessmentId),
        getRoleImpactMatrix(selectedAssessmentId),
        getExecutiveSummaryMetrics(selectedAssessmentId),
        getCrossDimensionalAnalysis(selectedAssessmentId)
      ]);

      console.log('✅ Analytics data loaded:', {
        processHeatmap: processHeatmapData?.rawData?.length || 0,
        roleMatrix: roleMatrixData?.totalChanges || 0,
        executiveMetrics: executiveMetricsData?.totalProcesses || 0
      });

      setAnalyticsData({
        processHeatmap: processHeatmapData,
        roleMatrix: roleMatrixData,
        executiveMetrics: executiveMetricsData,
        crossDimensional: crossDimensionalData
      });

      console.log('🎉 All analytics data loaded successfully!');

    } catch (err) {
      console.error('❌ Error loading analytics data:', err);
      console.error('❌ Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack
      });
      setError(`Failed to load analytics data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType, value) => {
    console.log('🔧 Filter changed:', filterType, value);
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleViewChange = (newView) => {
    console.log('👁️ View changed to:', newView);
    setActiveView(newView);
  };

  // Loading state
  if (loading) {
    return (
      <div className="analytics-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading impact analytics...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="analytics-dashboard-error">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button 
          onClick={() => selectedAssessmentId ? loadAnalyticsData() : loadAssessments()} 
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  // No assessments state
  if (availableAssessments.length === 0) {
    return (
      <div className="no-analytics-data">
        <div className="empty-icon">📊</div>
        <h3>No Impact Assessments Found</h3>
        <p>No impact assessments have been created for this project yet.</p>
        <p>Create an assessment first to view analytics.</p>
      </div>
    );
  }

  // Assessment selection state
  if (!selectedAssessmentId) {
    return (
      <div className="assessment-selection">
        <h3>Select an Assessment</h3>
        <p>Choose an assessment to view impact analytics:</p>
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

  const selectedAssessment = availableAssessments.find(a => a.id === selectedAssessmentId);

  return (
    <div className="impact-analytics-dashboard">
      {/* Dashboard Header */}
      <div className="analytics-header">
        <div className="header-info">
          <h1>Impact Analytics Dashboard</h1>
          <p>Visual analysis of process impacts, role assignments, and change complexity</p>
          {selectedAssessment && (
            <div className="assessment-info">
              <span className="assessment-name">{selectedAssessment.name}</span>
              <span className={`assessment-status status-${selectedAssessment.status}`}>
                {selectedAssessment.status}
              </span>
            </div>
          )}
        </div>

        {/* Assessment Selector */}
        {availableAssessments.length > 1 && (
          <div className="assessment-selector">
            <select 
              value={selectedAssessmentId} 
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="assessment-select"
            >
              {availableAssessments.map(assessment => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.name} ({assessment.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* View Navigation */}
      <div className="view-navigation">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => handleViewChange('overview')}
          >
            <span className="tab-icon">📊</span>
            Overview
          </button>
          <button 
            className={`nav-tab ${activeView === 'processes' ? 'active' : ''}`}
            onClick={() => handleViewChange('processes')}
          >
            <span className="tab-icon">🔥</span>
            Process Heatmap
          </button>
          <button 
            className={`nav-tab ${activeView === 'roles' ? 'active' : ''}`}
            onClick={() => handleViewChange('roles')}
          >
            <span className="tab-icon">👥</span>
            Role Impact
          </button>
          <button 
            className={`nav-tab ${activeView === 'cross-analysis' ? 'active' : ''}`}
            onClick={() => handleViewChange('cross-analysis')}
          >
            <span className="tab-icon">🔗</span>
            Cross Analysis
          </button>
        </div>

        {/* Filters */}
        <ImpactFilters 
          filters={filters}
          onFilterChange={handleFilterChange}
          data={analyticsData}
        />
      </div>

      {/* Analytics Content */}
      <div className="analytics-content">
        {/* Overview Tab */}
        {activeView === 'overview' && (
          <div className="overview-content">
            <ExecutiveSummaryCards 
              metrics={analyticsData.executiveMetrics}
              loading={loading}
            />
            
            <div className="overview-highlights">
              <div className="highlight-section">
                <h3>Key Insights</h3>
                <div className="insights-grid">
                  {analyticsData.executiveMetrics && (
                    <>
                      <div className="insight-card">
                        <div className="insight-value">
                          {analyticsData.executiveMetrics.criticalImpactProcesses}
                        </div>
                        <div className="insight-label">Critical Impact Processes</div>
                        <div className="insight-description">
                          Require immediate attention and detailed planning
                        </div>
                      </div>
                      
                      <div className="insight-card">
                        <div className="insight-value">
                          {analyticsData.roleMatrix?.changeTypeSummary?.['role-change'] || 0}
                        </div>
                        <div className="insight-label">Role Changes</div>
                        <div className="insight-description">
                          RACI assignments requiring stakeholder communication
                        </div>
                      </div>
                      
                      <div className="insight-card">
                        <div className="insight-value">
                          {analyticsData.executiveMetrics.systemComplexity?.totalSystems || 0}
                        </div>
                        <div className="insight-label">Systems Affected</div>
                        <div className="insight-description">
                          Systems requiring integration or migration work
                        </div>
                      </div>
                      
                      <div className="insight-card">
                        <div className="insight-value">
                          {analyticsData.executiveMetrics.trainingRequirements?.percentageRequiringTraining || 0}%
                        </div>
                        <div className="insight-label">Training Requirement</div>
                        <div className="insight-description">
                          Processes requiring training or support materials
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Process Heatmap Tab */}
        {activeView === 'processes' && (
          <ProcessImpactHeatmap 
            data={analyticsData.processHeatmap}
            filters={filters}
            loading={loading}
          />
        )}

        {/* Role Impact Tab */}
        {activeView === 'roles' && (
          <RoleImpactMatrix 
            data={analyticsData.roleMatrix}
            filters={filters}
            loading={loading}
          />
        )}

        {/* Cross Analysis Tab */}
        {activeView === 'cross-analysis' && (
          <div className="cross-analysis-content">
            <div className="coming-soon">
              <h3>Cross-Dimensional Analysis</h3>
              <p>Advanced correlation analysis coming soon...</p>
              <div className="preview-features">
                <div className="feature-item">📈 Process vs Role Impact Matrix</div>
                <div className="feature-item">🔍 Correlation Analysis</div>
                <div className="feature-item">⚠️ Implementation Risk Assessment</div>
                <div className="feature-item">📊 Predictive Analytics</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactAnalyticsDashboard;