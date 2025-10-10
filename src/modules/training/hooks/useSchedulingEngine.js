import { useMemo } from 'react';
import { ClassroomOccupancyTracker } from '@core/utils/classroomCalculations';
import { scheduleByGroupComplete } from './scheduleByGroupComplete';
import { scheduleByCourseComplete } from './scheduleByCourseComplete';

/**
 * Custom hook for training session scheduling algorithms
 * Provides both group-complete and course-complete scheduling modes
 */
export const useSchedulingEngine = () => {
  
  const createSchedulingEngine = useMemo(() => {
    
    return {
      scheduleByGroupComplete,
      scheduleByCourseComplete
    };
  }, []);

  return createSchedulingEngine;
};