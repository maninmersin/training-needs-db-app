import React from 'react';

const DateRangeControls = ({ timeline, onTimelineUpdate }) => {
  return (
    <div className="date-range-controls p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Start:</label>
          <input
            type="date"
            value={timeline.startDate.toISOString().split('T')[0]}
            onChange={(e) => onTimelineUpdate({ startDate: new Date(e.target.value) })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">End:</label>
          <input
            type="date"
            value={timeline.endDate.toISOString().split('T')[0]}
            onChange={(e) => onTimelineUpdate({ endDate: new Date(e.target.value) })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Scale:</label>
          <select
            value={timeline.scale}
            onChange={(e) => onTimelineUpdate({ scale: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default DateRangeControls;