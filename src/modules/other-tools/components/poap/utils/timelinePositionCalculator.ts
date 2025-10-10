import type { TimelineConfig, Position, DateRange, TimePeriod, TimeScale } from '../types';

export class TimelinePositionCalculator {
  private config: TimelineConfig;
  private containerWidth: number;
  
  constructor(config: TimelineConfig, containerWidth: number) {
    this.config = config;
    this.containerWidth = containerWidth;
  }
  
  // Calculate position for a date range
  calculatePositionForDateRange(dateRange: DateRange): {
    position: Position;
    width: number;
  } {
    const timelineDuration = this.config.endDate.getTime() - this.config.startDate.getTime();
    const startOffset = dateRange.start.getTime() - this.config.startDate.getTime();
    const endOffset = dateRange.end.getTime() - this.config.startDate.getTime();
    
    const x = (startOffset / timelineDuration) * this.containerWidth;
    const width = ((endOffset - startOffset) / timelineDuration) * this.containerWidth;
    
    return {
      position: { x, y: 0 },
      width
    };
  }
  
  // Calculate position for a single date (for milestones)
  calculatePositionForDate(date: Date): Position {
    const timelineDuration = this.config.endDate.getTime() - this.config.startDate.getTime();
    const offset = date.getTime() - this.config.startDate.getTime();
    
    const x = (offset / timelineDuration) * this.containerWidth;
    
    return { x, y: 0 };
  }
  
  // Calculate date from position
  calculateDateFromPosition(x: number): Date {
    const timelineDuration = this.config.endDate.getTime() - this.config.startDate.getTime();
    const offset = (x / this.containerWidth) * timelineDuration;
    
    return new Date(this.config.startDate.getTime() + offset);
  }
  
  // Calculate date range from position and width
  calculateDateRangeFromPositionAndWidth(x: number, width: number): DateRange {
    const startDate = this.calculateDateFromPosition(x);
    const endDate = this.calculateDateFromPosition(x + width);
    
    return { start: startDate, end: endDate };
  }
  
  // Snap position to grid if enabled
  snapToGrid(position: Position): Position {
    if (!this.config.snapToGrid) {
      return position;
    }
    
    const gridSize = this.getGridSize();
    
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }
  
  // Get grid size based on timeline scale
  private getGridSize(): number {
    switch (this.config.scale) {
      case 'weeks':
        return this.containerWidth / 12; // 12 weeks visible by default
      case 'months':
        return this.containerWidth / 6; // 6 months visible by default
      case 'quarters':
        return this.containerWidth / 4; // 4 quarters visible by default
      default:
        return 50; // Default grid size
    }
  }
  
  // Update container width (useful for responsive design)
  updateContainerWidth(width: number): void {
    this.containerWidth = width;
  }
  
  // Update timeline config
  updateConfig(config: TimelineConfig): void {
    this.config = config;
  }
}

// Helper function to calculate time periods based on timeline config
export function calculateTimePeriods(config: TimelineConfig): TimePeriod[] {
  const periods: TimePeriod[] = [];
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  
  let currentDate = new Date(startDate);
  let index = 0;
  
  while (currentDate <= endDate) {
    let periodEndDate: Date;
    let label: string;
    
    switch (config.scale) {
      case 'weeks':
        periodEndDate = new Date(currentDate);
        periodEndDate.setDate(currentDate.getDate() + 7);
        label = `W${getWeekNumber(currentDate)}`;
        break;
        
      case 'months':
        periodEndDate = new Date(currentDate);
        periodEndDate.setMonth(currentDate.getMonth() + 1);
        label = formatDate(currentDate, 'MMM');
        break;
        
      case 'quarters':
        periodEndDate = new Date(currentDate);
        periodEndDate.setMonth(currentDate.getMonth() + 3);
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
        label = `Q${quarter}`;
        break;
        
      default:
        periodEndDate = new Date(currentDate);
        periodEndDate.setDate(currentDate.getDate() + 7);
        label = formatDate(currentDate, 'MMM d');
    }
    
    // Ensure we don't go past the end date
    if (periodEndDate > endDate) {
      periodEndDate = new Date(endDate);
    }
    
    periods.push({
      startDate: new Date(currentDate),
      endDate: periodEndDate,
      label,
      index
    });
    
    currentDate = periodEndDate;
    index++;
  }
  
  return periods;
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to format date
function formatDate(date: Date, format: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  switch (format) {
    case 'MMM':
      return months[date.getMonth()];
    case 'MMM d':
      return `${months[date.getMonth()]} ${date.getDate()}`;
    default:
      return date.toLocaleDateString();
  }
}