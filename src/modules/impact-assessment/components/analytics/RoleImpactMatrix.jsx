import React, { useState, useMemo } from 'react';

/**
 * Role Impact Matrix - Analysis of RACI changes and stakeholder load
 * Shows which roles are most affected by process changes
 */
const RoleImpactMatrix = ({ data, filters, loading }) => {
  const [viewMode, setViewMode] = useState('load'); // load, changes, summary
  const [sortBy, setSortBy] = useState('totalLoad'); // totalLoad, processCount, asIs, toBe
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  // Process and sort the role data
  const sortedRoles = useMemo(() => {
    if (!data || !data.roleLoad) return [];
    
    let roles = [...data.roleLoad];
    
    // Apply filters
    if (filters.showChangesOnly) {
      roles = roles.filter(([roleName]) => 
        data.raciChanges?.some(change => 
          change.asIs.includes(roleName) || change.toBe.includes(roleName)
        )
      );
    }
    
    // Sort roles
    roles.sort(([, a], [, b]) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'totalLoad':
          comparison = a.totalLoad - b.totalLoad;
          break;
        case 'processCount':
          comparison = a.processCount - b.processCount;
          break;
        case 'asIs':
          comparison = a.asIs - b.asIs;
          break;
        case 'toBe':
          comparison = a.toBe - b.toBe;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return roles;
  }, [data, filters, sortBy, sortOrder]);

  const getLoadIntensityClass = (load, maxLoad) => {
    if (maxLoad === 0) return 'load-none';
    const ratio = load / maxLoad;
    if (ratio >= 0.8) return 'load-critical';
    if (ratio >= 0.6) return 'load-high';
    if (ratio >= 0.4) return 'load-medium';
    if (ratio >= 0.2) return 'load-low';
    return 'load-minimal';
  };

  const getChangeTypeColor = (changeType) => {
    switch (changeType) {
      case 'new-assignment': return '#10b981'; // Green
      case 'removed-assignment': return '#ef4444'; // Red
      case 'role-change': return '#f59e0b'; // Orange
      default: return '#6b7280'; // Gray
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="role-matrix-loading">
        <div className="loading-spinner"></div>
        <p>Loading role impact analysis...</p>
      </div>
    );
  }

  if (!data || !data.roleLoad || data.roleLoad.length === 0) {
    return (
      <div className="role-matrix-empty">
        <div className="empty-icon">👥</div>
        <h3>No Role Data Available</h3>
        <p>No RACI assignments found for analysis.</p>
      </div>
    );
  }

  const maxLoad = Math.max(...data.roleLoad.map(([, roleData]) => roleData.totalLoad));

  return (
    <div className="role-impact-matrix">
      {/* Matrix Header */}
      <div className="matrix-header">
        <div className="header-info">
          <h3>Role Impact Analysis</h3>
          <p>RACI assignment changes and stakeholder workload analysis</p>
        </div>

        {/* View Mode Toggle */}
        <div className="view-mode-controls">
          <button 
            className={`view-btn ${viewMode === 'load' ? 'active' : ''}`}
            onClick={() => setViewMode('load')}
          >
            📊 Load Analysis
          </button>
          <button 
            className={`view-btn ${viewMode === 'changes' ? 'active' : ''}`}
            onClick={() => setViewMode('changes')}
          >
            🔄 Change Details
          </button>
          <button 
            className={`view-btn ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            📋 Summary
          </button>
        </div>
      </div>

      {/* Load Analysis View */}
      {viewMode === 'load' && (
        <div className="load-analysis-view">
          <div className="load-controls">
            <div className="sort-controls">
              <span className="sort-label">Sort by:</span>
              <button 
                className={`sort-btn ${sortBy === 'totalLoad' ? 'active' : ''}`}
                onClick={() => handleSort('totalLoad')}
              >
                Total Load {sortBy === 'totalLoad' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                className={`sort-btn ${sortBy === 'processCount' ? 'active' : ''}`}
                onClick={() => handleSort('processCount')}
              >
                Processes {sortBy === 'processCount' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                className={`sort-btn ${sortBy === 'asIs' ? 'active' : ''}`}
                onClick={() => handleSort('asIs')}
              >
                As-Is {sortBy === 'asIs' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                className={`sort-btn ${sortBy === 'toBe' ? 'active' : ''}`}
                onClick={() => handleSort('toBe')}
              >
                To-Be {sortBy === 'toBe' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <div className="role-load-matrix">
            <div className="matrix-table">
              <div className="table-header">
                <div className="header-cell role-name">Role/Stakeholder</div>
                <div className="header-cell process-count">Processes</div>
                <div className="header-cell as-is-load">As-Is Load</div>
                <div className="header-cell to-be-load">To-Be Load</div>
                <div className="header-cell total-load">Total Load</div>
                <div className="header-cell load-visual">Load Visualization</div>
              </div>

              <div className="table-body">
                {sortedRoles.slice(0, 20).map(([roleName, roleData], index) => (
                  <div key={roleName} className="table-row">
                    <div className="cell role-name">
                      <span className="role-title">{roleName}</span>
                    </div>
                    <div className="cell process-count">
                      <span className="count-value">{roleData.processCount}</span>
                    </div>
                    <div className="cell as-is-load">
                      <span className="load-value">{roleData.asIs}</span>
                    </div>
                    <div className="cell to-be-load">
                      <span className="load-value">{roleData.toBe}</span>
                    </div>
                    <div className="cell total-load">
                      <span className="load-total">{roleData.totalLoad}</span>
                    </div>
                    <div className="cell load-visual">
                      <div className="load-bar">
                        <div 
                          className={`load-fill ${getLoadIntensityClass(roleData.totalLoad, maxLoad)}`}
                          style={{ width: `${(roleData.totalLoad / maxLoad) * 100}%` }}
                        ></div>
                        <span className="load-percentage">
                          {Math.round((roleData.totalLoad / maxLoad) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Changes Details View */}
      {viewMode === 'changes' && (
        <div className="changes-details-view">
          {data.raciChanges && data.raciChanges.length > 0 ? (
            <div className="changes-table">
              <div className="table-header">
                <div className="header-cell process">Process</div>
                <div className="header-cell role-type">RACI Role</div>
                <div className="header-cell as-is">As-Is Assignment</div>
                <div className="header-cell to-be">To-Be Assignment</div>
                <div className="header-cell change-type">Change Type</div>
                <div className="header-cell impact">Impact</div>
              </div>

              <div className="table-body">
                {data.raciChanges.map((change, index) => (
                  <div key={index} className="table-row">
                    <div className="cell process">
                      <div className="process-info">
                        <span className="process-code">{change.processCode}</span>
                        <span className="process-name">{change.processName}</span>
                      </div>
                    </div>
                    <div className="cell role-type">
                      <span className={`raci-badge raci-${change.role.toLowerCase()}`}>
                        {change.role}
                      </span>
                    </div>
                    <div className="cell as-is">
                      <span className="assignment-value">{change.asIs || '—'}</span>
                    </div>
                    <div className="cell to-be">
                      <span className="assignment-value">{change.toBe || '—'}</span>
                    </div>
                    <div className="cell change-type">
                      <span 
                        className="change-badge"
                        style={{ backgroundColor: getChangeTypeColor(change.changeType) }}
                      >
                        {change.changeType.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="cell impact">
                      {change.impactRating && (
                        <span className={`impact-rating rating-${change.impactRating}`}>
                          {change.impactRating}/5
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-changes">
              <div className="empty-icon">✅</div>
              <h4>No RACI Changes Detected</h4>
              <p>All role assignments remain the same between As-Is and To-Be states.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className="summary-view">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-header">
                <h4>Total Changes</h4>
              </div>
              <div className="card-value">{data.totalChanges}</div>
              <div className="card-description">RACI assignment changes</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h4>Roles Affected</h4>
              </div>
              <div className="card-value">{data.roleLoad?.length || 0}</div>
              <div className="card-description">Unique roles/stakeholders</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h4>New Assignments</h4>
              </div>
              <div className="card-value">{data.changeTypeSummary?.['new-assignment'] || 0}</div>
              <div className="card-description">New role assignments</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h4>Removed Roles</h4>
              </div>
              <div className="card-value">{data.changeTypeSummary?.['removed-assignment'] || 0}</div>
              <div className="card-description">Assignments removed</div>
            </div>
          </div>

          {/* Change Type Breakdown */}
          {data.changeTypeSummary && (
            <div className="change-breakdown">
              <h4>Change Type Distribution</h4>
              <div className="breakdown-chart">
                {Object.entries(data.changeTypeSummary).map(([changeType, count]) => (
                  <div key={changeType} className="breakdown-item">
                    <div className="breakdown-bar">
                      <div 
                        className="breakdown-fill"
                        style={{ 
                          width: `${(count / data.totalChanges) * 100}%`,
                          backgroundColor: getChangeTypeColor(changeType)
                        }}
                      ></div>
                    </div>
                    <div className="breakdown-label">
                      <span className="change-type-name">
                        {changeType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="change-count">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Loaded Roles */}
          {data.roleLoad && data.roleLoad.length > 0 && (
            <div className="top-roles">
              <h4>Most Loaded Roles</h4>
              <div className="top-roles-list">
                {data.roleLoad.slice(0, 10).map(([roleName, roleData], index) => (
                  <div key={roleName} className="top-role-item">
                    <div className="role-rank">#{index + 1}</div>
                    <div className="role-info">
                      <span className="role-name">{roleName}</span>
                      <span className="role-stats">
                        {roleData.processCount} processes, {roleData.totalLoad} total assignments
                      </span>
                    </div>
                    <div className="role-load-indicator">
                      <div 
                        className={`load-dot ${getLoadIntensityClass(roleData.totalLoad, maxLoad)}`}
                      ></div>
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

export default RoleImpactMatrix;