import { supabase } from '@core/services/supabaseClient';

// =============================================
// IMPACT ANALYTICS SERVICE
// =============================================

/**
 * Get comprehensive process impact heatmap data with hierarchical structure
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Hierarchical process impact data
 */
export const getProcessImpactHeatmapData = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    // Get all process impacts with hierarchy information
    const { data, error } = await supabase
      .from('process_impacts')
      .select(`
        *,
        process_hierarchy!inner(
          id,
          process_code,
          process_name,
          level_number,
          parent_id,
          department,
          functional_area
        )
      `)
      .eq('assessment_id', assessmentId);

    if (error) {
      console.error('Error fetching process impact heatmap data:', error);
      throw error;
    }

    // Structure data hierarchically (L0 -> L1 -> L2)
    const hierarchicalData = structureHierarchicalData(data || []);
    
    // Calculate aggregated statistics
    const statistics = calculateProcessStatistics(data || []);

    return {
      hierarchicalData,
      statistics,
      rawData: data || []
    };
  } catch (error) {
    console.error('Error in getProcessImpactHeatmapData:', error);
    throw error;
  }
};

/**
 * Get role impact matrix showing RACI assignment changes and stakeholder load
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Role impact analysis data
 */
export const getRoleImpactMatrix = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    // Get process impacts with RACI data
    const { data, error } = await supabase
      .from('process_impacts')
      .select(`
        id,
        overall_impact_rating,
        as_is_raci_r,
        as_is_raci_a,
        as_is_raci_c,
        as_is_raci_i,
        to_be_raci_r,
        to_be_raci_a,
        to_be_raci_c,
        to_be_raci_i,
        process_hierarchy!inner(
          id,
          process_code,
          process_name,
          level_number,
          department,
          functional_area
        )
      `)
      .eq('assessment_id', assessmentId);

    if (error) {
      console.error('Error fetching role impact matrix data:', error);
      throw error;
    }

    // Analyze RACI changes and role impacts
    const roleAnalysis = analyzeRoleImpacts(data || []);
    
    return roleAnalysis;
  } catch (error) {
    console.error('Error in getRoleImpactMatrix:', error);
    throw error;
  }
};

/**
 * Get executive summary metrics for dashboard cards
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Executive summary statistics
 */
export const getExecutiveSummaryMetrics = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    // Get comprehensive process impact data
    const { data, error } = await supabase
      .from('process_impacts')
      .select(`
        *,
        process_hierarchy!inner(
          level_number,
          department,
          functional_area
        )
      `)
      .eq('assessment_id', assessmentId);

    if (error) {
      console.error('Error fetching executive summary data:', error);
      throw error;
    }

    const processes = data || [];
    
    // Calculate executive metrics
    const metrics = {
      totalProcesses: processes.length,
      
      // Critical impact processes (rating 4-5)
      criticalImpactProcesses: processes.filter(p => p.overall_impact_rating >= 4).length,
      
      // High impact processes (rating 3-5) 
      highImpactProcesses: processes.filter(p => p.overall_impact_rating >= 3).length,
      
      // Processes by level
      processLevels: {
        l0: processes.filter(p => p.process_hierarchy?.level_number === 0).length,
        l1: processes.filter(p => p.process_hierarchy?.level_number === 1).length,
        l2: processes.filter(p => p.process_hierarchy?.level_number === 2).length
      },
      
      // Average impact rating
      averageImpactRating: processes.length > 0 
        ? (processes.reduce((sum, p) => sum + (p.overall_impact_rating || 0), 0) / processes.length).toFixed(1)
        : 0,
      
      // RACI changes analysis
      raciChanges: analyzeRACIChanges(processes),
      
      // System integration complexity
      systemComplexity: analyzeSystemComplexity(processes),
      
      // Training requirements
      trainingRequirements: analyzeTrainingRequirements(processes),
      
      // Department/functional area breakdown
      departmentBreakdown: analyzeDepartmentBreakdown(processes)
    };

    return metrics;
  } catch (error) {
    console.error('Error in getExecutiveSummaryMetrics:', error);
    throw error;
  }
};

/**
 * Get cross-dimensional analysis (process vs role matrix)
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Cross-dimensional analysis data
 */
export const getCrossDimensionalAnalysis = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const processData = await getProcessImpactHeatmapData(assessmentId);
    const roleData = await getRoleImpactMatrix(assessmentId);
    
    // Create cross-dimensional matrix
    const crossMatrix = createCrossDimensionalMatrix(processData.rawData);
    
    return {
      processRoleMatrix: crossMatrix,
      correlationAnalysis: analyzeCorrelations(processData.rawData),
      riskAssessment: assessImplementationRisk(processData.rawData)
    };
  } catch (error) {
    console.error('Error in getCrossDimensionalAnalysis:', error);
    throw error;
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Structure flat process data into hierarchical format (L0 -> L1 -> L2)
 * @param {Array} processes - Flat array of process impacts
 * @returns {Object} Hierarchical structure
 */
const structureHierarchicalData = (processes) => {
  const hierarchy = { L0: {}, L1: {}, L2: {} };
  
  processes.forEach(process => {
    // Convert level_number to L0/L1/L2 format
    const levelNumber = process.process_hierarchy?.level_number;
    let level = 'L2'; // Default to L2
    if (levelNumber === 0) level = 'L0';
    else if (levelNumber === 1) level = 'L1';
    else if (levelNumber === 2) level = 'L2';
    
    const processCode = process.process_hierarchy?.process_code;
    
    if (!hierarchy[level][processCode]) {
      hierarchy[level][processCode] = {
        ...process,
        children: [],
        impact: process.overall_impact_rating || 0,
        department: process.process_hierarchy?.department,
        functionalArea: process.process_hierarchy?.functional_area
      };
    }
  });
  
  // Build parent-child relationships
  Object.values(hierarchy.L1).forEach(l1Process => {
    Object.values(hierarchy.L2).forEach(l2Process => {
      if (l2Process.process_hierarchy?.parent_id === l1Process.process_hierarchy?.id) {
        l1Process.children.push(l2Process);
      }
    });
  });
  
  Object.values(hierarchy.L0).forEach(l0Process => {
    Object.values(hierarchy.L1).forEach(l1Process => {
      if (l1Process.process_hierarchy?.parent_id === l0Process.process_hierarchy?.id) {
        l0Process.children.push(l1Process);
      }
    });
  });
  
  return hierarchy;
};

/**
 * Calculate comprehensive process statistics
 * @param {Array} processes - Process impacts array
 * @returns {Object} Statistics summary
 */
const calculateProcessStatistics = (processes) => {
  if (!processes.length) return {};
  
  const impactCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  processes.forEach(p => {
    const rating = p.overall_impact_rating || 0;
    impactCounts[rating] = (impactCounts[rating] || 0) + 1;
  });
  
  return {
    total: processes.length,
    impactDistribution: impactCounts,
    averageImpact: (processes.reduce((sum, p) => sum + (p.overall_impact_rating || 0), 0) / processes.length).toFixed(1),
    highImpactPercentage: Math.round((processes.filter(p => p.overall_impact_rating >= 4).length / processes.length) * 100)
  };
};

/**
 * Analyze role impacts and RACI assignment changes
 * @param {Array} processes - Process impacts array
 * @returns {Object} Role analysis data
 */
const analyzeRoleImpacts = (processes) => {
  const roleLoad = {};
  const raciChanges = [];
  const changeTypes = { 'new-assignment': 0, 'removed-assignment': 0, 'role-change': 0 };
  
  processes.forEach(process => {
    // Count role assignments
    ['r', 'a', 'c', 'i'].forEach(role => {
      const asIsField = `as_is_raci_${role}`;
      const toBeField = `to_be_raci_${role}`;
      
      const asIsRoles = process[asIsField] ? process[asIsField].split(',').map(r => r.trim()) : [];
      const toBeRoles = process[toBeField] ? process[toBeField].split(',').map(r => r.trim()) : [];
      
      // Track role load
      [...asIsRoles, ...toBeRoles].forEach(roleName => {
        if (roleName && roleName !== '') {
          if (!roleLoad[roleName]) {
            roleLoad[roleName] = { asIs: 0, toBe: 0, processes: new Set() };
          }
          roleLoad[roleName].processes.add(process.process_hierarchy.process_code);
        }
      });
      
      asIsRoles.forEach(roleName => {
        if (roleName && roleName !== '') {
          roleLoad[roleName].asIs++;
        }
      });
      
      toBeRoles.forEach(roleName => {
        if (roleName && roleName !== '') {
          roleLoad[roleName].toBe++;
        }
      });
      
      // Detect changes
      if (process[asIsField] !== process[toBeField]) {
        const changeType = getChangeType(asIsRoles, toBeRoles);
        changeTypes[changeType]++;
        
        raciChanges.push({
          processCode: process.process_hierarchy.process_code,
          processName: process.process_hierarchy.process_name,
          role: role.toUpperCase(),
          asIs: process[asIsField] || '',
          toBe: process[toBeField] || '',
          changeType,
          impactRating: process.overall_impact_rating
        });
      }
    });
  });
  
  // Convert roleLoad Sets to counts
  Object.keys(roleLoad).forEach(role => {
    roleLoad[role].processCount = roleLoad[role].processes.size;
    roleLoad[role].totalLoad = roleLoad[role].asIs + roleLoad[role].toBe;
    delete roleLoad[role].processes;
  });
  
  return {
    roleLoad: Object.entries(roleLoad)
      .sort(([,a], [,b]) => b.totalLoad - a.totalLoad)
      .slice(0, 20), // Top 20 most loaded roles
    raciChanges,
    changeTypeSummary: changeTypes,
    totalChanges: raciChanges.length
  };
};

/**
 * Determine the type of RACI change
 * @param {Array} asIsRoles - As-Is role assignments
 * @param {Array} toBeRoles - To-Be role assignments
 * @returns {string} Change type
 */
const getChangeType = (asIsRoles, toBeRoles) => {
  if (asIsRoles.length === 0 && toBeRoles.length > 0) return 'new-assignment';
  if (asIsRoles.length > 0 && toBeRoles.length === 0) return 'removed-assignment';
  return 'role-change';
};

/**
 * Analyze RACI changes across all processes
 * @param {Array} processes - Process impacts array
 * @returns {Object} RACI changes summary
 */
const analyzeRACIChanges = (processes) => {
  let totalChanges = 0;
  const changesByRole = { R: 0, A: 0, C: 0, I: 0 };
  
  processes.forEach(process => {
    ['r', 'a', 'c', 'i'].forEach(role => {
      const asIsField = `as_is_raci_${role}`;
      const toBeField = `to_be_raci_${role}`;
      
      if (process[asIsField] !== process[toBeField]) {
        totalChanges++;
        changesByRole[role.toUpperCase()]++;
      }
    });
  });
  
  return {
    totalChanges,
    changesByRole,
    processesWithChanges: processes.filter(p => 
      p.as_is_raci_r !== p.to_be_raci_r ||
      p.as_is_raci_a !== p.to_be_raci_a ||
      p.as_is_raci_c !== p.to_be_raci_c ||
      p.as_is_raci_i !== p.to_be_raci_i
    ).length
  };
};

/**
 * Analyze system integration complexity
 * @param {Array} processes - Process impacts array
 * @returns {Object} System complexity metrics
 */
const analyzeSystemComplexity = (processes) => {
  const systemsAffected = new Set();
  const systemChanges = {};
  
  processes.forEach(process => {
    if (process.as_is_system) {
      systemsAffected.add(process.as_is_system);
      if (!systemChanges[process.as_is_system]) {
        systemChanges[process.as_is_system] = { processes: 0, totalImpact: 0 };
      }
      systemChanges[process.as_is_system].processes++;
      systemChanges[process.as_is_system].totalImpact += process.overall_impact_rating || 0;
    }
    
    if (process.to_be_system && process.to_be_system !== process.as_is_system) {
      systemsAffected.add(process.to_be_system);
      if (!systemChanges[process.to_be_system]) {
        systemChanges[process.to_be_system] = { processes: 0, totalImpact: 0 };
      }
      systemChanges[process.to_be_system].processes++;
      systemChanges[process.to_be_system].totalImpact += process.overall_impact_rating || 0;
    }
  });
  
  return {
    totalSystems: systemsAffected.size,
    systemChanges: Object.entries(systemChanges)
      .sort(([,a], [,b]) => b.totalImpact - a.totalImpact)
      .slice(0, 10) // Top 10 most impacted systems
  };
};

/**
 * Analyze training requirements
 * @param {Array} processes - Process impacts array
 * @returns {Object} Training requirements analysis
 */
const analyzeTrainingRequirements = (processes) => {
  const trainingIntensive = processes.filter(p => 
    p.training_required === true || 
    p.overall_impact_rating >= 4 ||
    (p.as_is_raci_r !== p.to_be_raci_r || p.as_is_raci_a !== p.to_be_raci_a)
  );
  
  return {
    totalRequiringTraining: trainingIntensive.length,
    percentageRequiringTraining: processes.length > 0 
      ? Math.round((trainingIntensive.length / processes.length) * 100)
      : 0,
    highImpactTraining: trainingIntensive.filter(p => p.overall_impact_rating >= 4).length
  };
};

/**
 * Analyze department/functional area breakdown
 * @param {Array} processes - Process impacts array
 * @returns {Object} Department analysis
 */
const analyzeDepartmentBreakdown = (processes) => {
  const departmentStats = {};
  
  processes.forEach(process => {
    const dept = process.process_hierarchy?.department || 'Unknown';
    if (!departmentStats[dept]) {
      departmentStats[dept] = {
        totalProcesses: 0,
        highImpactProcesses: 0,
        averageImpact: 0,
        totalImpact: 0
      };
    }
    
    departmentStats[dept].totalProcesses++;
    departmentStats[dept].totalImpact += process.overall_impact_rating || 0;
    
    if (process.overall_impact_rating >= 4) {
      departmentStats[dept].highImpactProcesses++;
    }
  });
  
  // Calculate averages
  Object.keys(departmentStats).forEach(dept => {
    const stats = departmentStats[dept];
    stats.averageImpact = stats.totalProcesses > 0 
      ? (stats.totalImpact / stats.totalProcesses).toFixed(1)
      : 0;
  });
  
  return Object.entries(departmentStats)
    .sort(([,a], [,b]) => b.totalImpact - a.totalImpact);
};

/**
 * Create cross-dimensional matrix (processes vs roles)
 * @param {Array} processes - Process impacts array  
 * @returns {Object} Cross-dimensional matrix
 */
const createCrossDimensionalMatrix = (processes) => {
  const matrix = {};
  
  processes.forEach(process => {
    const processKey = process.process_hierarchy.process_code;
    matrix[processKey] = {
      processName: process.process_hierarchy.process_name,
      impactRating: process.overall_impact_rating,
      roles: {}
    };
    
    ['r', 'a', 'c', 'i'].forEach(role => {
      const toBeField = `to_be_raci_${role}`;
      const roles = process[toBeField] ? process[toBeField].split(',').map(r => r.trim()) : [];
      
      roles.forEach(roleName => {
        if (roleName && roleName !== '') {
          matrix[processKey].roles[roleName] = {
            role: role.toUpperCase(),
            impact: process.overall_impact_rating || 0
          };
        }
      });
    });
  });
  
  return matrix;
};

/**
 * Analyze correlations between different impact dimensions
 * @param {Array} processes - Process impacts array
 * @returns {Object} Correlation analysis
 */
const analyzeCorrelations = (processes) => {
  // Simplified correlation analysis
  const highImpactProcesses = processes.filter(p => p.overall_impact_rating >= 4);
  const systemMigrations = processes.filter(p => p.as_is_system !== p.to_be_system);
  const raciChanges = processes.filter(p => 
    p.as_is_raci_r !== p.to_be_raci_r ||
    p.as_is_raci_a !== p.to_be_raci_a ||
    p.as_is_raci_c !== p.to_be_raci_c ||
    p.as_is_raci_i !== p.to_be_raci_i
  );
  
  return {
    highImpactSystemCorrelation: highImpactProcesses.filter(p => 
      systemMigrations.some(s => s.id === p.id)
    ).length,
    highImpactRACICorrelation: highImpactProcesses.filter(p =>
      raciChanges.some(r => r.id === p.id)
    ).length,
    systemRACICorrelation: systemMigrations.filter(p =>
      raciChanges.some(r => r.id === p.id)
    ).length
  };
};

/**
 * Assess implementation risk based on impact complexity
 * @param {Array} processes - Process impacts array
 * @returns {Object} Risk assessment
 */
const assessImplementationRisk = (processes) => {
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  
  processes.forEach(process => {
    const impactRating = process.overall_impact_rating || 0;
    const hasSystemChange = process.as_is_system !== process.to_be_system;
    const hasRACIChange = process.as_is_raci_r !== process.to_be_raci_r ||
                          process.as_is_raci_a !== process.to_be_raci_a ||
                          process.as_is_raci_c !== process.to_be_raci_c ||
                          process.as_is_raci_i !== process.to_be_raci_i;
    
    // Risk scoring logic
    let riskScore = impactRating;
    if (hasSystemChange) riskScore += 1;
    if (hasRACIChange) riskScore += 1;
    
    if (riskScore >= 6) highRisk++;
    else if (riskScore >= 3) mediumRisk++;
    else lowRisk++;
  });
  
  return {
    high: highRisk,
    medium: mediumRisk,
    low: lowRisk,
    total: processes.length
  };
};