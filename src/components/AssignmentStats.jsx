import React, { useState } from 'react';
import './AssignmentStats.css';

const AssignmentStats = ({ stats, capacityData }) => {

  // Collapsible state for each section
  const [collapsed, setCollapsed] = useState({
    assignment: true, // Start collapsed to focus on user pool
    capacity: true,   // Start collapsed to focus on user pool
    quickActions: true // Start collapsed to focus on user pool
  });

  const toggleSection = (section) => {
    setCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getPercentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const getCapacityOverview = () => {
    if (!capacityData || Object.keys(capacityData).length === 0) {
      return [];
    }

    return Object.entries(capacityData).map(([groupId, capacity]) => {
      const utilization = capacity.maxCapacity > 0 ? 
        Math.round((capacity.currentCount / capacity.maxCapacity) * 100) : 0;
      
      // Create a more descriptive display name
      const courseName = capacity.courseName || 'Unknown Course';
      const groupNumber = groupId.split('-group-')[1] || '?';
      const location = capacity.trainingLocation || 'Unknown Location';
      const functionalArea = capacity.functionalArea || 'Unknown Area';
      
      return {
        groupId,
        displayName: `${courseName} - Group ${groupNumber}`,
        location: location,
        functionalArea: functionalArea,
        current: capacity.currentCount || 0,
        max: capacity.maxCapacity || 0,
        utilization,
        available: Math.max(0, (capacity.maxCapacity || 0) - (capacity.currentCount || 0)),
        status: utilization >= 100 ? 'full' : utilization >= 80 ? 'near-full' : 'available'
      };
    }).sort((a, b) => {
      // Sort by course name, then group number
      if (a.displayName < b.displayName) return -1;
      if (a.displayName > b.displayName) return 1;
      return 0;
    });
  };

  const capacityOverview = getCapacityOverview();

  return (
    <div className="assignment-stats">
      {/* Main Statistics */}
      <div className="stats-section main-stats">
        <div 
          className="collapsible-header" 
          onClick={() => toggleSection('assignment')}
        >
          <h3>📊 Assignment Overview</h3>
          <span className={`collapse-icon ${collapsed.assignment ? 'collapsed' : 'expanded'}`}>
            {collapsed.assignment ? '▶' : '▼'}
          </span>
        </div>
        
        {!collapsed.assignment && (
          <div className="stats-content">
            <div className="stats-grid">
          <div className="stat-item total">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Users</div>
          </div>
          
          <div className="stat-item fully-assigned">
            <div className="stat-value">
              {stats.fullyAssigned}
              <span className="stat-percentage">
                ({getPercentage(stats.fullyAssigned, stats.total)}%)
              </span>
            </div>
            <div className="stat-label">✅ Fully Assigned</div>
          </div>
          
          <div className="stat-item partially-assigned">
            <div className="stat-value">
              {stats.partiallyAssigned}
              <span className="stat-percentage">
                ({getPercentage(stats.partiallyAssigned, stats.total)}%)
              </span>
            </div>
            <div className="stat-label">⚠️ Partially Assigned</div>
          </div>
          
          <div className="stat-item unassigned">
            <div className="stat-value">
              {stats.unassigned}
              <span className="stat-percentage">
                ({getPercentage(stats.unassigned, stats.total)}%)
              </span>
            </div>
            <div className="stat-label">❌ Unassigned</div>
          </div>
          
          {stats.waitlisted > 0 && (
            <div className="stat-item waitlisted">
              <div className="stat-value">
                {stats.waitlisted}
                <span className="stat-percentage">
                  ({getPercentage(stats.waitlisted, stats.total)}%)
                </span>
              </div>
              <div className="stat-label">⏳ Waitlisted</div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-label">Overall Progress</div>
          <div className="progress-bar">
            <div 
              className="progress-fill fully-assigned"
              style={{ width: `${getPercentage(stats.fullyAssigned, stats.total)}%` }}
            ></div>
            <div 
              className="progress-fill partially-assigned"
              style={{ 
                width: `${getPercentage(stats.partiallyAssigned, stats.total)}%`,
                left: `${getPercentage(stats.fullyAssigned, stats.total)}%`
              }}
            ></div>
          </div>
          <div className="progress-text">
            {getPercentage(stats.fullyAssigned + stats.partiallyAssigned, stats.total)}% Complete
          </div>
            </div>
          </div>
        )}
      </div>

      {/* Capacity Overview */}
      {capacityOverview.length > 0 && (
        <div className="stats-section capacity-stats">
          <div 
            className="collapsible-header" 
            onClick={() => toggleSection('capacity')}
          >
            <h3>📈 Capacity Overview</h3>
            <span className={`collapse-icon ${collapsed.capacity ? 'collapsed' : 'expanded'}`}>
              {collapsed.capacity ? '▶' : '▼'}
            </span>
          </div>
          
          {!collapsed.capacity && (
            <div className="capacity-content">
          
          <div className="capacity-list">
            {capacityOverview.map((group) => (
              <div key={group.groupId} className={`capacity-item ${group.status}`}>
                <div className="capacity-header">
                  <div className="group-info">
                    <span className="group-name">{group.displayName}</span>
                    <div className="group-meta">
                      <span className="location">📍 {group.location}</span>
                      <span className="functional-area">🏢 {group.functionalArea}</span>
                    </div>
                  </div>
                  <div className="capacity-numbers">
                    <span className="capacity-count">
                      {group.current}/{group.max}
                    </span>
                    <span className="available-count">
                      ({group.available} available)
                    </span>
                  </div>
                </div>
                
                <div className="capacity-bar">
                  <div 
                    className="capacity-fill"
                    style={{ width: `${Math.min(group.utilization, 100)}%` }}
                  ></div>
                </div>
                
                <div className="capacity-details">
                  <span className="utilization-text">
                    {group.utilization}% utilized
                  </span>
                  <span className={`status-indicator ${group.status}`}>
                    {group.status === 'full' ? '🔴 Full' : 
                     group.status === 'near-full' ? '🟡 Near Full' : '🟢 Available'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Capacity Summary */}
          <div className="capacity-summary">
            <div className="summary-item">
              <span className="summary-label">🟢 Available:</span>
              <span className="summary-value">
                {capacityOverview.filter(g => g.status === 'available').length} groups
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">🟡 Near Full:</span>
              <span className="summary-value">
                {capacityOverview.filter(g => g.status === 'near-full').length} groups
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">🔴 Full:</span>
              <span className="summary-value">
                {capacityOverview.filter(g => g.status === 'full').length} groups
              </span>
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="stats-section quick-actions">
        <div 
          className="collapsible-header" 
          onClick={() => toggleSection('quickActions')}
        >
          <h3>🎯 Quick Actions</h3>
          <span className={`collapse-icon ${collapsed.quickActions ? 'collapsed' : 'expanded'}`}>
            {collapsed.quickActions ? '▶' : '▼'}
          </span>
        </div>
        
        {!collapsed.quickActions && (
          <div className="actions-content">
        
        <div className="action-buttons">
          <button 
            className="action-btn export-btn"
            onClick={() => console.log('Export assignments')}
          >
            📄 Export Report
          </button>
          
          <button 
            className="action-btn refresh-btn"
            onClick={() => console.log('Refresh stats')}
          >
            🔄 Refresh Stats
          </button>
          
          {stats.unassigned > 0 && (
            <button 
              className="action-btn auto-assign-btn"
              onClick={() => console.log('Auto-assign remaining')}
            >
              🎯 Auto-Assign Remaining
            </button>
          )}
        </div>
          </div>
        )}
      </div>

      {/* Status Indicators Legend */}
      <div className="stats-section legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-icon">✅</span>
            <span className="legend-text">Fully Assigned - User assigned to all required courses</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon">⚠️</span>
            <span className="legend-text">Partially Assigned - User assigned to some required courses</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon">❌</span>
            <span className="legend-text">Unassigned - User not assigned to any courses</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon">⏳</span>
            <span className="legend-text">Waitlisted - User waiting for available slots</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentStats;