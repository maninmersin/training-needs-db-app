import React from 'react';

/**
 * Impact Filters - Filter controls for analytics views
 * Provides filtering options for process level, department, impact threshold, etc.
 */
const ImpactFilters = ({ filters, onFilterChange, data }) => {
  // Extract unique departments from data for filter options
  const getUniqueDepartments = () => {
    if (!data?.processHeatmap?.rawData) return [];
    
    const departments = new Set();
    data.processHeatmap.rawData.forEach(process => {
      if (process.process?.department) {
        departments.add(process.process.department);
      }
    });
    
    return Array.from(departments).sort();
  };

  const uniqueDepartments = getUniqueDepartments();

  return (
    <div className="impact-filters">
      <div className="filters-container">
        {/* Process Level Filter */}
        <div className="filter-group">
          <label className="filter-label">Process Level:</label>
          <select
            value={filters.processLevel}
            onChange={(e) => onFilterChange('processLevel', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Levels</option>
            <option value="L0">L0 - Strategic</option>
            <option value="L1">L1 - Operational</option>
            <option value="L2">L2 - Detailed</option>
          </select>
        </div>

        {/* Department Filter */}
        {uniqueDepartments.length > 0 && (
          <div className="filter-group">
            <label className="filter-label">Department:</label>
            <select
              value={filters.department}
              onChange={(e) => onFilterChange('department', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Departments</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}

        {/* Impact Threshold Filter */}
        <div className="filter-group">
          <label className="filter-label">Min Impact:</label>
          <select
            value={filters.impactThreshold}
            onChange={(e) => onFilterChange('impactThreshold', parseInt(e.target.value))}
            className="filter-select"
          >
            <option value={0}>All Impacts</option>
            <option value={1}>1+ (Minimal)</option>
            <option value={2}>2+ (Low)</option>
            <option value={3}>3+ (Medium)</option>
            <option value={4}>4+ (High)</option>
            <option value={5}>5 (Critical Only)</option>
          </select>
        </div>

        {/* Changes Only Toggle */}
        <div className="filter-group">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.showChangesOnly}
              onChange={(e) => onFilterChange('showChangesOnly', e.target.checked)}
            />
            <span className="checkbox-label">Changes Only</span>
          </label>
        </div>

        {/* Filter Reset */}
        <div className="filter-group">
          <button
            className="reset-filters-btn"
            onClick={() => {
              onFilterChange('processLevel', 'all');
              onFilterChange('department', 'all');
              onFilterChange('impactThreshold', 0);
              onFilterChange('showChangesOnly', false);
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      <div className="active-filters">
        {(filters.processLevel !== 'all' || 
          filters.department !== 'all' || 
          filters.impactThreshold > 0 || 
          filters.showChangesOnly) && (
          <div className="active-filters-list">
            <span className="active-filters-label">Active Filters:</span>
            
            {filters.processLevel !== 'all' && (
              <span className="filter-tag">
                Level: {filters.processLevel}
                <button onClick={() => onFilterChange('processLevel', 'all')}>×</button>
              </span>
            )}
            
            {filters.department !== 'all' && (
              <span className="filter-tag">
                Dept: {filters.department}
                <button onClick={() => onFilterChange('department', 'all')}>×</button>
              </span>
            )}
            
            {filters.impactThreshold > 0 && (
              <span className="filter-tag">
                Impact: {filters.impactThreshold}+
                <button onClick={() => onFilterChange('impactThreshold', 0)}>×</button>
              </span>
            )}
            
            {filters.showChangesOnly && (
              <span className="filter-tag">
                Changes Only
                <button onClick={() => onFilterChange('showChangesOnly', false)}>×</button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactFilters;