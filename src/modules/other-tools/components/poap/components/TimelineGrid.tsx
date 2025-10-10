import React from 'react';
import type { TimelineConfig } from '../types';

interface TimelineGridProps {
  timeline: TimelineConfig;
}

export default function TimelineGrid({ timeline }: TimelineGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getTimePeriods = () => {
    const { startDate, endDate, scale } = timeline;
    const periods = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);

    while (current <= end) {
      let periodStart = new Date(current);
      let periodEnd: Date;
      let weekLabel = '';
      let monthLabel = '';

      switch (scale) {
        case 'weeks':
          periodEnd = new Date(current);
          periodEnd.setDate(current.getDate() + 7);
          weekLabel = `${current.getDate()}`;
          monthLabel = current.toLocaleDateString('en-US', { month: 'long' });
          current.setDate(current.getDate() + 7);
          break;
        case 'months':
          periodEnd = new Date(current);
          periodEnd.setMonth(current.getMonth() + 1);
          monthLabel = current.toLocaleDateString('en-US', { month: 'long' });
          weekLabel = current.getFullYear().toString();
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarters':
          periodEnd = new Date(current);
          periodEnd.setMonth(current.getMonth() + 3);
          const quarter = Math.floor(current.getMonth() / 3) + 1;
          monthLabel = `Q${quarter}`;
          weekLabel = current.getFullYear().toString();
          current.setMonth(current.getMonth() + 3);
          break;
        default:
          periodEnd = new Date(current);
          periodEnd.setDate(current.getDate() + 7);
          weekLabel = `${current.getDate()}`;
          monthLabel = current.toLocaleDateString('en-US', { month: 'long' });
          current.setDate(current.getDate() + 7);
      }

      if (periodEnd > end) {
        periodEnd = new Date(end);
      }

      periods.push({ start: periodStart, end: periodEnd, monthLabel, weekLabel });
    }

    return periods;
  };

  const getTodayPosition = () => {
    const { startDate, endDate } = timeline;
    if (today < startDate || today > endDate) return null;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const todayOffset = today.getTime() - startDate.getTime();
    return (todayOffset / totalDuration) * 100;
  };

  const periods = getTimePeriods();
  const todayPosition = getTodayPosition();

  return (
    <div className="relative">
      {/* Month/Quarter Header */}
      <div className="h-8 border-b border-gray-200 bg-gray-50">
        <div className="flex h-full">
          {periods.map((period, index) => {
            const isFirstOfMonth = index === 0 || periods[index - 1].monthLabel !== period.monthLabel;
            const monthSpan = periods.filter((p) => p.monthLabel === period.monthLabel).length;

            return isFirstOfMonth ? (
              <div
                key={`month-${index}`}
                className="border-r border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700"
                style={{
                  minWidth: `${80 * monthSpan}px`,
                  flexBasis: `${(100 / periods.length) * monthSpan}%`,
                }}
              >
                {period.monthLabel}
              </div>
            ) : null;
          })}
        </div>
      </div>

      {/* Week/Period Header */}
      <div className="h-10 border-b border-gray-200 bg-white relative">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(80px, 1fr))` }}>
          {periods.map((period, index) => (
            <div
              key={`week-${index}`}
              className={`border-r border-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 transition-all 
              ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
            >
              {period.weekLabel}
            </div>
          ))}
        </div>

        {/* Today Indicator */}
        {todayPosition !== null && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: `${todayPosition}%` }}
          >
            <div
              className="w-px h-full"
              style={{
                background: 'linear-gradient(to bottom, rgba(239,68,68,0.8), rgba(239,68,68,0))',
              }}
            ></div>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">
                Today
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
