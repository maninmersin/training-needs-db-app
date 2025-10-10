import React from 'react';

/**
 * Executive Summary Cards - Key metrics overview
 * Displays high-level statistics and insights for executives
 */
const ExecutiveSummaryCards = ({ metrics, loading }) => {
  if (loading || !metrics) {
    return (
      <div className="executive-summary">
        <div className="summary-loading">
          <div className="loading-spinner"></div>
          <p>Loading executive metrics...</p>
        </div>
      </div>
    );
  }

  const getImpactSeverityClass = (critical, total) => {
    if (total === 0) return 'severity-none';
    const ratio = critical / total;
    if (ratio >= 0.5) return 'severity-critical';
    if (ratio >= 0.3) return 'severity-high';
    if (ratio >= 0.1) return 'severity-medium';
    return 'severity-low';
  };

  const getChangeIntensityClass = (changes) => {
    if (changes >= 50) return 'intensity-critical';
    if (changes >= 20) return 'intensity-high';
    if (changes >= 10) return 'intensity-medium';
    return 'intensity-low';
  };

  const getTrainingUrgencyClass = (percentage) => {
    if (percentage >= 80) return 'urgency-critical';
    if (percentage >= 60) return 'urgency-high';
    if (percentage >= 40) return 'urgency-medium';
    return 'urgency-low';
  };

  return (
    <div className="executive-summary">
      <h2>Executive Summary</h2>
      
      <div className="summary-cards">
        {/* Total Processes Card */}
        <div className="summary-card primary">
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z"/>
              <path d="M12 12L2 7"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.totalProcesses}</div>
            <div className="card-label">Total Processes</div>
            <div className="card-description">Under analysis</div>
          </div>
          <div className="card-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">L0:</span>
              <span className="breakdown-value">{metrics.processLevels?.l0 || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">L1:</span>
              <span className="breakdown-value">{metrics.processLevels?.l1 || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">L2:</span>
              <span className="breakdown-value">{metrics.processLevels?.l2 || 0}</span>
            </div>
          </div>
        </div>

        {/* Critical Impact Card */}
        <div className={`summary-card ${getImpactSeverityClass(metrics.criticalImpactProcesses, metrics.totalProcesses)}`}>
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.criticalImpactProcesses}</div>
            <div className="card-label">Critical Impact</div>
            <div className="card-description">Rating 4-5 processes</div>
          </div>
          <div className="card-percentage">
            {metrics.totalProcesses > 0 
              ? Math.round((metrics.criticalImpactProcesses / metrics.totalProcesses) * 100)
              : 0
            }% of total
          </div>
        </div>

        {/* RACI Changes Card */}
        <div className={`summary-card ${getChangeIntensityClass(metrics.raciChanges?.totalChanges || 0)}`}>
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <path d="M20 8v6M23 11l-3 3-3-3"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.raciChanges?.totalChanges || 0}</div>
            <div className="card-label">RACI Changes</div>
            <div className="card-description">Role assignment changes</div>
          </div>
          <div className="card-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">R:</span>
              <span className="breakdown-value">{metrics.raciChanges?.changesByRole?.R || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">A:</span>
              <span className="breakdown-value">{metrics.raciChanges?.changesByRole?.A || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">C:</span>
              <span className="breakdown-value">{metrics.raciChanges?.changesByRole?.C || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">I:</span>
              <span className="breakdown-value">{metrics.raciChanges?.changesByRole?.I || 0}</span>
            </div>
          </div>
        </div>

        {/* Average Impact Rating Card */}
        <div className="summary-card metric">
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"/>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.averageImpactRating}</div>
            <div className="card-label">Avg Impact Rating</div>
            <div className="card-description">Out of 5.0</div>
          </div>
          <div className="card-visual">
            <div className="rating-bar">
              <div 
                className="rating-fill"
                style={{ 
                  width: `${(metrics.averageImpactRating / 5) * 100}%`,
                  backgroundColor: metrics.averageImpactRating >= 4 ? '#ef4444' : 
                                 metrics.averageImpactRating >= 3 ? '#f59e0b' : 
                                 metrics.averageImpactRating >= 2 ? '#84cc16' : '#10b981'
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Systems Affected Card */}
        <div className="summary-card info">
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.systemComplexity?.totalSystems || 0}</div>
            <div className="card-label">Systems Affected</div>
            <div className="card-description">Integration complexity</div>
          </div>
          {metrics.systemComplexity?.systemChanges?.length > 0 && (
            <div className="card-list">
              {metrics.systemComplexity.systemChanges.slice(0, 3).map(([system, data], index) => (
                <div key={index} className="list-item">
                  <span className="item-name">{system}</span>
                  <span className="item-count">{data.processes} processes</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training Requirements Card */}
        <div className={`summary-card ${getTrainingUrgencyClass(metrics.trainingRequirements?.percentageRequiringTraining || 0)}`}>
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div className="card-content">
            <div className="card-value">{metrics.trainingRequirements?.percentageRequiringTraining || 0}%</div>
            <div className="card-label">Training Required</div>
            <div className="card-description">Processes needing training</div>
          </div>
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-value">{metrics.trainingRequirements?.totalRequiringTraining || 0}</span>
              <span className="detail-label">processes</span>
            </div>
            <div className="detail-item">
              <span className="detail-value">{metrics.trainingRequirements?.highImpactTraining || 0}</span>
              <span className="detail-label">high impact</span>
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      {metrics.departmentBreakdown && metrics.departmentBreakdown.length > 0 && (
        <div className="department-breakdown">
          <h3>Department Impact Analysis</h3>
          <div className="department-grid">
            {metrics.departmentBreakdown.slice(0, 6).map(([department, stats], index) => (
              <div key={index} className="department-card">
                <div className="department-header">
                  <h4>{department}</h4>
                  <span className="department-average">{stats.averageImpact}/5</span>
                </div>
                <div className="department-stats">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalProcesses}</span>
                    <span className="stat-label">Processes</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.highImpactProcesses}</span>
                    <span className="stat-label">High Impact</span>
                  </div>
                </div>
                <div className="impact-bar">
                  <div 
                    className="impact-fill"
                    style={{ 
                      width: `${(stats.averageImpact / 5) * 100}%`,
                      backgroundColor: stats.averageImpact >= 4 ? '#ef4444' : 
                                     stats.averageImpact >= 3 ? '#f59e0b' : 
                                     stats.averageImpact >= 2 ? '#84cc16' : '#10b981'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummaryCards;