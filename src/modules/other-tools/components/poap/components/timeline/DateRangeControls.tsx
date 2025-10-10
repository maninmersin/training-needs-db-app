import React, { useState } from 'react';
import type { TimelineConfig } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface DateRangeControlsProps {
  timeline: TimelineConfig;
  onTimelineUpdate: (updates: Partial<TimelineConfig>) => void;
}

const DateRangeControls: React.FC<DateRangeControlsProps> = ({ timeline, onTimelineUpdate }) => {
  const [startDate, setStartDate] = useState(timeline.startDate.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(timeline.endDate.toISOString().split('T')[0]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Check if current form values differ from timeline
  const hasChanges = () => {
    const currentStart = timeline.startDate.toISOString().split('T')[0];
    const currentEnd = timeline.endDate.toISOString().split('T')[0];
    return startDate !== currentStart || endDate !== currentEnd;
  };

  // Quick preset ranges
  const presets = [
    { label: '1 Month', days: 30 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180, isDefault: true }, // Mark as default
    { label: '1 Year', days: 365 },
    { label: '2 Years', days: 730 }
  ];

  // Validate date range
  const validateDateRange = (startDate: Date, endDate: Date): string | null => {
    if (endDate <= startDate) {
      return 'End date must be after start date';
    }
    
    const diffInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffInDays < 7) {
      return 'Date range must be at least 7 days';
    }
    
    if (diffInDays > 365 * 5) {
      return 'Date range cannot exceed 5 years';
    }
    
    return null;
  };

  // Apply date range changes
  const applyDateRange = async (newStartDate: Date, newEndDate: Date) => {
    const validation = validateDateRange(newStartDate, newEndDate);
    if (validation) {
      alert(validation);
      return;
    }

    setIsUpdating(true);
    
    try {
      onTimelineUpdate({
        startDate: newStartDate,
        endDate: newEndDate
      });
      
      // Update local state to reflect changes
      setStartDate(newStartDate.toISOString().split('T')[0]);
      setEndDate(newEndDate.toISOString().split('T')[0]);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle manual date input changes
  const handleApplyDates = () => {
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);
    applyDateRange(newStartDate, newEndDate);
  };

  // Reset to current timeline values
  const handleReset = () => {
    setStartDate(timeline.startDate.toISOString().split('T')[0]);
    setEndDate(timeline.endDate.toISOString().split('T')[0]);
  };

  // Handle preset button clicks
  const handlePreset = (days: number) => {
    const newStartDate = new Date();
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + days);
    
    setStartDate(newStartDate.toISOString().split('T')[0]);
    setEndDate(newEndDate.toISOString().split('T')[0]);
    
    applyDateRange(newStartDate, newEndDate);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Current Range Display */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Timeline Range:</span>
            <span className="ml-2 text-gray-800">
              {formatDate(timeline.startDate)} - {formatDate(timeline.endDate)}
            </span>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center space-x-4">
          {/* Quick Presets */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Quick:</span>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => handlePreset(preset.days)}
                variant={preset.isDefault ? "default" : "outline"}
                size="sm"
                disabled={isUpdating}
                className={`text-xs px-2 py-1 ${preset.isDefault ? 'bg-blue-600 hover:bg-blue-700 text-white font-medium' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'}`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-300"></div>

          {/* Custom Date Range */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Custom:</span>
            <div className="flex items-center space-x-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 text-sm"
                disabled={isUpdating}
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 text-sm"
                disabled={isUpdating}
              />
              <Button
                onClick={handleApplyDates}
                size="sm"
                disabled={isUpdating || !startDate || !endDate || !hasChanges()}
                className={`text-sm px-3 ${hasChanges() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 border-gray-200'} disabled:opacity-50`}
              >
                {isUpdating ? 'Updating...' : hasChanges() ? 'Apply Changes' : 'Apply'}
              </Button>
              
              {hasChanges() && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  disabled={isUpdating}
                  className="text-sm px-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-800 disabled:opacity-50"
                  title="Reset to current timeline dates"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangeControls;