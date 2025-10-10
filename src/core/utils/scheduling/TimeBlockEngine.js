/**
 * TimeBlockEngine - Dynamic time block management for flexible scheduling
 * 
 * Replaces hardcoded AM/PM logic with flexible time block parsing from criteria.
 * Supports any time configuration defined in the Define Criteria page.
 */

/**
 * Parse time string (24-hour format) to hour decimal
 * @param {string} timeStr - Time in format "HH:MM" (e.g., "08:00", "13:30")
 * @returns {number} Time as decimal hours (e.g., 8.0, 13.5)
 */
export const parseTimeToHours = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`Invalid time string: ${timeStr}`);
  }
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM format`);
  }
  
  return hours + (minutes / 60);
};

/**
 * Calculate duration between two times
 * @param {string} startTime - Start time in "HH:MM" format
 * @param {string} endTime - End time in "HH:MM" format
 * @returns {number} Duration in hours
 */
export const calculateDuration = (startTime, endTime) => {
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  
  if (end <= start) {
    throw new Error(`End time (${endTime}) must be after start time (${startTime})`);
  }
  
  return end - start;
};

/**
 * TimeBlockEngine class for managing flexible time blocks
 */
export class TimeBlockEngine {
  constructor(criteria) {
    this.criteria = criteria;
    this.schedulingPreference = criteria.scheduling_preference || 'both';
    this.schedulingDays = criteria.scheduling_days || [];
    
    // Parse time blocks from criteria
    this.timeBlocks = this._parseTimeBlocks();
    this.maxDailyHours = this._calculateMaxDailyHours();
    
    console.log('🕒 TimeBlockEngine initialized:', {
      schedulingPreference: this.schedulingPreference,
      timeBlocks: this.timeBlocks,
      maxDailyHours: this.maxDailyHours,
      schedulingDays: this.schedulingDays
    });
  }
  
  /**
   * Parse time blocks from criteria
   * @private
   */
  _parseTimeBlocks() {
    const blocks = [];
    
    // Block 1 (traditionally "morning")
    if ((this.schedulingPreference === 'both' || this.schedulingPreference === 'am_only') &&
        this.criteria.start_time_am && this.criteria.end_time_am) {
      try {
        const duration = calculateDuration(this.criteria.start_time_am, this.criteria.end_time_am);
        blocks.push({
          id: 1,
          name: 'Block 1',
          start: this.criteria.start_time_am,
          end: this.criteria.end_time_am,
          startHours: parseTimeToHours(this.criteria.start_time_am),
          endHours: parseTimeToHours(this.criteria.end_time_am),
          duration: duration
        });
      } catch (error) {
        console.warn('⚠️ Invalid Block 1 time configuration:', error.message);
      }
    }
    
    // Block 2 (traditionally "afternoon")
    if ((this.schedulingPreference === 'both' || this.schedulingPreference === 'pm_only') &&
        this.criteria.start_time_pm && this.criteria.end_time_pm) {
      try {
        const duration = calculateDuration(this.criteria.start_time_pm, this.criteria.end_time_pm);
        blocks.push({
          id: 2,
          name: 'Block 2',
          start: this.criteria.start_time_pm,
          end: this.criteria.end_time_pm,
          startHours: parseTimeToHours(this.criteria.start_time_pm),
          endHours: parseTimeToHours(this.criteria.end_time_pm),
          duration: duration
        });
      } catch (error) {
        console.warn('⚠️ Invalid Block 2 time configuration:', error.message);
      }
    }
    
    if (blocks.length === 0) {
      throw new Error('No valid time blocks found in criteria. Please check time configuration.');
    }
    
    return blocks;
  }
  
  /**
   * Calculate maximum hours available per day
   * @private
   */
  _calculateMaxDailyHours() {
    return this.timeBlocks.reduce((total, block) => total + block.duration, 0);
  }
  
  /**
   * Get available time blocks
   * @returns {Array} Array of time block objects
   */
  getTimeBlocks() {
    return [...this.timeBlocks];
  }
  
  /**
   * Get maximum daily hours available
   * @returns {number} Maximum hours per day
   */
  getMaxDailyHours() {
    return this.maxDailyHours;
  }
  
  /**
   * Check if a duration can fit in a single time block
   * @param {number} duration - Duration in hours
   * @returns {Object|null} Time block that can fit the duration, or null
   */
  findSingleBlockFit(duration) {
    return this.timeBlocks.find(block => block.duration >= duration) || null;
  }
  
  /**
   * Check if a duration can fit in a single day across multiple blocks
   * @param {number} duration - Duration in hours
   * @returns {boolean} True if duration fits in one day
   */
  canFitInSingleDay(duration) {
    return duration <= this.maxDailyHours;
  }
  
  /**
   * Calculate how many days are needed for a given duration
   * @param {number} duration - Duration in hours
   * @returns {number} Number of days needed
   */
  calculateDaysNeeded(duration) {
    if (duration <= 0) return 0;
    return Math.ceil(duration / this.maxDailyHours);
  }
  
  /**
   * Get the next valid scheduling date from a given date
   * @param {Date} fromDate - Starting date
   * @param {Array} dayNames - Array of day names ['Sunday', 'Monday', ...]
   * @returns {Date} Next valid scheduling date
   */
  getNextValidDate(fromDate, dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
    const date = new Date(fromDate);
    
    while (!this.schedulingDays.includes(dayNames[date.getDay()])) {
      date.setDate(date.getDate() + 1);
    }
    
    return date;
  }
  
  /**
   * Set time on a date to match a time block start
   * @param {Date} date - Date to modify
   * @param {number} blockId - Time block ID (1 or 2)
   * @returns {Date} Modified date with time set
   */
  setDateToBlockStart(date, blockId = 1) {
    const block = this.timeBlocks.find(b => b.id === blockId);
    if (!block) {
      throw new Error(`Time block ${blockId} not found`);
    }
    
    const [hours, minutes] = block.start.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }
  
  /**
   * Get time block that contains a specific time
   * @param {number} timeHours - Time in decimal hours (e.g., 9.5 for 09:30)
   * @returns {Object|null} Time block containing the time, or null
   */
  getBlockContainingTime(timeHours) {
    return this.timeBlocks.find(block => 
      timeHours >= block.startHours && timeHours < block.endHours
    ) || null;
  }
  
  /**
   * Validate time block configuration
   * @returns {Object} Validation result with errors and warnings
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    if (this.timeBlocks.length === 0) {
      errors.push('No time blocks configured');
    }
    
    if (this.schedulingDays.length === 0) {
      errors.push('No scheduling days configured');
    }
    
    // Check for overlapping time blocks
    if (this.timeBlocks.length > 1) {
      for (let i = 0; i < this.timeBlocks.length - 1; i++) {
        const current = this.timeBlocks[i];
        const next = this.timeBlocks[i + 1];
        
        if (current.endHours > next.startHours) {
          errors.push(`Time blocks overlap: ${current.name} ends at ${current.end}, ${next.name} starts at ${next.start}`);
        }
      }
    }
    
    // Check for very short time blocks
    this.timeBlocks.forEach(block => {
      if (block.duration < 1) {
        warnings.push(`Time block ${block.name} is very short (${block.duration} hours)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default TimeBlockEngine;