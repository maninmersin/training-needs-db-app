import React from 'react';
import type { TimelineConfig } from '../../types';
import { useTimelineCalculations } from './hooks/useTimelineCalculations';
import './timeline.css';

interface TimelineHeaderProps {
  timeline: TimelineConfig;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({ timeline }) => {
  const { years, months, weeks, getTodayPercentage } = useTimelineCalculations(timeline);
  const todayPercentage = getTodayPercentage();

  return (
    <div className="timeline-header">
      {/* Left Corner - Empty */}
      <div className="timeline-header-left"></div>

      {/* Timeline Headers */}
      <div 
        className="timeline-header-right" 
        style={{ 
          '--week-count': weeks.length.toString(),
          position: 'relative',
          width: '100%' // Let CSS Grid 1fr handle the width
        } as React.CSSProperties}
      >
        {/* Year Row */}
        <div className="year-row" style={{ 
          display: 'grid',
          gridTemplateColumns: weeks.map(week => `${week.widthPercent}%`).join(' '),
          width: '100%'
        }}>
          {weeks.map((week, index) => {
            // Find which year this week belongs to
            const year = years.find(y => week.start >= y.start && week.start <= y.end);
            const isYearStart = year && weeks.findIndex(w => w.start >= year.start && w.start <= year.end) === index;
            
            return (
              <div 
                key={index}
                className="time-period"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  borderRight: index < weeks.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  fontSize: isYearStart ? '16px' : '14px',
                  fontWeight: isYearStart ? 'bold' : '600'
                }}
              >
                {isYearStart ? year?.year : ''}
              </div>
            );
          })}
        </div>

        {/* Month Row */}
        <div className="month-row" style={{ 
          display: 'grid',
          gridTemplateColumns: weeks.map(week => `${week.widthPercent}%`).join(' '),
          width: '100%'
        }}>
          {weeks.map((week, index) => {
            // Find which month this week belongs to
            const month = months.find(m => week.start >= m.start && week.start <= m.end);
            const isMonthStart = month && weeks.findIndex(w => w.start >= month.start && w.start <= month.end) === index;
            
            return (
              <div 
                key={index}
                className="time-period"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  borderRight: index < weeks.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {isMonthStart ? month?.label : ''}
              </div>
            );
          })}
        </div>

        {/* Week Row */}
        <div className="week-row" style={{ 
          display: 'grid',
          gridTemplateColumns: weeks.map(week => `${week.widthPercent}%`).join(' '),
          width: '100%'
        }}>
          {weeks.map((week, index) => (
            <div 
              key={index}
              className="time-period"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: '8px',
                height: '100%',
                borderRight: index < weeks.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {week.label}
            </div>
          ))}
        </div>

        {/* Today Indicator */}
        {todayPercentage !== null && (
          <div 
            className="today-indicator"
            style={{ 
              position: 'absolute',
              left: `${todayPercentage}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#ef4444',
              zIndex: 20
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TimelineHeader;