import React from 'react';
import type { TimelineConfig } from '../types';

interface TimelineHeaderProps {
  timeline: TimelineConfig;
  onScaleChange: (scale: TimelineConfig['scale']) => void;
  onDateChange: (startDate: Date, endDate: Date) => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
}

export default function TimelineHeader({
  timeline,
  onScaleChange,
  onDateChange,
  onToggleGrid,
  onToggleSnap,
}: TimelineHeaderProps) {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = new Date(e.target.value);
    onDateChange(newStartDate, timeline.endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = new Date(e.target.value);
    onDateChange(timeline.startDate, newEndDate);
  };

  const setTimelinePreset = (preset: 'month' | 'quarter' | 'year') => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;
    let scale: TimelineConfig['scale'];

    switch (preset) {
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        scale = 'weeks';
        break;
      case 'quarter':
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        startDate = new Date(today.getFullYear(), quarterStart, 1);
        endDate = new Date(today.getFullYear(), quarterStart + 3, 0);
        scale = 'months';
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        scale = 'quarters';
        break;
    }

    onDateChange(startDate, endDate);
    onScaleChange(scale);
  };

  return (
    <div className="px-6 py-3 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-6">
          {/* Quick Presets */}
          <div className="flex items-center gap-x-2">
            <span className="text-sm font-medium text-gray-700">Quick:</span>
            <div className="flex gap-x-1">
              {['month', 'quarter', 'year'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTimelinePreset(preset as any)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-gray-600 hover:bg-brand-light hover:text-white transition-all shadow-subtle"
                >
                  {preset === 'month'
                    ? 'This Month'
                    : preset === 'quarter'
                    ? 'This Quarter'
                    : 'This Year'}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6 bg-gray-300" />

          {/* Scale Selector */}
          <div className="flex items-center gap-x-2">
            <label className="text-sm font-medium text-gray-700">Scale:</label>
            <select
              value={timeline.scale}
              onChange={(e) => onScaleChange(e.target.value as TimelineConfig['scale'])}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
            >
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="quarters">Quarters</option>
            </select>
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-x-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={timeline.startDate.toISOString().split('T')[0]}
              onChange={handleStartDateChange}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>

          <div className="flex items-center gap-x-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={timeline.endDate.toISOString().split('T')[0]}
              onChange={handleEndDateChange}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-x-4">
          <label className="flex items-center gap-x-2 cursor-pointer">
            <input
              type="checkbox"
              id="show-grid"
              checked={timeline.showGrid}
              onChange={onToggleGrid}
              className="form-checkbox text-brand-light rounded"
            />
            <span className="text-sm font-medium text-gray-700">Show Grid</span>
          </label>

          <label className="flex items-center gap-x-2 cursor-pointer">
            <input
              type="checkbox"
              id="snap-to-grid"
              checked={timeline.snapToGrid}
              onChange={onToggleSnap}
              className="form-checkbox text-brand-light rounded"
            />
            <span className="text-sm font-medium text-gray-700">Snap to Grid</span>
          </label>
        </div>
      </div>
    </div>
  );
}
