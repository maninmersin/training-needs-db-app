import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  getImpactAssessments, 
  getAssessmentStatistics,
  getImpactSummaryByLevel
} from '../services/impactAssessmentService';
import './ImpactAssessmentDashboard.css';

const ImpactAssessmentDashboard = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    total_assessments: 0,
    total_processes: 0,
    high_impact_processes: 0,
    avg_completion: 0
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadDashboardData();
    }
  }, [currentProject?.id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const assessmentsData = await getImpactAssessments(currentProject.id);
      setAssessments(assessmentsData);

      // Calculate overall statistics across all assessments
      const overallStatistics = assessmentsData.reduce((acc, assessment) => {
        const stats = assessment.statistics || {};
        return {
          total_assessments: acc.total_assessments + 1,
          total_processes: acc.total_processes + (stats.total_processes || 0),
          high_impact_processes: acc.high_impact_processes + (stats.high_impact_count || 0),
          processes_needing_training: acc.processes_needing_training + (stats.processes_needing_training || 0)
        };
      }, {
        total_assessments: 0,
        total_processes: 0,
        high_impact_processes: 0,
        processes_needing_training: 0
      });

      // Calculate average completion rate
      const completedAssessments = assessmentsData.filter(a => a.status === 'completed' || a.status === 'approved').length;
      overallStatistics.avg_completion = assessmentsData.length > 0 ? 
        Math.round((completedAssessments / assessmentsData.length) * 100) : 0;

      setOverallStats(overallStatistics);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': 'status-draft',
      'in_progress': 'status-in-progress', 
      'completed': 'status-completed',
      'approved': 'status-approved'
    };
    return colors[status] || 'status-draft';
  };

  const getStatusText = (status) => {
    const texts = {
      'draft': 'Draft',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'approved': 'Approved'
    };
    return texts[status] || 'Draft';
  };

  const getImpactSeverityColor = (highImpactCount, totalProcesses) => {
    if (totalProcesses === 0) return 'impact-none';
    const ratio = highImpactCount / totalProcesses;
    if (ratio >= 0.5) return 'impact-critical';
    if (ratio >= 0.3) return 'impact-high'; 
    if (ratio >= 0.1) return 'impact-medium';
    return 'impact-low';
  };

  const quickActions = [
    {
      title: 'New Assessment',
      description: 'Create a new business process impact assessment',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      ),
      onClick: () => navigate('/impact-assessment/manage')
    },
    {
      title: 'Import from Excel',
      description: 'Bulk import process impacts from spreadsheet',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <path d="m8 13 2 2 4-4"/>
        </svg>
      ),
      onClick: () => navigate('/impact-assessment/import')
    },
    {
      title: 'Analytics View',
      description: 'View impact analytics and process heatmaps',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18"/>
          <path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
      onClick: () => navigate('/impact-assessment/analytics')
    },
    {
      title: 'Templates',
      description: 'Manage process hierarchy templates',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6v6H9z"/>
        </svg>
      ),
      onClick: () => navigate('/impact-assessment/templates')
    }
  ];

  if (loading) {
    return (
      <div className="impact-assessment-dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading impact assessment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="impact-assessment-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Impact Assessment Dashboard</h1>
          <p>Manage business process impact analysis and change assessment</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/impact-assessment/manage')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Assessment
          </button>
        </div>
      </div>

      {/* Overview Statistics */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon total-assessments">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{overallStats.total_assessments}</div>
            <div className="stat-label">Total Assessments</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon total-processes">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z"/>
              <path d="M12 12L2 7"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{overallStats.total_processes}</div>
            <div className="stat-label">Processes Analyzed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${getImpactSeverityColor(overallStats.high_impact_processes, overallStats.total_processes)}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{overallStats.high_impact_processes}</div>
            <div className="stat-label">High Impact Processes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon completion-rate">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{overallStats.avg_completion}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <div key={index} className="action-card" onClick={action.onClick}>
              <div className="action-icon">
                {action.icon}
              </div>
              <div className="action-content">
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Assessments</h2>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/impact-assessment/list')}
          >
            View All
          </button>
        </div>
        
        {assessments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <h3>No Impact Assessments Yet</h3>
            <p>Create your first business process impact assessment to get started</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/impact-assessment/manage')}
            >
              Manage Assessments
            </button>
          </div>
        ) : (
          <div className="assessments-list">
            {assessments.slice(0, 5).map((assessment) => (
              <div key={assessment.id} className="assessment-card">
                <div 
                  className="assessment-header clickable" 
                  onClick={() => navigate(`/impact-assessment/${assessment.id}`)}
                >
                  <div className="assessment-title">
                    <h3>{assessment.name}</h3>
                    <span className={`status-badge ${getStatusColor(assessment.status)}`}>
                      {getStatusText(assessment.status)}
                    </span>
                  </div>
                  <div className="assessment-date">
                    {new Date(assessment.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                {assessment.description && (
                  <p className="assessment-description">{assessment.description}</p>
                )}

                <div className="assessment-stats">
                  <div className="stat-item">
                    <span className="stat-value">{assessment.statistics?.total_processes || 0}</span>
                    <span className="stat-label">Processes</span>
                  </div>
                  <div className="stat-item">
                    <span className={`stat-value ${getImpactSeverityColor(
                      assessment.statistics?.high_impact_count || 0,
                      assessment.statistics?.total_processes || 1
                    )}`}>
                      {assessment.statistics?.high_impact_count || 0}
                    </span>
                    <span className="stat-label">High Impact</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{assessment.statistics?.processes_needing_training || 0}</span>
                    <span className="stat-label">Need Training</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{assessment.statistics?.systems_affected || 0}</span>
                    <span className="stat-label">Systems</span>
                  </div>
                </div>

                <div className="assessment-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/impact-assessment/${assessment.id}`)}
                  >
                    Analyze Processes
                  </button>
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate(`/impact-assessment/${assessment.id}/stakeholder-correlation`)}
                  >
                    RACI Analysis
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactAssessmentDashboard;