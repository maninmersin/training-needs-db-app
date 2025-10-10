/**
 * Classroom calculation utilities extracted from TrainingSessionCalculator
 * Used for calculating classroom capacity constraints in the Training Schedule Wizard
 */

/**
 * Calculate classroom capacity metrics for a given criteria
 * @param {Object} criteria - Training criteria containing scheduling parameters
 * @returns {Object} Classroom capacity calculations
 */
export const calculateClassroomCapacity = (criteria) => {
  if (!criteria) {
    return {
      classroomHoursPerWeek: 0,
      classroomHoursAvailable: 0,
      classroomUserHoursCapacity: 0,
      isValid: false
    };
  }

  const classroomHoursPerWeek = criteria.days_per_week * criteria.daily_hours;
  const classroomHoursAvailable = classroomHoursPerWeek * criteria.total_weeks;
  const classroomUserHoursCapacity = classroomHoursAvailable * criteria.max_attendees;

  return {
    classroomHoursPerWeek,
    classroomHoursAvailable,
    classroomUserHoursCapacity,
    isValid: classroomHoursPerWeek > 0 && criteria.max_attendees > 0
  };
};

/**
 * Calculate number of classrooms needed for given training requirements
 * @param {number} totalTrainingHours - Total training hours required
 * @param {Object} criteria - Training criteria
 * @returns {Object} Classroom requirements
 */
export const calculateClassroomsNeeded = (totalTrainingHours, criteria) => {
  const capacity = calculateClassroomCapacity(criteria);
  
  if (!capacity.isValid || capacity.classroomUserHoursCapacity === 0) {
    return {
      numberOfClassrooms: 0,
      totalTrainingHours: totalTrainingHours || 0,
      ...capacity,
      isValid: false
    };
  }

  // Apply contingency factor if specified
  const adjustedTrainingHours = totalTrainingHours * (criteria.contingency || 1);
  const numberOfClassrooms = Math.ceil(adjustedTrainingHours / capacity.classroomUserHoursCapacity);

  return {
    numberOfClassrooms,
    totalTrainingHours: adjustedTrainingHours,
    rawTrainingHours: totalTrainingHours,
    contingencyFactor: criteria.contingency || 1,
    ...capacity,
    isValid: true
  };
};

/**
 * Calculate classroom requirements for grouped training data
 * @param {Object} groupedData - Data grouped by location/functional area
 * @param {Object} criteria - Training criteria
 * @returns {Array} Array of classroom requirement calculations
 */
export const calculateGroupedClassroomRequirements = (groupedData, criteria) => {
  if (!groupedData || !criteria) {
    return [];
  }

  return Object.entries(groupedData).map(([key, userMap]) => {
    const [country, training_location, functional_area] = key.split('|');
    const uniqueUserCount = userMap.size;

    let totalTrainingHours = 0;
    for (const user of userMap.values()) {
      for (const duration of user.courses.values()) {
        totalTrainingHours += duration;
      }
    }

    const classroomReq = calculateClassroomsNeeded(totalTrainingHours, criteria);

    return {
      country,
      training_location,
      functional_area,
      uniqueUserCount,
      ...classroomReq,
      groupKey: key
    };
  });
};

/**
 * Validate if classroom capacity is sufficient for planned sessions
 * @param {number} requiredClassrooms - Number of classrooms needed
 * @param {number} availableClassrooms - Number of classrooms available (optional, defaults to checking feasibility)
 * @returns {Object} Validation result
 */
export const validateClassroomCapacity = (requiredClassrooms, availableClassrooms = null) => {
  const isValid = requiredClassrooms > 0;
  const isExcessive = requiredClassrooms > 10; // Arbitrary threshold for "excessive" requirements
  
  let status = 'valid';
  let message = '';
  let severity = 'info';

  if (!isValid) {
    status = 'invalid';
    message = 'Unable to calculate classroom requirements';
    severity = 'error';
  } else if (availableClassrooms !== null) {
    if (requiredClassrooms > availableClassrooms) {
      status = 'insufficient';
      message = `Requires ${requiredClassrooms} classrooms but only ${availableClassrooms} available`;
      severity = 'error';
    } else {
      status = 'sufficient';
      message = `${requiredClassrooms} classrooms needed, ${availableClassrooms} available`;
      severity = 'success';
    }
  } else if (isExcessive) {
    status = 'warning';
    message = `High classroom requirement: ${requiredClassrooms} classrooms needed`;
    severity = 'warning';
  } else {
    status = 'feasible';
    message = `${requiredClassrooms} classrooms required`;
    severity = 'info';
  }

  return {
    isValid,
    status,
    message,
    severity,
    requiredClassrooms,
    availableClassrooms
  };
};

/**
 * Track classroom occupancy for scheduling conflicts with specific classroom assignments
 */
export class ClassroomOccupancyTracker {
  constructor() {
    this.occupancy = new Map(); // locationKey -> timeSlot -> Set of occupied classroom numbers
    this.assignments = new Map(); // sessionId -> { locationKey, timeSlot, classroomNumber }
  }

  /**
   * Get occupancy key for a specific time slot
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @returns {string} Time slot key
   */
  getTimeSlotKey(startTime, endTime) {
    const startStr = startTime.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    const endStr = endTime.toISOString().slice(0, 16);
    return `${startStr}|${endStr}`;
  }

  /**
   * Parse time slot key back to start and end times
   * @param {string} timeSlotKey - Time slot key in format "YYYY-MM-DDTHH:mm|YYYY-MM-DDTHH:mm"
   * @returns {Array} Array with [startTime, endTime] as Date objects
   */
  parseTimeSlotKey(timeSlotKey) {
    const [startStr, endStr] = timeSlotKey.split('|');
    return [new Date(startStr), new Date(endStr)];
  }

  /**
   * Check if a classroom is available for a session
   * @param {string} locationKey - Training location identifier
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @param {number} maxClassrooms - Maximum classrooms available at location
   * @returns {boolean} True if classroom is available
   */
  isClassroomAvailable(locationKey, startTime, endTime, maxClassrooms) {
    if (!this.occupancy.has(locationKey)) {
      return true;
    }

    // Check classroom availability for the exact requested time slot
    // This ensures consistency between availability checking and actual reservation
    const locationOccupancy = this.occupancy.get(locationKey);
    const requestedTimeSlotKey = this.getTimeSlotKey(startTime, endTime);
    
    // First check if the exact time slot exists and how many classrooms are occupied
    if (locationOccupancy.has(requestedTimeSlotKey)) {
      const occupiedClassrooms = locationOccupancy.get(requestedTimeSlotKey);
      const isAvailable = occupiedClassrooms.size < maxClassrooms;
      
      if (!isAvailable) {
        console.log(`🚫 No classroom available at ${locationKey}: ${occupiedClassrooms.size}/${maxClassrooms} classrooms occupied for exact time slot`);
      }
      
      return isAvailable;
    }
    
    // If exact time slot doesn't exist, check for any overlapping time slots
    const overlappingClassrooms = new Set();
    
    for (const [timeSlotKey, occupiedClassroomsSet] of locationOccupancy.entries()) {
      // Parse the time slot key to get start and end times
      const [timeSlotStart, timeSlotEnd] = this.parseTimeSlotKey(timeSlotKey);
      
      // Check if this time slot overlaps with our requested time
      if (this.timePeriodsOverlap(startTime, endTime, timeSlotStart, timeSlotEnd)) {
        // Add all occupied classrooms in this overlapping time slot
        for (const classroomNum of occupiedClassroomsSet) {
          overlappingClassrooms.add(classroomNum);
        }
      }
    }

    // Return true if we have fewer overlapping classrooms than the maximum available
    const isAvailable = overlappingClassrooms.size < maxClassrooms;
    
    if (!isAvailable) {
      console.log(`🚫 No classroom available at ${locationKey}: ${overlappingClassrooms.size}/${maxClassrooms} classrooms occupied`);
    }
    
    return isAvailable;
  }

  /**
   * Check if two time periods overlap
   * @param {Date} start1 - Start time of first period
   * @param {Date} end1 - End time of first period
   * @param {Date} start2 - Start time of second period
   * @param {Date} end2 - End time of second period
   * @returns {boolean} True if periods overlap
   */
  timePeriodsOverlap(start1, end1, start2, end2) {
    // Two periods overlap if: start1 < end2 AND start2 < end1
    return start1 < end2 && start2 < end1;
  }

  /**
   * Find the next available classroom number for a session
   * @param {string} locationKey - Training location identifier
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @param {number} maxClassrooms - Maximum classrooms available at location
   * @returns {number|null} Available classroom number (1-based) or null if none available
   */
  findAvailableClassroom(locationKey, startTime, endTime, maxClassrooms) {
    if (!this.occupancy.has(locationKey)) {
      return 1; // First classroom
    }

    const locationOccupancy = this.occupancy.get(locationKey);
    
    // Collect all classrooms occupied during overlapping time periods
    const occupiedClassrooms = new Set();
    
    for (const [existingTimeSlot, classroomSet] of locationOccupancy) {
      const [existingStartStr, existingEndStr] = existingTimeSlot.split('|');
      const existingStart = new Date(existingStartStr);
      const existingEnd = new Date(existingEndStr);

      // Check if the time periods overlap
      if (this.timePeriodsOverlap(startTime, endTime, existingStart, existingEnd)) {
        // Add all occupied classrooms during this overlapping period
        classroomSet.forEach(classroom => occupiedClassrooms.add(classroom));
      }
    }

    // Find first available classroom number
    for (let classroomNum = 1; classroomNum <= maxClassrooms; classroomNum++) {
      if (!occupiedClassrooms.has(classroomNum)) {
        return classroomNum;
      }
    }

    return null; // No classrooms available
  }

  /**
   * Reserve a specific classroom for a session with load balancing across available classrooms
   * @param {string} locationKey - Training location identifier
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @param {string} sessionId - Unique session identifier
   * @param {number} maxClassrooms - Maximum classrooms available at location (optional)
   * @returns {number|null} Assigned classroom number or null if no classroom available
   */
  reserveClassroom(locationKey, startTime, endTime, sessionId, maxClassrooms = null) {
    if (!this.occupancy.has(locationKey)) {
      this.occupancy.set(locationKey, new Map());
    }

    const locationOccupancy = this.occupancy.get(locationKey);
    const timeSlotKey = this.getTimeSlotKey(startTime, endTime);
    
    if (!locationOccupancy.has(timeSlotKey)) {
      locationOccupancy.set(timeSlotKey, new Set());
    }

    const occupiedClassrooms = locationOccupancy.get(timeSlotKey);
    
    let classroomNumber = 1;
    
    // If maxClassrooms is specified, use load balancing to distribute sessions evenly
    if (maxClassrooms && maxClassrooms > 1) {
      // Extract base session identifier to keep related parts together
      // SessionId format examples: "1-1-am-part1-123456", "1-1-pm-part2-123456", "1-1-123456"
      const baseSessionMatch = sessionId.match(/^(.+-\d+)(?:-(?:am|pm))?(?:-part\d+)?-/);
      const baseSessionId = baseSessionMatch ? baseSessionMatch[1] : sessionId.split('-')[0] + '-' + sessionId.split('-')[1];
      
      console.log(`🔍 CLASSROOM MATCHING: sessionId=${sessionId}, baseSessionId=${baseSessionId}`);
      
      // Check if we already have a classroom assignment for this base session (course + group)
      let existingClassroom = null;
      for (const assignment of this.assignments.values()) {
        if (assignment.locationKey === locationKey) {
          const assignmentBaseMatch = assignment.sessionId?.match(/^(.+-\d+)(?:-(?:am|pm))?(?:-part\d+)?-/);
          const assignmentBaseId = assignmentBaseMatch ? assignmentBaseMatch[1] : 
            (assignment.sessionId ? assignment.sessionId.split('-')[0] + '-' + assignment.sessionId.split('-')[1] : null);
          
          if (assignmentBaseId === baseSessionId) {
            existingClassroom = assignment.classroomNumber;
            console.log(`🎯 FOUND EXISTING: ${baseSessionId} already in classroom ${existingClassroom}`);
            break;
          }
        }
      }
      
      // If we found an existing classroom for this base session, try to use it
      if (existingClassroom && existingClassroom <= maxClassrooms) {
        // Check if the existing classroom is available for this time slot
        if (!occupiedClassrooms.has(existingClassroom)) {
          classroomNumber = existingClassroom;
        } else {
          // If the preferred classroom is occupied, find an alternative but log this
          console.warn(`⚠️ Preferred classroom ${existingClassroom} occupied for ${sessionId}, finding alternative`);
          for (let i = 1; i <= maxClassrooms; i++) {
            if (!occupiedClassrooms.has(i)) {
              classroomNumber = i;
              break;
            }
          }
        }
      } else {
        // No existing assignment found, use load balancing for new base sessions
        // Count how many base sessions (not individual parts) are assigned to each classroom
        const classroomCounts = {};
        const processedBaseSessions = new Set();
        
        for (let i = 1; i <= maxClassrooms; i++) {
          classroomCounts[i] = 0;
        }
        
        // Count base sessions per classroom (avoid double-counting split sessions)
        for (const assignment of this.assignments.values()) {
          if (assignment.locationKey === locationKey && assignment.classroomNumber <= maxClassrooms) {
            const assignmentBaseMatch = assignment.sessionId?.match(/^(.+-\d+)(?:-(?:am|pm))?(?:-part\d+)?-/);
            const assignmentBaseId = assignmentBaseMatch ? assignmentBaseMatch[1] : 
              (assignment.sessionId ? assignment.sessionId.split('-')[0] + '-' + assignment.sessionId.split('-')[1] : 'unknown');
            
            if (!processedBaseSessions.has(assignmentBaseId)) {
              classroomCounts[assignment.classroomNumber]++;
              processedBaseSessions.add(assignmentBaseId);
            }
          }
        }
        
        // Find the classroom with the least base sessions assigned (load balancing)
        let minCount = Infinity;
        let bestClassroom = 1;
        for (let i = 1; i <= maxClassrooms; i++) {
          // Check if this classroom is available for this time slot
          if (!occupiedClassrooms.has(i) && classroomCounts[i] < minCount) {
            minCount = classroomCounts[i];
            bestClassroom = i;
          }
        }
        
        // If the load-balanced classroom is occupied, find first available
        if (occupiedClassrooms.has(bestClassroom)) {
          bestClassroom = null; // Reset to indicate no classroom found yet
          for (let i = 1; i <= maxClassrooms; i++) {
            if (!occupiedClassrooms.has(i)) {
              bestClassroom = i;
              break;
            }
          }
          // If still no classroom available, return null
          if (bestClassroom === null) {
            console.log(`❌ No classrooms available at ${locationKey} for session ${sessionId} - all ${maxClassrooms} classrooms occupied`);
            return null;
          }
        }
        
        classroomNumber = bestClassroom;
      }
    } else {
      // Original logic: find first available classroom for this time slot
      while (occupiedClassrooms.has(classroomNumber)) {
        classroomNumber++;
        // If no maxClassrooms specified, continue searching indefinitely
        // If maxClassrooms specified, don't exceed it
        if (maxClassrooms && classroomNumber > maxClassrooms) {
          console.log(`❌ No classrooms available at ${locationKey} for session ${sessionId} - all ${maxClassrooms} classrooms occupied`);
          return null;
        }
      }
    }

    // Reserve the classroom for this time slot
    occupiedClassrooms.add(classroomNumber);
    
    // Store assignment for tracking
    this.assignments.set(sessionId, {
      locationKey,
      timeSlot: timeSlotKey,
      classroomNumber,
      sessionId: sessionId,
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });

    console.log(`✅ Successfully reserved classroom ${classroomNumber} at ${locationKey} for ${sessionId}`);
    return classroomNumber;
  }

  /**
   * Get the number of occupied classrooms for a specific time slot
   * @param {string} locationKey - Training location identifier
   * @param {Date} startTime - Session start time
   * @param {Date} endTime - Session end time
   * @returns {number} Number of occupied classrooms
   */
  getOccupiedClassroomsCount(locationKey, startTime, endTime) {
    if (!this.occupancy.has(locationKey)) {
      return 0;
    }

    const locationOccupancy = this.occupancy.get(locationKey);
    const timeSlotKey = this.getTimeSlotKey(startTime, endTime);
    const occupiedClassrooms = locationOccupancy.get(timeSlotKey) || new Set();

    return occupiedClassrooms.size;
  }

  /**
   * Get classroom assignment for a specific session
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Assignment details or null if not found
   */
  getClassroomAssignment(sessionId) {
    return this.assignments.get(sessionId) || null;
  }

  /**
   * Release a classroom reservation
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if successfully released
   */
  releaseClassroom(sessionId) {
    const assignment = this.assignments.get(sessionId);
    if (!assignment) {
      return false;
    }

    const { locationKey, timeSlot, classroomNumber } = assignment;
    const locationOccupancy = this.occupancy.get(locationKey);
    
    if (locationOccupancy && locationOccupancy.has(timeSlot)) {
      const occupiedClassrooms = locationOccupancy.get(timeSlot);
      occupiedClassrooms.delete(classroomNumber);
      
      // Clean up empty time slots
      if (occupiedClassrooms.size === 0) {
        locationOccupancy.delete(timeSlot);
      }
    }

    this.assignments.delete(sessionId);
    return true;
  }

  /**
   * Get classroom utilization summary with classroom-specific details
   * @param {string} locationKey - Training location identifier (optional)
   * @returns {Object} Utilization summary
   */
  getUtilizationSummary(locationKey = null) {
    if (locationKey) {
      const locationOccupancy = this.occupancy.get(locationKey);
      if (!locationOccupancy) {
        return { 
          location: locationKey, 
          slots: 0, 
          maxOccupancy: 0, 
          avgOccupancy: 0,
          classroomDetails: {}
        };
      }

      const occupancyValues = Array.from(locationOccupancy.values()).map(set => set.size);
      const maxOccupancy = Math.max(...occupancyValues, 0);
      const avgOccupancy = occupancyValues.length > 0 
        ? occupancyValues.reduce((sum, val) => sum + val, 0) / occupancyValues.length 
        : 0;

      // Get classroom-specific details
      const classroomDetails = {};
      for (const [timeSlot, occupiedClassrooms] of locationOccupancy.entries()) {
        occupiedClassrooms.forEach(classroomNum => {
          if (!classroomDetails[classroomNum]) {
            classroomDetails[classroomNum] = 0;
          }
          classroomDetails[classroomNum]++;
        });
      }

      return {
        location: locationKey,
        slots: occupancyValues.length,
        maxOccupancy,
        avgOccupancy: Math.round(avgOccupancy * 100) / 100,
        classroomDetails
      };
    }

    // Summary for all locations
    const summary = {};
    for (const [location, locationOccupancy] of this.occupancy.entries()) {
      const occupancyValues = Array.from(locationOccupancy.values()).map(set => set.size);
      const maxOccupancy = Math.max(...occupancyValues, 0);
      const avgOccupancy = occupancyValues.length > 0 
        ? occupancyValues.reduce((sum, val) => sum + val, 0) / occupancyValues.length 
        : 0;

      // Get classroom-specific details
      const classroomDetails = {};
      for (const [timeSlot, occupiedClassrooms] of locationOccupancy.entries()) {
        occupiedClassrooms.forEach(classroomNum => {
          if (!classroomDetails[classroomNum]) {
            classroomDetails[classroomNum] = 0;
          }
          classroomDetails[classroomNum]++;
        });
      }

      summary[location] = {
        slots: occupancyValues.length,
        maxOccupancy,
        avgOccupancy: Math.round(avgOccupancy * 100) / 100,
        classroomDetails
      };
    }

    return summary;
  }

  /**
   * Get all sessions assigned to a specific classroom
   * @param {string} locationKey - Training location identifier
   * @param {number} classroomNumber - Classroom number
   * @returns {Array} Array of session assignments
   */
  getClassroomSessions(locationKey, classroomNumber) {
    const sessions = [];
    for (const [sessionId, assignment] of this.assignments.entries()) {
      if (assignment.locationKey === locationKey && assignment.classroomNumber === classroomNumber) {
        sessions.push({
          sessionId,
          ...assignment
        });
      }
    }
    return sessions.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Clear all occupancy data
   */
  clear() {
    this.occupancy.clear();
  }
}