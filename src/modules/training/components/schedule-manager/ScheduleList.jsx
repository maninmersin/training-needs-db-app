import React from 'react';
import { format } from 'date-fns';

const ScheduleList = ({ 
  schedules, 
  selectedSchedules, 
  onSelectionChange, 
  onEdit, 
  onRefresh 
}) => {

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(schedules.map(s => s.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectSchedule = (scheduleId, checked) => {
    if (checked) {
      onSelectionChange([...selectedSchedules, scheduleId]);
    } else {
      onSelectionChange(selectedSchedules.filter(id => id !== scheduleId));
    }
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getSessionCount = (schedule) => {
    // Use the session_count from the database query if available
    if (schedule.session_count && Array.isArray(schedule.session_count) && schedule.session_count.length > 0) {
      // Supabase count subquery returns [{count: number}]
      return schedule.session_count[0].count || 0;
    }
    // Fallback for sessions array (used when editing)
    if (!schedule.sessions) return 0;
    return Array.isArray(schedule.sessions) ? schedule.sessions.length : 0;
  };

  if (schedules.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <h3>📅 No Schedules Found</h3>
          <p>No training schedules match your current filters.</p>
          <button onClick={onRefresh} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-list">
      <div className="schedule-table">
        <div className="table-header">
          <div className="header-row">
            <div className="header-cell checkbox-cell">
              <input
                type="checkbox"
                checked={selectedSchedules.length === schedules.length && schedules.length > 0}
                onChange={handleSelectAll}
              />
            </div>
            <div className="header-cell name-cell">Schedule Name</div>
            <div className="header-cell date-cell">Created</div>
            <div className="header-cell date-cell">Modified</div>
            <div className="header-cell count-cell">Sessions</div>
            <div className="header-cell version-cell">Version</div>
            <div className="header-cell actions-cell">Actions</div>
          </div>
        </div>

        <div className="table-body">
          {schedules.map(schedule => {
            const isSelected = selectedSchedules.includes(schedule.id);
            
            return (
              <div 
                key={schedule.id} 
                className={`table-row ${isSelected ? 'selected' : ''}`}
              >
                <div className="table-cell checkbox-cell">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSelectSchedule(schedule.id, e.target.checked)}
                  />
                </div>
                
                <div className="table-cell name-cell">
                  <div className="schedule-name">{schedule.name}</div>
                </div>
                
                <div className="table-cell date-cell">
                  {formatDate(schedule.created_at)}
                </div>
                
                <div className="table-cell date-cell">
                  {formatDate(schedule.updated_at)}
                </div>
                
                <div className="table-cell count-cell">
                  <span className="session-count">
                    {getSessionCount(schedule)} sessions
                  </span>
                </div>
                
                <div className="table-cell version-cell">
                  <span className="version-badge">
                    {schedule.version ? formatDate(schedule.version) : 'v1.0'}
                  </span>
                </div>
                
                <div className="table-cell actions-cell">
                  <button
                    onClick={() => onEdit(schedule.id)}
                    className="edit-btn"
                    title="Edit Schedule"
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="list-footer">
        <div className="list-stats">
          Showing {schedules.length} schedule(s)
          {selectedSchedules.length > 0 && (
            <span className="selection-info">
              {" "} • {selectedSchedules.length} selected
            </span>
          )}
        </div>
        
        <button onClick={onRefresh} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default ScheduleList;