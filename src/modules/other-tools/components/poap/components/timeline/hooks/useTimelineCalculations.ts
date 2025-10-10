import { useMemo, useState, useEffect } from 'react';
import type { TimelineConfig } from '../../../types';

interface TimePeriod {
  label: string;
  start: Date;
  end: Date;
  widthPercent: number;
  startPixel?: number;
  endPixel?: number;
  widthPixels?: number;
}

interface YearPeriod extends TimePeriod {
  year: number;
  startPixel: number;
  endPixel: number;
  widthPixels: number;
  startPercent: number;
}

interface MonthPeriod extends TimePeriod {
  month: number;
  year: number;
  startPixel: number;
  endPixel: number;
  widthPixels: number;
  startPercent: number;
}

interface WeekPeriod extends TimePeriod {
  weekNumber: number;
  startPixel: number;
  endPixel: number;
  widthPixels: number;
  startPercent: number;
}

export const useTimelineCalculations = (timeline: TimelineConfig, containerWidth?: number) => {
  const { startDate, endDate } = timeline;
  
  // Dynamic width calculation
  const [screenWidth, setScreenWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1800; // SSR fallback
  });

  // Listen for window resize events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculations = useMemo(() => {
    const totalDuration = endDate.getTime() - startDate.getTime();

    // DYNAMIC PIXEL-PERFECT TIMELINE SYSTEM
    // Use container width if provided, otherwise calculate based on screen
    // Reserve space for left sidebar (200px) and padding/scrollbar (50px)
    const availableWidth = containerWidth || (screenWidth - 250);
    const TIMELINE_WIDTH_PX = Math.max(availableWidth, 800); // Minimum 800px width
    const pixelsPerMs = TIMELINE_WIDTH_PX / totalDuration;
    
    return { totalDuration, TIMELINE_WIDTH_PX, pixelsPerMs };
  }, [startDate, endDate, screenWidth, containerWidth]);

  // Helper functions that depend on the calculations
  const getPixelPosition = (date: Date): number => {
    return Math.round((date.getTime() - startDate.getTime()) * calculations.pixelsPerMs);
  };
  
  const getDateFromPixel = (pixels: number): Date => {
    return new Date(startDate.getTime() + (pixels / calculations.pixelsPerMs));
  };

  const timelinePeriods = useMemo(() => {
    const { totalDuration, TIMELINE_WIDTH_PX } = calculations;

    // Generate Years with pixel-perfect positioning
    const years: YearPeriod[] = [];
    let currentYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    while (currentYear <= endYear) {
      // Create exact year boundaries
      const yearStartOfYear = new Date(currentYear, 0, 1); // January 1st 
      const yearEndOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999); // December 31st
      
      // Clip to timeline bounds
      const yearStart = new Date(Math.max(yearStartOfYear.getTime(), startDate.getTime()));
      const yearEnd = new Date(Math.min(yearEndOfYear.getTime(), endDate.getTime()));
      
      const startPixel = getPixelPosition(yearStart);
      const endPixel = getPixelPosition(yearEnd);
      const widthPixels = endPixel - startPixel;
      
      if (widthPixels > 20) { // Minimum 20px width for visibility
        years.push({
          label: currentYear.toString(),
          year: currentYear,
          start: yearStart,
          end: yearEnd,
          widthPercent: (widthPixels / TIMELINE_WIDTH_PX) * 100, // Convert back to % for compatibility
          startPercent: (startPixel / TIMELINE_WIDTH_PX) * 100, // Start position as percentage
          startPixel,
          endPixel,
          widthPixels
        });
      }

      currentYear++;
    }

    // Generate Months
    const months: MonthPeriod[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (currentMonth <= lastMonth) {
      // Create exact month boundaries 
      const monthStartOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1); // 1st of month
      const monthEndOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of month
      
      // Clip to timeline bounds
      const monthStart = new Date(Math.max(monthStartOfMonth.getTime(), startDate.getTime()));
      const monthEnd = new Date(Math.min(monthEndOfMonth.getTime(), endDate.getTime()));
      
      const startPixel = getPixelPosition(monthStart);
      const endPixel = getPixelPosition(monthEnd);
      const widthPixels = endPixel - startPixel;

      if (widthPixels > 10) { // Minimum 10px width for visibility
        months.push({
          label: monthNames[currentMonth.getMonth()],
          month: currentMonth.getMonth(),
          year: currentMonth.getFullYear(),
          start: monthStart,
          end: monthEnd,
          widthPercent: (widthPixels / TIMELINE_WIDTH_PX) * 100,
          startPercent: (startPixel / TIMELINE_WIDTH_PX) * 100, // Start position as percentage
          startPixel,
          endPixel,
          widthPixels
        });
      }

      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    }

    // Generate Weeks with equal width for grid layout
    const weeks: WeekPeriod[] = [];
    let currentWeek = new Date(startDate);
    // Start from the beginning of the week (Sunday)
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());

    // First, collect all weeks to determine total count
    const tempWeeks = [];
    let tempCurrentWeek = new Date(currentWeek);
    while (tempCurrentWeek < endDate) {
      const weekStart = new Date(Math.max(tempCurrentWeek.getTime(), startDate.getTime()));
      const weekEnd = new Date(tempCurrentWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
      const clampedWeekEnd = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));
      
      if (weekStart < clampedWeekEnd) { // Only add if there's actual time in this week
        tempWeeks.push({ weekStart, clampedWeekEnd });
      }
      
      tempCurrentWeek = new Date(tempCurrentWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // Now calculate equal width for all weeks
    const equalWidthPercent = tempWeeks.length > 0 ? 100 / tempWeeks.length : 0;
    
    let weekNumber = 1;
    tempWeeks.forEach(({ weekStart, clampedWeekEnd }, index) => {
      const startPixel = getPixelPosition(weekStart);
      const endPixel = getPixelPosition(clampedWeekEnd);
      const widthPixels = endPixel - startPixel;

      weeks.push({
        label: weekStart.getDate().toString(),
        weekNumber,
        start: weekStart,
        end: clampedWeekEnd,
        widthPercent: equalWidthPercent, // Equal width for all weeks
        startPercent: index * equalWidthPercent, // Equal spacing
        startPixel,
        endPixel,
        widthPixels
      });
      
      weekNumber++;
    });

    return { years, months, weeks };
  }, [startDate, endDate, getPixelPosition]);

  // Calculate today's position in pixels
  const getTodayPosition = (): number | null => {
    const today = new Date();
    
    if (today < startDate || today > endDate) {
      return null;
    }

    return getPixelPosition(today);
  };

  // Calculate today's position as percentage
  const getTodayPercentage = (): number | null => {
    const today = new Date();
    
    if (today < startDate || today > endDate) {
      return null;
    }

    const pixelPosition = getPixelPosition(today);
    return (pixelPosition / calculations.TIMELINE_WIDTH_PX) * 100;
  };

  // Calculate position for any date in percentage
  const getDatePosition = (date: Date): number => {
    const dateOffset = Math.max(0, date.getTime() - startDate.getTime());
    return (dateOffset / calculations.totalDuration) * 100;
  };

  // Calculate pixel position for any date
  const getDatePixelPosition = (date: Date): number => {
    return getPixelPosition(date);
  };

  // Calculate card positioning (legacy percentage-based)
  const getCardPosition = (cardStartDate: Date, cardEndDate: Date) => {
    const startPos = getDatePosition(cardStartDate);
    const endPos = getDatePosition(cardEndDate);
    const width = Math.max(endPos - startPos, 0.5);
    
    
    return {
      left: startPos,
      width: Math.max(width, 0.1) // Very small minimum width for visibility
    };
  };

  // Calculate card positioning using pixel-perfect system
  const getCardPixelPosition = (cardStartDate: Date, cardEndDate: Date) => {
    const startPixel = getPixelPosition(cardStartDate);
    const endPixel = getPixelPosition(cardEndDate);
    const widthPixels = Math.max(endPixel - startPixel, 8); // Minimum 8px width for visibility
    
    return {
      left: startPixel,
      width: widthPixels
    };
  };

  return {
    ...timelinePeriods,
    totalDuration: calculations.totalDuration,
    TIMELINE_WIDTH_PX: calculations.TIMELINE_WIDTH_PX,
    getTodayPosition,
    getTodayPercentage, // New percentage-based today position
    getDatePosition, // Legacy percentage-based positioning
    getDatePixelPosition, // New pixel-perfect positioning
    getCardPosition, // Legacy percentage-based positioning
    getCardPixelPosition, // New pixel-perfect positioning
    // Pixel-perfect timeline functions
    getPixelPosition,
    getDateFromPixel
  };
};