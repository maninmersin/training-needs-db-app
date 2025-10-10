import React, { useState } from 'react';
import './AttendanceIssuesPanel.css';

const AttendanceIssuesPanel = ({ gaps, onIssueClick }) => {
  const [expandedSection, setExpandedSection] = useState('summary');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!gaps || gaps.summary.total_issues === 0) {
    return (
      <div className="issues-panel">
        <div className="panel-header">
          <h3>🎉 No Issues Found</h3>
        </div>
        <div className="no-issues-state">
          <div className="success-icon">✅</div>
          <p>All sessions have complete attendance records and good compliance rates!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="issues-panel">
      <div className="panel-header">
        <h3>⚠️ Issues Requiring Attention</h3>
        <div className="issue-summary">
          <span className="issue-count">{gaps.summary.total_issues}</span>
          <span className="issue-label">Total Issues</span>
        </div>
      </div>

      {/* Summary Section */}
      <div className="issue-section">
        <button
          className={`section-header ${expandedSection === 'summary' ? 'expanded' : ''}`}
          onClick={() => toggleSection('summary')}
        >
          <span className="section-icon">📊</span>
          <span className="section-title">Summary</span>
          <span className="section-count">
            {gaps.summary.missing_records_count + gaps.summary.low_compliance_count} issues
          </span>
          <span className="expand-icon">{expandedSection === 'summary' ? '−' : '+'}</span>
        </button>
        
        {expandedSection === 'summary' && (
          <div className="section-content">
            <div className="summary-stats">
              <div className="summary-stat">
                <div className="stat-icon">📝</div>
                <div className="stat-content">
                  <span className="stat-value">{gaps.summary.missing_records_count}</span>
                  <span className="stat-label">Missing Attendance Records</span>
                </div>
              </div>
              <div className="summary-stat">
                <div className="stat-icon">📉</div>
                <div className="stat-content">
                  <span className="stat-value">{gaps.summary.low_compliance_count}</span>
                  <span className="stat-label">Low Compliance Sessions (&lt;80%)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Missing Attendance Records */}
      {gaps.missing_attendance_records.length > 0 && (
        <div className="issue-section">
          <button
            className={`section-header ${expandedSection === 'missing' ? 'expanded' : ''}`}
            onClick={() => toggleSection('missing')}
          >
            <span className="section-icon">📝</span>
            <span className="section-title">Missing Attendance Records</span>
            <span className="section-count">{gaps.missing_attendance_records.length} sessions</span>
            <span className="expand-icon">{expandedSection === 'missing' ? '−' : '+'}</span>
          </button>
          
          {expandedSection === 'missing' && (
            <div className="section-content">
              <div className="issues-list">
                {gaps.missing_attendance_records.map((issue) => (
                  <div 
                    key={issue.session_id}
                    className="issue-item clickable"
                    onClick={() => onIssueClick(issue.session_id)}
                  >
                    <div className="issue-header">
                      <span className="issue-title">{issue.session_name}</span>
                      <span className="issue-severity missing">Missing Records</span>
                    </div>
                    <div className="issue-details">
                      <div className="issue-detail">
                        <span className="detail-label">Location:</span>
                        <span className="detail-value">{issue.training_location}</span>
                      </div>
                      <div className="issue-detail">
                        <span className="detail-label">Functional Area:</span>
                        <span className="detail-value">{issue.functional_area}</span>
                      </div>
                      <div className="issue-detail">
                        <span className="detail-label">Missing:</span>
                        <span className="detail-value">
                          {issue.missing_count} of {issue.assigned_count} records
                        </span>
                      </div>
                    </div>
                    <div className="issue-action">
                      <span className="action-text">Click to review session →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Low Compliance Sessions */}
      {gaps.low_compliance_sessions.length > 0 && (
        <div className="issue-section">
          <button
            className={`section-header ${expandedSection === 'compliance' ? 'expanded' : ''}`}
            onClick={() => toggleSection('compliance')}
          >
            <span className="section-icon">📉</span>
            <span className="section-title">Low Compliance Sessions</span>
            <span className="section-count">{gaps.low_compliance_sessions.length} sessions</span>
            <span className="expand-icon">{expandedSection === 'compliance' ? '−' : '+'}</span>
          </button>
          
          {expandedSection === 'compliance' && (
            <div className="section-content">
              <div className="issues-list">
                {gaps.low_compliance_sessions.map((issue) => (
                  <div 
                    key={issue.session_id}
                    className="issue-item clickable"
                    onClick={() => onIssueClick(issue.session_id)}
                  >
                    <div className="issue-header">
                      <span className="issue-title">{issue.session_name}</span>
                      <span className={`issue-severity ${issue.compliance_rate < 60 ? 'critical' : 'warning'}`}>
                        {issue.compliance_rate}% Compliance
                      </span>
                    </div>
                    <div className="issue-details">
                      <div className="issue-detail">
                        <span className="detail-label">Location:</span>
                        <span className="detail-value">{issue.training_location}</span>
                      </div>
                      <div className="issue-detail">
                        <span className="detail-label">Functional Area:</span>
                        <span className="detail-value">{issue.functional_area}</span>
                      </div>
                      <div className="issue-detail">
                        <span className="detail-label">Attendance:</span>
                        <span className="detail-value">
                          {issue.attended} of {issue.assigned} attended
                        </span>
                      </div>
                    </div>
                    <div className="issue-action">
                      <span className="action-text">Click to investigate →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceIssuesPanel;