import React from 'react';
import './ComplianceMetricCard.css';

const ComplianceMetricCard = ({
  title,
  assigned,
  attended,
  complianceRate,
  missingRecords,
  onClick,
  isDrillable = true
}) => {
  const getComplianceColor = (rate) => {
    if (rate >= 90) return '#28a745'; // Green
    if (rate >= 75) return '#ffc107'; // Amber
    if (rate >= 60) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };

  const getComplianceLevel = (rate) => {
    if (rate >= 90) return 'excellent';
    if (rate >= 75) return 'good';
    if (rate >= 60) return 'warning';
    return 'critical';
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  return (
    <div 
      className={`compliance-metric-card ${isDrillable ? 'drillable' : ''} ${getComplianceLevel(complianceRate)}`}
      onClick={isDrillable ? onClick : undefined}
    >
      <div className="card-header">
        <h4 className="card-title">{title}</h4>
        {isDrillable && <span className="drill-indicator">→</span>}
      </div>
      
      <div className="card-metrics">
        <div className="primary-metric">
          <span 
            className="compliance-rate"
            style={{ color: getComplianceColor(complianceRate) }}
          >
            {formatPercentage(complianceRate)}
          </span>
          <span className="metric-label">Compliance</span>
        </div>
        
        <div className="secondary-metrics">
          <div className="metric">
            <span className="metric-value">{attended}</span>
            <span className="metric-sublabel">Attended</span>
          </div>
          <div className="metric-divider">/</div>
          <div className="metric">
            <span className="metric-value">{assigned}</span>
            <span className="metric-sublabel">Assigned</span>
          </div>
        </div>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ 
            width: `${Math.min(complianceRate, 100)}%`,
            backgroundColor: getComplianceColor(complianceRate)
          }}
        ></div>
      </div>

      {missingRecords > 0 && (
        <div className="warning-indicator">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">
            {missingRecords} missing attendance record{missingRecords !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="card-status">
        <div className={`status-indicator ${getComplianceLevel(complianceRate)}`}></div>
        <span className="status-text">
          {complianceRate >= 90 && 'Excellent'}
          {complianceRate >= 75 && complianceRate < 90 && 'Good'}
          {complianceRate >= 60 && complianceRate < 75 && 'Needs Attention'}
          {complianceRate < 60 && 'Critical'}
        </span>
      </div>
    </div>
  );
};

export default ComplianceMetricCard;