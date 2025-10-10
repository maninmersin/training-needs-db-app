import React from 'react';
import './CalendarDayControls.css';

const CalendarDayControls = ({ visibleDays, onDayToggle, collapsed, onToggle }) => {
  const days = [
    { index: 0, name: 'Sunday', short: 'Sun' },
    { index: 1, name: 'Monday', short: 'Mon' },
    { index: 2, name: 'Tuesday', short: 'Tue' },
    { index: 3, name: 'Wednesday', short: 'Wed' },
    { index: 4, name: 'Thursday', short: 'Thu' },
    { index: 5, name: 'Friday', short: 'Fri' },
    { index: 6, name: 'Saturday', short: 'Sat' }
  ];

  const visibleCount = Object.values(visibleDays).filter(Boolean).length;
  
  const handlePreset = (preset) => {
    let newVisibleDays = {};
    
    switch (preset) {
      case 'business':
        // Monday to Friday only
        days.forEach(day => {
          newVisibleDays[day.index] = day.index >= 1 && day.index <= 5;
        });
        break;
      case 'all':
        // All days visible
        days.forEach(day => {
          newVisibleDays[day.index] = true;
        });
        break;
      case 'weekends':
        // Saturday and Sunday only
        days.forEach(day => {
          newVisibleDays[day.index] = day.index === 0 || day.index === 6;
        });
        break;
      default:
        return;
    }
    
    // Apply all changes at once
    Object.entries(newVisibleDays).forEach(([dayIndex, visible]) => {
      onDayToggle(parseInt(dayIndex), visible);
    });
  };

  return (
    <div className="calendar-day-controls">
      <div 
        className="day-controls-header"
        onClick={onToggle}
      >
        <h3>📅 Calendar Days</h3>
        <div className="day-controls-summary">
          <span className="visible-count">{visibleCount} of 7 visible</span>
          <span className={`expand-icon ${collapsed ? 'collapsed' : 'expanded'}`}>
            {collapsed ? '▶' : '▼'}
          </span>
        </div>
      </div>
      
      {!collapsed && (
        <div className="day-controls-content">
          {/* Quick Presets */}
          <div className="day-presets">
            <button 
              className="preset-btn business-days"
              onClick={() => handlePreset('business')}
              title="Show Monday through Friday only"
            >
              Business Days
            </button>
            <button 
              className="preset-btn all-days"
              onClick={() => handlePreset('all')}
              title="Show all 7 days"
            >
              All Days
            </button>
            <button 
              className="preset-btn weekends-only"
              onClick={() => handlePreset('weekends')}
              title="Show weekends only"
            >
              Weekends
            </button>
          </div>

          {/* Individual Day Toggles */}
          <div className="day-toggles">
            {days.map(day => (
              <div 
                key={day.index} 
                className={`day-toggle ${visibleDays[day.index] ? 'visible' : 'hidden'}`}
              >
                <label className="day-toggle-label">
                  <input
                    type="checkbox"
                    checked={visibleDays[day.index] || false}
                    onChange={(e) => onDayToggle(day.index, e.target.checked)}
                    className="day-checkbox"
                  />
                  <span className="day-name">
                    <span className="day-short">{day.short}</span>
                    <span className="day-full">{day.name}</span>
                  </span>
                  <span className="checkmark">
                    {visibleDays[day.index] ? '✓' : ''}
                  </span>
                </label>
              </div>
            ))}
          </div>

          {/* Warning for no visible days */}
          {visibleCount === 0 && (
            <div className="warning-message">
              ⚠️ No days are visible. Please select at least one day.
            </div>
          )}

          {/* Help text */}
          <div className="help-text">
            <small>
              💡 Hide days when training cannot be scheduled (holidays, maintenance, etc.)
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDayControls;