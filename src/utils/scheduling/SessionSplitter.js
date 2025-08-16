/**
 * SessionSplitter - Intelligent session duration splitting
 * 
 * Handles splitting any course duration (1-24 hours) across available time blocks
 * and multiple days as needed. Replaces hardcoded 4/8-hour logic.
 */

import { TimeBlockEngine } from './TimeBlockEngine.js';

/**
 * SessionSplitter class for intelligent course duration splitting
 */
export class SessionSplitter {
  constructor(timeBlockEngine) {
    if (!(timeBlockEngine instanceof TimeBlockEngine)) {
      throw new Error('SessionSplitter requires a TimeBlockEngine instance');
    }
    
    this.timeBlockEngine = timeBlockEngine;
    this.timeBlocks = timeBlockEngine.getTimeBlocks();
    this.maxDailyHours = timeBlockEngine.getMaxDailyHours();
    
    console.log('✂️ SessionSplitter initialized with:', {
      timeBlocks: this.timeBlocks.length,
      maxDailyHours: this.maxDailyHours
    });
  }
  
  /**
   * Split a course duration into session parts
   * @param {number} duration - Course duration in hours
   * @param {Object} options - Splitting options
   * @returns {Array} Array of session parts
   */
  splitCourse(duration, options = {}) {
    const {
      courseName = 'Course',
      sessionNumber = 1,
      startDate = new Date(),
      dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    } = options;
    
    if (duration <= 0) {
      throw new Error(`Invalid course duration: ${duration} hours`);
    }
    
    if (duration > 24) {
      console.warn(`⚠️ Course duration ${duration} hours exceeds maximum 24 hours, truncating`);
      duration = 24;
    }
    
    console.log(`✂️ Splitting ${duration}-hour course into session parts`);
    
    // Determine splitting strategy
    const strategy = this._determineSplittingStrategy(duration);
    console.log(`📋 Using splitting strategy: ${strategy.type}`);
    
    // Generate session parts based on strategy
    return this._generateSessionParts(duration, strategy, {
      courseName,
      sessionNumber,
      startDate,
      dayNames
    });
  }
  
  /**
   * Determine the best splitting strategy for a given duration
   * @param {number} duration - Course duration in hours
   * @returns {Object} Splitting strategy
   * @private
   */
  _determineSplittingStrategy(duration) {
    // Strategy 1: Single time block (fits entirely in one block)
    const singleBlockFit = this.timeBlockEngine.findSingleBlockFit(duration);
    if (singleBlockFit) {
      return {
        type: 'SINGLE_BLOCK',
        block: singleBlockFit,
        totalParts: 1,
        totalDays: 1
      };
    }
    
    // Strategy 2: Same day split (fits in multiple blocks on same day)
    if (this.timeBlockEngine.canFitInSingleDay(duration)) {
      return {
        type: 'SAME_DAY_SPLIT',
        totalParts: this._calculatePartsForSameDay(duration),
        totalDays: 1
      };
    }
    
    // Strategy 3: Multi-day split (requires multiple days)
    const daysNeeded = this.timeBlockEngine.calculateDaysNeeded(duration);
    return {
      type: 'MULTI_DAY_SPLIT',
      totalParts: this._calculatePartsForMultiDay(duration),
      totalDays: daysNeeded
    };
  }
  
  /**
   * Calculate number of parts needed for same-day splitting
   * @param {number} duration - Course duration in hours
   * @returns {number} Number of parts needed
   * @private
   */
  _calculatePartsForSameDay(duration) {
    let remainingDuration = duration;
    let parts = 0;
    
    for (const block of this.timeBlocks) {
      if (remainingDuration <= 0) break;
      
      if (remainingDuration >= block.duration) {
        // Use entire block
        remainingDuration -= block.duration;
        parts++;
      } else {
        // Use partial block
        parts++;
        remainingDuration = 0;
      }
    }
    
    return parts;
  }
  
  /**
   * Calculate number of parts needed for multi-day splitting
   * @param {number} duration - Course duration in hours
   * @returns {number} Number of parts needed
   * @private
   */
  _calculatePartsForMultiDay(duration) {
    const fullDays = Math.floor(duration / this.maxDailyHours);
    const remainingHours = duration % this.maxDailyHours;
    
    let totalParts = fullDays * this.timeBlocks.length;
    
    if (remainingHours > 0) {
      totalParts += this._calculatePartsForSameDay(remainingHours);
    }
    
    return totalParts;
  }
  
  /**
   * Generate session parts based on strategy
   * @param {number} duration - Course duration in hours
   * @param {Object} strategy - Splitting strategy
   * @param {Object} options - Generation options
   * @returns {Array} Array of session parts
   * @private
   */
  _generateSessionParts(duration, strategy, options) {
    const { courseName, sessionNumber, startDate, dayNames } = options;
    
    switch (strategy.type) {
      case 'SINGLE_BLOCK':
        return this._generateSingleBlockParts(duration, strategy, options);
      
      case 'SAME_DAY_SPLIT':
        return this._generateSameDayParts(duration, strategy, options);
      
      case 'MULTI_DAY_SPLIT':
        return this._generateMultiDayParts(duration, strategy, options);
      
      default:
        throw new Error(`Unknown splitting strategy: ${strategy.type}`);
    }
  }
  
  /**
   * Generate parts for single block strategy
   * @private
   */
  _generateSingleBlockParts(duration, strategy, options) {
    const { courseName, sessionNumber, startDate, dayNames } = options;
    const block = strategy.block;
    
    // Find next valid scheduling date
    const sessionDate = this.timeBlockEngine.getNextValidDate(startDate, dayNames);
    const sessionStart = this.timeBlockEngine.setDateToBlockStart(sessionDate, block.id);
    const sessionEnd = new Date(sessionStart.getTime() + (duration * 60 * 60 * 1000));
    
    return [{
      part: 1,
      totalParts: 1,
      day: 1,
      totalDays: 1,
      start: sessionStart,
      end: sessionEnd,
      duration: duration,
      blockId: block.id,
      blockName: block.name,
      title: `${courseName} - Group ${sessionNumber}`,
      sessionId: `${courseName.replace(/\s+/g, '-').toLowerCase()}-${sessionNumber}-part1-${sessionStart.getTime()}`
    }];
  }
  
  /**
   * Generate parts for same-day split strategy
   * @private
   */
  _generateSameDayParts(duration, strategy, options) {
    const { courseName, sessionNumber, startDate, dayNames } = options;
    const parts = [];
    let remainingDuration = duration;
    let partNumber = 1;
    
    // Find next valid scheduling date
    const sessionDate = this.timeBlockEngine.getNextValidDate(startDate, dayNames);
    
    for (const block of this.timeBlocks) {
      if (remainingDuration <= 0) break;
      
      const partDuration = Math.min(remainingDuration, block.duration);
      const partStart = this.timeBlockEngine.setDateToBlockStart(sessionDate, block.id);
      const partEnd = new Date(partStart.getTime() + (partDuration * 60 * 60 * 1000));
      
      parts.push({
        part: partNumber,
        totalParts: strategy.totalParts,
        day: 1,
        totalDays: 1,
        start: partStart,
        end: partEnd,
        duration: partDuration,
        blockId: block.id,
        blockName: block.name,
        title: `${courseName} - Group ${sessionNumber} Part ${partNumber}`,
        sessionId: `${courseName.replace(/\s+/g, '-').toLowerCase()}-${sessionNumber}-part${partNumber}-${partStart.getTime()}`
      });
      
      remainingDuration -= partDuration;
      partNumber++;
    }
    
    return parts;
  }
  
  /**
   * Generate parts for multi-day split strategy
   * @private
   */
  _generateMultiDayParts(duration, strategy, options) {
    const { courseName, sessionNumber, startDate, dayNames } = options;
    const parts = [];
    let remainingDuration = duration;
    let partNumber = 1;
    let dayNumber = 1;
    
    let currentDate = new Date(startDate);
    
    while (remainingDuration > 0) {
      // Find next valid scheduling date
      currentDate = this.timeBlockEngine.getNextValidDate(currentDate, dayNames);
      
      // Calculate how much duration to allocate to this day
      const dayDuration = Math.min(remainingDuration, this.maxDailyHours);
      
      // Split this day's duration across available time blocks
      let dayRemainingDuration = dayDuration;
      
      for (const block of this.timeBlocks) {
        if (dayRemainingDuration <= 0) break;
        
        const partDuration = Math.min(dayRemainingDuration, block.duration);
        const partStart = this.timeBlockEngine.setDateToBlockStart(currentDate, block.id);
        const partEnd = new Date(partStart.getTime() + (partDuration * 60 * 60 * 1000));
        
        parts.push({
          part: partNumber,
          totalParts: strategy.totalParts,
          day: dayNumber,
          totalDays: strategy.totalDays,
          start: partStart,
          end: partEnd,
          duration: partDuration,
          blockId: block.id,
          blockName: block.name,
          title: `${courseName} - Group ${sessionNumber} Part ${partNumber}`,
          sessionId: `${courseName.replace(/\s+/g, '-').toLowerCase()}-${sessionNumber}-part${partNumber}-${partStart.getTime()}`
        });
        
        dayRemainingDuration -= partDuration;
        partNumber++;
      }
      
      remainingDuration -= dayDuration;
      dayNumber++;
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return parts;
  }
  
  /**
   * Validate that session parts don't exceed maximum constraints
   * @param {Array} parts - Session parts to validate
   * @returns {Object} Validation result
   */
  validateSessionParts(parts) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(parts) || parts.length === 0) {
      errors.push('No session parts provided');
      return { isValid: false, errors, warnings };
    }
    
    // Check total duration consistency
    const totalDuration = parts.reduce((sum, part) => sum + part.duration, 0);
    const maxAllowedDuration = 24; // 3 days × 8 hours max
    
    if (totalDuration > maxAllowedDuration) {
      errors.push(`Total duration ${totalDuration} hours exceeds maximum ${maxAllowedDuration} hours`);
    }
    
    // Check day sequence
    const maxDay = Math.max(...parts.map(part => part.day));
    if (maxDay > 3) {
      errors.push(`Course spans ${maxDay} days, maximum allowed is 3 days`);
    }
    
    // Check part numbering
    const partNumbers = parts.map(part => part.part).sort((a, b) => a - b);
    for (let i = 0; i < partNumbers.length; i++) {
      if (partNumbers[i] !== i + 1) {
        errors.push(`Part numbering is not sequential: expected ${i + 1}, found ${partNumbers[i]}`);
        break;
      }
    }
    
    // Warnings for very short parts
    parts.forEach(part => {
      if (part.duration < 0.5) {
        warnings.push(`Part ${part.part} is very short (${part.duration} hours)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalDuration,
      totalParts: parts.length,
      totalDays: maxDay
    };
  }
}

export default SessionSplitter;