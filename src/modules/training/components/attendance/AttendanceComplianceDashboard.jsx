import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import {
  getAssignmentVsAttendanceStats,
  getDrillDownStats,
  getAttendanceGaps
} from '../../services/attendanceService';
import ComplianceMetricCard from './ComplianceMetricCard';
import BreadcrumbNavigation from './BreadcrumbNavigation';
import AttendanceIssuesPanel from './AttendanceIssuesPanel';
import './AttendanceComplianceDashboard.css';

const AttendanceComplianceDashboard = () => {
  const { currentProject } = useProject();
  
  // State management
  const [complianceData, setComplianceData] = useState(null);
  const [drillDownData, setDrillDownData] = useState({});
  const [attendanceGaps, setAttendanceGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Navigation state
  const [currentPath, setCurrentPath] = useState({});
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [viewLevel, setViewLevel] = useState('project'); // project, functionalArea, trainingLocation, session
  
  // Date range state
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    preset: 'all' // all, week1, week2, month, custom
  });

  // Load initial data
  useEffect(() => {
    if (currentProject) {
      loadComplianceData();
    }
  }, [currentProject, dateRange, currentPath]);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const dateFilters = buildDateFilters();
      
      const [complianceStats, drillStats, gapsData] = await Promise.all([
        getAssignmentVsAttendanceStats(currentProject.id, { ...dateFilters, ...currentPath }),
        getDrillDownStats(currentProject.id, currentPath, dateFilters),
        getAttendanceGaps(currentProject.id, dateFilters)
      ]);
      
      setComplianceData(complianceStats);
      setDrillDownData(drillStats.drillDownData || {});
      setBreadcrumb(drillStats.breadcrumb || []);
      setAttendanceGaps(gapsData);
      
    } catch (err) {
      console.error('❌ Error loading compliance data:', err);
      setError('Failed to load attendance compliance data');
    } finally {
      setLoading(false);
    }
  };

  const buildDateFilters = () => {
    const filters = {};
    
    if (dateRange.preset === 'custom') {
      if (dateRange.startDate) filters.startDate = dateRange.startDate;
      if (dateRange.endDate) filters.endDate = dateRange.endDate;
    } else if (dateRange.preset !== 'all') {
      // Handle preset date ranges
      const now = new Date();
      switch (dateRange.preset) {
        case 'week1':
          filters.startDate = getWeekStart(now, 0);
          filters.endDate = getWeekEnd(now, 0);
          break;
        case 'week2':
          filters.startDate = getWeekStart(now, -1);
          filters.endDate = getWeekEnd(now, -1);
          break;
        case 'month':
          filters.startDate = getMonthStart(now);
          filters.endDate = getMonthEnd(now);
          break;
      }
    }
    
    return filters;
  };

  const getWeekStart = (date, weeksAgo) => {
    const start = new Date(date);
    start.setDate(start.getDate() - (start.getDay() + 7 * Math.abs(weeksAgo)));
    return start.toISOString().split('T')[0];
  };

  const getWeekEnd = (date, weeksAgo) => {
    const end = new Date(date);
    end.setDate(end.getDate() - (end.getDay() + 7 * Math.abs(weeksAgo)) + 6);
    return end.toISOString().split('T')[0];
  };

  const getMonthStart = (date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return start.toISOString().split('T')[0];
  };

  const getMonthEnd = (date) => {
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return end.toISOString().split('T')[0];
  };

  const handleDrillDown = (level, value, label) => {
    const newPath = { ...currentPath };
    
    switch (level) {
      case 'functionalArea':
        newPath.functionalArea = value;
        setViewLevel('functionalArea');
        break;
      case 'trainingLocation':
        newPath.trainingLocation = value;
        setViewLevel('trainingLocation');
        break;
      case 'session':
        // For sessions, we don't need to update path as this is the deepest level
        setViewLevel('session');
        break;
    }
    
    setCurrentPath(newPath);
  };

  const handleBreadcrumbClick = (level, value = null) => {
    const newPath = {};
    
    if (level === 'functionalArea' && value) {
      newPath.functionalArea = value;
      setViewLevel('functionalArea');
    } else if (level === 'trainingLocation' && value && currentPath.functionalArea) {
      newPath.functionalArea = currentPath.functionalArea;
      newPath.trainingLocation = value;
      setViewLevel('trainingLocation');
    } else {
      // Back to project level
      setViewLevel('project');
    }
    
    setCurrentPath(newPath);
  };

  const handleDateRangeChange = (preset, customStart = '', customEnd = '') => {
    setDateRange({
      preset,
      startDate: customStart,
      endDate: customEnd
    });
  };

  const getComplianceColor = (rate) => {
    if (rate >= 90) return '#28a745'; // Green
    if (rate >= 75) return '#ffc107'; // Amber
    if (rate >= 60) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  if (!currentProject) {
    return (
      <div className="compliance-dashboard">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project to view attendance compliance data.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="compliance-dashboard">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading compliance data...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="compliance-dashboard">
      <div className="dashboard-header">
        <h2>📊 Attendance Compliance Dashboard</h2>
        <div className="project-indicator">
          <strong>Project:</strong> {currentProject.title}
        </div>
        <p className="dashboard-description">
          Track assignment vs attendance compliance with drill-down analysis
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-error">×</button>
        </div>
      )}

      {/* Date Range Controls */}
      <div className="date-range-section">
        <h3>Date Range</h3>
        <div className="date-range-controls">
          <div className="preset-buttons">
            <button
              className={`preset-btn ${dateRange.preset === 'all' ? 'active' : ''}`}
              onClick={() => handleDateRangeChange('all')}
            >
              All Time
            </button>
            <button
              className={`preset-btn ${dateRange.preset === 'week1' ? 'active' : ''}`}
              onClick={() => handleDateRangeChange('week1')}
            >
              This Week
            </button>
            <button
              className={`preset-btn ${dateRange.preset === 'week2' ? 'active' : ''}`}
              onClick={() => handleDateRangeChange('week2')}
            >
              Last Week
            </button>
            <button
              className={`preset-btn ${dateRange.preset === 'month' ? 'active' : ''}`}
              onClick={() => handleDateRangeChange('month')}
            >
              This Month
            </button>
          </div>
          <div className="custom-date-range">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateRangeChange('custom', e.target.value, dateRange.endDate)}
              placeholder="Start Date"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateRangeChange('custom', dateRange.startDate, e.target.value)}
              placeholder="End Date"
            />
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {breadcrumb.length > 0 && (
        <BreadcrumbNavigation
          breadcrumb={breadcrumb}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
      )}

      {/* Overall Summary Stats */}
      {complianceData && (
        <div className="summary-stats">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">👥</div>
              <div className="card-content">
                <span className="card-value">{complianceData.overall.total_assigned}</span>
                <span className="card-label">Total Assigned</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <span className="card-value">{complianceData.overall.total_attended}</span>
                <span className="card-label">Actually Attended</span>
              </div>
            </div>
            <div className="summary-card compliance-rate-card">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <span 
                  className="card-value"
                  style={{ color: getComplianceColor(complianceData.overall.compliance_rate) }}
                >
                  {formatPercentage(complianceData.overall.compliance_rate)}
                </span>
                <span className="card-label">Compliance Rate</span>
              </div>
            </div>
            {complianceData.overall.missing_attendance_records > 0 && (
              <div className="summary-card warning-card">
                <div className="card-icon">⚠️</div>
                <div className="card-content">
                  <span className="card-value">{complianceData.overall.missing_attendance_records}</span>
                  <span className="card-label">Missing Records</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drill-down Metrics */}
      <div className="drill-down-section">
        <h3>
          {viewLevel === 'project' && 'By Functional Area'}
          {viewLevel === 'functionalArea' && 'By Training Location'}
          {viewLevel === 'trainingLocation' && 'By Session'}
        </h3>
        
        <div className="metrics-grid">
          {Object.entries(drillDownData).length > 0 ? (
            Object.entries(drillDownData).map(([key, data]) => (
              <ComplianceMetricCard
                key={key}
                title={data.session_name || key}
                assigned={data.assigned}
                attended={data.attended}
                complianceRate={data.compliance_rate}
                missingRecords={data.missing_records || 0}
                onClick={() => {
                  if (viewLevel === 'project') {
                    handleDrillDown('functionalArea', key, key);
                  } else if (viewLevel === 'functionalArea') {
                    handleDrillDown('trainingLocation', key, key);
                  } else {
                    handleDrillDown('session', key, data.session_name || key);
                  }
                }}
                isDrillable={viewLevel !== 'session'}
              />
            ))
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#6c757d',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '2px dashed #dee2e6',
              gridColumn: '1 / -1'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📋</div>
              <h4>No Training Data Found</h4>
              <p>To see compliance data, you need to:</p>
              <ol style={{ textAlign: 'left', display: 'inline-block', margin: '10px 0' }}>
                <li>Create training sessions using the Schedule Manager</li>
                <li>Assign users to sessions using User Assignments</li>
                <li>Record attendance using the Attendance Tracker</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Issues Panel */}
      {attendanceGaps && (
        <AttendanceIssuesPanel
          gaps={attendanceGaps}
          onIssueClick={(sessionId) => {
            // Handle clicking on an issue to navigate to that session
            console.log('Navigate to session:', sessionId);
          }}
        />
      )}
    </div>
  );
};

export default AttendanceComplianceDashboard;