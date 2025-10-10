import React from 'react';
import { usePlanStore } from '../state/usePlanStore';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import type { TimelineConfig } from '../types';

interface TimelineProps {
  config: TimelineConfig;
}

export default function Timeline({ config }: TimelineProps) {
  const { updateTimeline } = usePlanStore();

  const handleScaleChange = (scale: TimelineConfig['scale']) => {
    updateTimeline({ scale });
  };

  const handleDateChange = (startDate: Date, endDate: Date) => {
    updateTimeline({ startDate, endDate });
  };

  const handleToggleGrid = () => {
    updateTimeline({ showGrid: !config.showGrid });
  };

  const handleToggleSnap = () => {
    updateTimeline({ snapToGrid: !config.snapToGrid });
  };

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-gray-200 bg-white shadow-card overflow-hidden">
      <TimelineHeader
        timeline={config}
        onScaleChange={handleScaleChange}
        onDateChange={handleDateChange}
        onToggleGrid={handleToggleGrid}
        onToggleSnap={handleToggleSnap}
      />
      <TimelineGrid timeline={config} />
    </div>
  );
}
