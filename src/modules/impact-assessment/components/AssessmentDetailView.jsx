import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  getImpactAssessment, 
  getAssessmentStatistics
} from '../services/impactAssessmentService';
import ProcessImpactTable from './ProcessImpactTable';
import './AssessmentDetailView.css';

const AssessmentDetailView = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  
  const [assessment, setAssessment] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assessmentId && currentProject?.id) {
      loadAssessmentData();
    }
  }, [assessmentId, currentProject?.id]);

  const loadAssessmentData = async () => {
    try {
      setLoading(true);
      
      const assessmentData = await getImpactAssessment(assessmentId, currentProject.id);
      setAssessment(assessmentData);
      
      // Load statistics
      await loadStatistics();
      
    } catch (error) {
      console.error('Error loading assessment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await getAssessmentStatistics(assessmentId);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleProcessesChange = async () => {
    // Reload statistics when processes are updated
    await loadStatistics();
  };

  const calculateProgress = () => {
    if (!statistics.total_processes || statistics.total_processes === 0) return 0;
    
    const completedCount = statistics.completed_impacts || 0;
    return Math.round((completedCount / statistics.total_processes) * 100);
  };

  if (loading) {
    return (
      <div className="assessment-detail-view">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading assessment details...</p>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="assessment-detail-view">
        <div className="error-container">
          <h2>Assessment Not Found</h2>
          <p>The requested assessment could not be found.</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/impact-assessment')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className="assessment-detail-view">
      {/* Header */}
      <div className="detail-header">
        <div className="header-main">
          <button 
            className="back-button"
            onClick={() => navigate('/impact-assessment')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            Back to Dashboard
          </button>
          
          <div className="assessment-title">
            <h1>{assessment.name}</h1>
            {assessment.description && (
              <p className="assessment-description">{assessment.description}</p>
            )}
          </div>
        </div>
        
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-value">{statistics.total_processes || 0}</span>
            <span className="stat-label">Total Processes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{statistics.selected_processes || 0}</span>
            <span className="stat-label">Selected</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{statistics.completed_impacts || 0}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{progress}%</span>
            <span className="stat-label">Progress</span>
          </div>
          <div className="stat-item">
            <span className={`stat-value status-${assessment.status || 'draft'}`}>
              {assessment.status || 'Draft'}
            </span>
            <span className="stat-label">Status</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Assessment Progress</span>
          <span>{progress}% Complete</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Process Impact Table */}
      <div className="processes-section">
        <div className="section-header">
          <h2>Process Impact Analysis</h2>
          <div className="section-actions">
            <button 
              className="btn btn-outline"
              onClick={() => navigate(`/impact-assessment/${assessmentId}/stakeholder-correlation`)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="m22 21-3-3m0 0a5.5 5.5 0 1 0-7.8-7.8 5.5 5.5 0 0 0 7.8 7.8Z"/>
              </svg>
              RACI Analysis
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => navigate(`/impact-assessment/${assessmentId}/bulk-edit`)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4z"/>
              </svg>
              Bulk Edit
            </button>
          </div>
        </div>
        
        <ProcessImpactTable 
          assessmentId={assessmentId}
          onProcessesChange={handleProcessesChange}
        />
      </div>
    </div>
  );
};

export default AssessmentDetailView;