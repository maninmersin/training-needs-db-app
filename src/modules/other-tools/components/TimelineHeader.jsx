import React from 'react';

const TimelineHeader = ({ timeline }) => {
  return (
    <div className="timeline-header-stub">
      <div className="timeline-dates">
        <span>Timeline: {timeline.startDate.toLocaleDateString()} - {timeline.endDate.toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default TimelineHeader;