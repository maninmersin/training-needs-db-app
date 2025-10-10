import { supabase } from '@core/services/supabaseClient';

// =============================================
// REFERENCE DATA OPERATIONS
// =============================================

/**
 * Get systems reference data for dropdowns
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of system options
 */
export const getSystemsReferenceData = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessment_systems')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching systems reference data:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSystemsReferenceData:', error);
    throw error;
  }
};

/**
 * Get stakeholder roles reference data for RACI assignments
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of stakeholder role options
 */
export const getStakeholderRolesReferenceData = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessment_stakeholder_roles')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stakeholder roles reference data:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getStakeholderRolesReferenceData:', error);
    throw error;
  }
};

/**
 * Get status options reference data
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of status options
 */
export const getStatusOptionsReferenceData = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessment_status_options')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching status options reference data:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getStatusOptionsReferenceData:', error);
    throw error;
  }
};

/**
 * Get action templates reference data
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of action templates
 */
export const getActionTemplatesReferenceData = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessment_action_templates')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching action templates reference data:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getActionTemplatesReferenceData:', error);
    throw error;
  }
};

/**
 * Business Process Impact Assessment Service
 * Handles CRUD operations for impact assessments, process hierarchy, and impact analysis
 * Supports enterprise change management with RACI stakeholder mapping
 */

// =============================================
// IMPACT ASSESSMENT CRUD OPERATIONS
// =============================================

/**
 * Get all impact assessments for a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of impact assessments with statistics
 */
export const getImpactAssessments = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for impact assessment operations');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessments')
      .select(`
        id,
        project_id,
        name,
        description,
        assessment_type,
        status,
        template_id,
        created_by,
        created_at,
        updated_at,
        completed_at,
        total_processes,
        total_high_impact,
        total_medium_impact,
        total_low_impact,
        creator:auth_users!created_by(
          id,
          email
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching impact assessments:', error);
      throw error;
    }

    // TODO: Re-enable statistics once calculate_assessment_stats function is fixed
    // For now, return basic data without statistics to avoid column errors
    return data || [];
  } catch (error) {
    console.error('Failed to get impact assessments:', error);
    throw error;
  }
};

/**
 * Get a single impact assessment by ID
 * @param {string} assessmentId - The assessment ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Impact assessment with full details
 */
export const getImpactAssessment = async (assessmentId, projectId) => {
  if (!assessmentId || !projectId) {
    throw new Error('Assessment ID and Project ID are required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessments')
      .select(`
        *,
        creator:auth_users!created_by(
          id,
          email
        ),
        template:process_templates(
          id,
          name,
          description,
          hierarchy_structure
        )
      `)
      .eq('id', assessmentId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching impact assessment:', error);
      throw error;
    }

    // Add statistics and process hierarchy
    const [stats, hierarchy] = await Promise.all([
      getAssessmentStatistics(assessmentId),
      getProcessHierarchy(assessmentId)
    ]);

    return {
      ...data,
      statistics: stats,
      process_hierarchy: hierarchy
    };
  } catch (error) {
    console.error('Failed to get impact assessment:', error);
    throw error;
  }
};

/**
 * Create a new impact assessment
 * @param {Object} assessmentData - The assessment data
 * @returns {Promise<Object>} Created assessment
 */
export const createImpactAssessment = async (assessmentData) => {
  const { project_id, name, description, assessment_type, template_id } = assessmentData;

  if (!project_id || !name) {
    throw new Error('Project ID and assessment name are required');
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      throw new Error('User must be authenticated to create assessments');
    }

    const { data, error } = await supabase
      .from('impact_assessments')
      .insert({
        project_id,
        name,
        description,
        assessment_type: assessment_type || 'business_process',
        template_id,
        created_by: user.user.id,
        status: 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating impact assessment:', error);
      throw error;
    }

    // If using a template, create the process hierarchy
    if (template_id) {
      await createHierarchyFromTemplate(data.id, template_id);
    }

    return data;
  } catch (error) {
    console.error('Failed to create impact assessment:', error);
    throw error;
  }
};

/**
 * Update an impact assessment
 * @param {string} assessmentId - The assessment ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} Updated assessment
 */
export const updateImpactAssessment = async (assessmentId, updateData) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('impact_assessments')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating impact assessment:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update impact assessment:', error);
    throw error;
  }
};

/**
 * Delete an impact assessment
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteImpactAssessment = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const { error } = await supabase
      .from('impact_assessments')
      .delete()
      .eq('id', assessmentId);

    if (error) {
      console.error('Error deleting impact assessment:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete impact assessment:', error);
    throw error;
  }
};

// =============================================
// PROCESS HIERARCHY OPERATIONS
// =============================================

/**
 * Get process hierarchy for an assessment
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Array>} Hierarchical process structure
 */
export const getProcessHierarchy = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    // Use the database function for optimized hierarchy retrieval
    const { data, error } = await supabase
      .rpc('get_process_hierarchy_with_impacts', {
        assessment_uuid: assessmentId
      });

    if (error) {
      console.error('Error fetching process hierarchy:', error);
      throw error;
    }

    return buildHierarchicalStructure(data || []);
  } catch (error) {
    console.error('Failed to get process hierarchy:', error);
    throw error;
  }
};

/**
 * Create process hierarchy from template
 * @param {string} assessmentId - The assessment ID
 * @param {string} templateId - The template ID
 * @returns {Promise<Array>} Created hierarchy
 */
export const createHierarchyFromTemplate = async (assessmentId, templateId) => {
  if (!assessmentId || !templateId) {
    throw new Error('Assessment ID and Template ID are required');
  }

  try {
    // Get template structure
    const { data: template, error: templateError } = await supabase
      .from('process_templates')
      .select('hierarchy_structure')
      .eq('id', templateId)
      .single();

    if (templateError) {
      throw templateError;
    }

    // Create hierarchy entries from template
    const hierarchyEntries = [];
    const processStack = [];

    // Parse template structure and create database entries
    const createHierarchyEntries = (processes, parentId = null, level = 0) => {
      processes.forEach((process, index) => {
        const entry = {
          assessment_id: assessmentId,
          process_code: process.code,
          process_name: process.name,
          level_number: level,
          parent_id: parentId,
          sort_order: index
        };
        hierarchyEntries.push(entry);

        // If process has children, recursively create entries
        if (process.children && process.children.length > 0) {
          // We'll need to get the ID after insertion for parent reference
          processStack.push({
            process,
            level: level + 1
          });
        }
      });
    };

    if (template.hierarchy_structure && template.hierarchy_structure.processes) {
      createHierarchyEntries(template.hierarchy_structure.processes);
    }

    // Insert hierarchy entries
    const { data, error } = await supabase
      .from('process_hierarchy')
      .insert(hierarchyEntries)
      .select();

    if (error) {
      console.error('Error creating hierarchy from template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create hierarchy from template:', error);
    throw error;
  }
};

/**
 * Add process to hierarchy
 * @param {Object} processData - Process data
 * @returns {Promise<Object>} Created process
 */
export const addProcessToHierarchy = async (processData) => {
  const { assessment_id, process_code, process_name, level_number, parent_id, sort_order } = processData;

  if (!assessment_id || !process_code || !process_name || level_number === undefined) {
    throw new Error('Assessment ID, process code, name, and level are required');
  }

  try {
    const { data, error } = await supabase
      .from('process_hierarchy')
      .insert({
        assessment_id,
        process_code,
        process_name,
        level_number,
        parent_id,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding process to hierarchy:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to add process to hierarchy:', error);
    throw error;
  }
};

// =============================================
// PROCESS IMPACT ANALYSIS OPERATIONS
// =============================================

/**
 * Get process impacts for an assessment
 * @param {string} assessmentId - The assessment ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Process impacts with full details
 */
export const getProcessImpacts = async (assessmentId, filters = {}) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    let query = supabase
      .from('process_impacts')
      .select(`
        *,
        process:process_hierarchy(
          id,
          process_code,
          process_name,
          level_number
        )
      `)
      .eq('assessment_id', assessmentId);

    // Apply filters
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.analysis_status) {
      query = query.eq('analysis_status', filters.analysis_status);
    }
    if (filters.min_impact_rating) {
      query = query.gte('overall_impact_rating', filters.min_impact_rating);
    }

    query = query.order('overall_impact_rating', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching process impacts:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get process impacts:', error);
    throw error;
  }
};

/**
 * Get single process impact for editing
 * @param {string} assessmentId - Assessment UUID
 * @param {string} processId - Process UUID
 * @returns {Promise<Object|null>} Process impact data or null if not found
 */
export const getProcessImpact = async (assessmentId, processId) => {
  try {
    const { data, error } = await supabase
      .from('process_impacts')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('process_id', processId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found - this is expected for new impacts
        return null;
      }
      console.error('Error fetching process impact:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to get process impact:', error);
    throw error;
  }
};

/**
 * Create or update process impact
 * @param {Object} impactData - Impact data
 * @returns {Promise<Object>} Created/updated impact
 */
export const saveProcessImpact = async (impactData) => {
  const {
    id,
    assessment_id,
    process_id,
    as_is_description,
    to_be_description,
    as_is_core_system,
    to_be_core_system,
    // RACI fields
    as_is_raci_r,
    as_is_raci_a,
    as_is_raci_c,
    as_is_raci_i,
    to_be_raci_r,
    to_be_raci_a,
    to_be_raci_c,
    to_be_raci_i,
    // Other fields
    change_statement,
    benefits,
    business_benefits,
    comments,
    process_rating,
    role_rating,
    new_role_rating,
    workload_rating,
    workload_direction,
    overall_impact_rating,
    impact_direction,
    system_complexity_rating,
    data_migration_required,
    training_required,
    priority,
    status,
    actions
  } = impactData;

  if (!assessment_id || !process_id) {
    throw new Error('Assessment ID and Process ID are required');
  }

  try {
    // Parse individual ratings
    const parsedRatings = {
      process_rating: parseInt(process_rating) || 0,
      role_rating: parseInt(role_rating) || 0,
      new_role_rating: parseInt(new_role_rating) || 0,
      workload_rating: parseInt(workload_rating) || 0,
      system_complexity_rating: parseInt(system_complexity_rating) || 0
    };

    // Calculate overall impact rating automatically
    const calculatedOverallRating = calculateOverallImpactRating(parsedRatings);

    const impactRecord = {
      assessment_id,
      process_id,
      as_is_description,
      to_be_description,
      as_is_core_system,
      to_be_core_system,
      // RACI fields
      as_is_raci_r: as_is_raci_r || null,
      as_is_raci_a: as_is_raci_a || null,
      as_is_raci_c: as_is_raci_c || null,
      as_is_raci_i: as_is_raci_i || null,
      to_be_raci_r: to_be_raci_r || null,
      to_be_raci_a: to_be_raci_a || null,
      to_be_raci_c: to_be_raci_c || null,
      to_be_raci_i: to_be_raci_i || null,
      // Other fields
      change_statement,
      benefits,
      business_benefits: business_benefits || null,
      comments,
      status: status || null,
      actions: actions || null,
      ...parsedRatings,
      workload_direction: workload_direction || 'neutral',
      overall_impact_rating: calculatedOverallRating, // Use calculated value
      impact_direction: impact_direction || 'neutral',
      data_migration_required: Boolean(data_migration_required),
      training_required: Boolean(training_required),
      priority: priority || 'medium',
      analysis_status: 'in_progress'
    };

    let data, error;

    if (id) {
      // Update existing impact
      ({ data, error } = await supabase
        .from('process_impacts')
        .update(impactRecord)
        .eq('id', id)
        .select()
        .single());
    } else {
      // Create new impact
      ({ data, error } = await supabase
        .from('process_impacts')
        .insert(impactRecord)
        .select()
        .single());
    }

    if (error) {
      console.error('Error saving process impact:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to save process impact:', error);
    throw error;
  }
};

// =============================================
// STATISTICS AND ANALYTICS
// =============================================

/**
 * Get assessment statistics
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Comprehensive statistics
 */
export const getAssessmentStatistics = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    // Use database function for optimized statistics
    const { data, error } = await supabase
      .rpc('calculate_assessment_stats', {
        assessment_uuid: assessmentId
      });

    if (error) {
      console.error('Error fetching assessment statistics:', error);
      throw error;
    }

    return data[0] || {
      total_processes: 0,
      high_impact_count: 0,
      medium_impact_count: 0,
      low_impact_count: 0,
      avg_process_rating: 0,
      avg_role_rating: 0,
      avg_workload_rating: 0,
      processes_needing_training: 0,
      systems_affected: 0
    };
  } catch (error) {
    console.error('Failed to get assessment statistics:', error);
    throw error;
  }
};

/**
 * Get impact summary by process level
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} Impact summary grouped by process level
 */
export const getImpactSummaryByLevel = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_impacts')
      .select(`
        overall_impact_rating,
        priority,
        analysis_status,
        process:process_hierarchy(
          level_number,
          process_code
        )
      `)
      .eq('assessment_id', assessmentId);

    if (error) {
      console.error('Error fetching impact summary:', error);
      throw error;
    }

    // Group by process level
    const summary = {
      level_0: { total: 0, high: 0, medium: 0, low: 0 },
      level_1: { total: 0, high: 0, medium: 0, low: 0 },
      level_2: { total: 0, high: 0, medium: 0, low: 0 }
    };

    (data || []).forEach(impact => {
      const level = `level_${impact.process.level_number}`;
      if (summary[level]) {
        summary[level].total++;
        if (impact.overall_impact_rating >= 4) {
          summary[level].high++;
        } else if (impact.overall_impact_rating >= 2) {
          summary[level].medium++;
        } else {
          summary[level].low++;
        }
      }
    });

    return summary;
  } catch (error) {
    console.error('Failed to get impact summary by level:', error);
    throw error;
  }
};

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Build hierarchical structure from flat array
 * @param {Array} flatData - Flat array of process data
 * @returns {Array} Hierarchical structure
 */
const buildHierarchicalStructure = (flatData) => {
  const processMap = new Map();
  const rootProcesses = [];

  // First pass: create map and identify root processes
  flatData.forEach(process => {
    processMap.set(process.process_id, { ...process, children: [] });
    if (!process.parent_id) {
      rootProcesses.push(process.process_id);
    }
  });

  // Second pass: build hierarchy
  flatData.forEach(process => {
    if (process.parent_id && processMap.has(process.parent_id)) {
      const parent = processMap.get(process.parent_id);
      const child = processMap.get(process.process_id);
      parent.children.push(child);
    }
  });

  // Return root processes with their hierarchies
  return rootProcesses.map(id => processMap.get(id)).filter(Boolean);
};

/**
 * Validate impact ratings
 * @param {Object} ratings - Rating values
 * @returns {Array} Validation errors
 */
export const validateImpactRatings = (ratings) => {
  const errors = [];
  const { 
    process_rating, 
    role_rating, 
    new_role_rating, 
    workload_rating, 
    workload_direction, 
    overall_impact_rating, 
    system_complexity_rating,
    impact_direction
  } = ratings;

  if (process_rating !== undefined && (process_rating < 0 || process_rating > 3)) {
    errors.push('Process rating must be between 0 and 3');
  }
  if (role_rating !== undefined && (role_rating < 0 || role_rating > 3)) {
    errors.push('Role rating must be between 0 and 3');
  }
  if (new_role_rating !== undefined && (new_role_rating < 0 || new_role_rating > 3)) {
    errors.push('New role rating must be between 0 and 3');
  }
  if (workload_rating !== undefined && (workload_rating < 0 || workload_rating > 3)) {
    errors.push('Workload rating must be between 0 and 3');
  }
  if (workload_direction && !['increase', 'decrease', 'neutral'].includes(workload_direction)) {
    errors.push('Workload direction must be increase, decrease, or neutral');
  }
  if (overall_impact_rating !== undefined && (overall_impact_rating < 0 || overall_impact_rating > 5)) {
    errors.push('Overall impact rating must be between 0 and 5');
  }
  if (system_complexity_rating !== undefined && (system_complexity_rating < 0 || system_complexity_rating > 3)) {
    errors.push('System complexity rating must be between 0 and 3');
  }
  if (impact_direction && !['positive', 'negative', 'neutral'].includes(impact_direction)) {
    errors.push('Impact direction must be positive, negative, or neutral');
  }

  return errors;
};

/**
 * Calculate overall impact rating based on individual ratings
 * @param {Object} ratings - Individual rating values
 * @returns {number} Calculated overall impact rating (0-5)
 */
export const calculateOverallImpactRating = (ratings) => {
  const {
    process_rating = 0,
    role_rating = 0,
    new_role_rating = 0,
    workload_rating = 0,
    system_complexity_rating = 0
  } = ratings;

  // Sum all individual ratings (max 15 points)
  const totalPoints = parseInt(process_rating) + 
                     parseInt(role_rating) + 
                     parseInt(new_role_rating) + 
                     parseInt(workload_rating) + 
                     parseInt(system_complexity_rating);

  // Map to 0-5 scale
  if (totalPoints === 0) return 0;      // No Impact
  if (totalPoints <= 2) return 1;      // Low Impact
  if (totalPoints <= 5) return 2;      // Medium Impact  
  if (totalPoints <= 8) return 3;      // High Impact
  if (totalPoints <= 11) return 4;     // Very High Impact
  return 5;                            // Critical Impact (12-15 points)
};

/**
 * Get overall impact rating breakdown description
 * @param {Object} ratings - Individual rating values
 * @returns {Object} Breakdown with total points and description
 */
export const getOverallImpactBreakdown = (ratings) => {
  const totalPoints = parseInt(ratings.process_rating || 0) + 
                     parseInt(ratings.role_rating || 0) + 
                     parseInt(ratings.new_role_rating || 0) + 
                     parseInt(ratings.workload_rating || 0) + 
                     parseInt(ratings.system_complexity_rating || 0);
  
  const overallRating = calculateOverallImpactRating(ratings);
  
  const descriptions = {
    0: 'No Impact',
    1: 'Low Impact', 
    2: 'Medium Impact',
    3: 'High Impact',
    4: 'Very High Impact',
    5: 'Critical Impact'
  };

  return {
    totalPoints,
    maxPoints: 15,
    overallRating,
    description: descriptions[overallRating],
    breakdown: `${totalPoints}/15 points = ${descriptions[overallRating]}`
  };
};

/**
 * Get impact rating description
 * @param {number} rating - Rating value
 * @param {string} type - Rating type
 * @returns {string} Description
 */
export const getImpactRatingDescription = (rating, type = 'overall') => {
  if (type === 'overall') {
    const descriptions = {
      0: 'No Impact',
      1: 'Very Low Impact',
      2: 'Low Impact',
      3: 'Medium Impact',
      4: 'High Impact',
      5: 'Critical Impact'
    };
    return descriptions[rating] || 'Unknown';
  } else {
    const descriptions = {
      0: 'No Change',
      1: 'Minor Change',
      2: 'Moderate Change',
      3: 'Major Change'
    };
    return descriptions[rating] || 'Unknown';
  }
};

/**
 * Get impact color for UI display
 * @param {number} rating - Impact rating
 * @returns {string} CSS color class
 */
export const getImpactColor = (rating) => {
  if (rating >= 4) return 'impact-critical';
  if (rating >= 3) return 'impact-high';
  if (rating >= 2) return 'impact-medium';
  if (rating >= 1) return 'impact-low';
  return 'impact-none';
};

// =============================================
// RACI ASSIGNMENT OPERATIONS
// =============================================

/**
 * Get RACI assignments for a process impact
 * @param {string} processImpactId - The process impact ID
 * @returns {Promise<Array>} Array of RACI assignments
 */
export const getProcessRACIAssignments = async (processImpactId) => {
  if (!processImpactId) {
    throw new Error('Process impact ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_raci')
      .select(`
        *,
        stakeholder:stakeholders(
          id,
          name,
          title,
          department,
          organization
        ),
        stakeholder_role:stakeholder_roles(
          id,
          role_code,
          role_name
        )
      `)
      .eq('process_impact_id', processImpactId)
      .order('created_at');

    if (error) {
      console.error('Error fetching RACI assignments:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get RACI assignments:', error);
    throw error;
  }
};

/**
 * Create or update RACI assignment
 * @param {Object} raciAssignment - RACI assignment data
 * @returns {Promise<Object>} Created/updated RACI assignment
 */
export const upsertRACIAssignment = async (raciAssignment) => {
  const {
    id,
    process_impact_id,
    stakeholder_id,
    stakeholder_role_id,
    as_is_responsible = false,
    as_is_accountable = false,
    as_is_consulted = false,
    as_is_informed = false,
    to_be_responsible = false,
    to_be_accountable = false,
    to_be_consulted = false,
    to_be_informed = false,
    responsibility_change_impact = 0,
    training_requirements,
    change_readiness_score
  } = raciAssignment;

  if (!process_impact_id) {
    throw new Error('Process impact ID is required');
  }

  if (!stakeholder_id && !stakeholder_role_id) {
    throw new Error('Either stakeholder ID or stakeholder role ID is required');
  }

  try {
    const assignmentData = {
      process_impact_id,
      stakeholder_id: stakeholder_id || null,
      stakeholder_role_id: stakeholder_role_id || null,
      as_is_responsible,
      as_is_accountable,
      as_is_consulted,
      as_is_informed,
      to_be_responsible,
      to_be_accountable,
      to_be_consulted,
      to_be_informed,
      responsibility_change_impact,
      training_requirements,
      change_readiness_score
    };

    let query;
    if (id) {
      // Update existing assignment
      query = supabase
        .from('process_raci')
        .update(assignmentData)
        .eq('id', id);
    } else {
      // Create new assignment
      query = supabase
        .from('process_raci')
        .insert([assignmentData]);
    }

    const { data, error } = await query
      .select(`
        *,
        stakeholder:stakeholders(
          id,
          name,
          title,
          department,
          organization
        ),
        stakeholder_role:stakeholder_roles(
          id,
          role_code,
          role_name
        )
      `)
      .single();

    if (error) {
      console.error('Error upserting RACI assignment:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to upsert RACI assignment:', error);
    throw error;
  }
};

/**
 * Delete RACI assignment
 * @param {string} raciId - The RACI assignment ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteRACIAssignment = async (raciId) => {
  if (!raciId) {
    throw new Error('RACI assignment ID is required');
  }

  try {
    const { error } = await supabase
      .from('process_raci')
      .delete()
      .eq('id', raciId);

    if (error) {
      console.error('Error deleting RACI assignment:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete RACI assignment:', error);
    throw error;
  }
};

/**
 * Get RACI summary for an assessment
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Object>} RACI summary statistics
 */
export const getRACISummary = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_impacts')
      .select(`
        id,
        as_is_raci_r,
        as_is_raci_a,
        as_is_raci_c,
        as_is_raci_i,
        to_be_raci_r,
        to_be_raci_a,
        to_be_raci_c,
        to_be_raci_i,
        overall_impact_rating
      `)
      .eq('assessment_id', assessmentId);

    if (error) {
      console.error('Error fetching RACI summary:', error);
      throw error;
    }

    // Calculate basic statistics from text-based RACI fields
    const summary = {
      total_processes: data.length,
      processes_with_raci: 0,
      processes_without_raci: 0,
      as_is_assignments: { responsible: 0, accountable: 0, consulted: 0, informed: 0 },
      to_be_assignments: { responsible: 0, accountable: 0, consulted: 0, informed: 0 }
    };

    data.forEach(processImpact => {
      const hasRaci = [
        processImpact.as_is_raci_r, processImpact.as_is_raci_a, 
        processImpact.as_is_raci_c, processImpact.as_is_raci_i,
        processImpact.to_be_raci_r, processImpact.to_be_raci_a,
        processImpact.to_be_raci_c, processImpact.to_be_raci_i
      ].some(field => field && field.trim().length > 0);

      if (hasRaci) {
        summary.processes_with_raci++;

        // Count as-is assignments (simple count if field has content)
        if (processImpact.as_is_raci_r && processImpact.as_is_raci_r.trim()) summary.as_is_assignments.responsible++;
        if (processImpact.as_is_raci_a && processImpact.as_is_raci_a.trim()) summary.as_is_assignments.accountable++;
        if (processImpact.as_is_raci_c && processImpact.as_is_raci_c.trim()) summary.as_is_assignments.consulted++;
        if (processImpact.as_is_raci_i && processImpact.as_is_raci_i.trim()) summary.as_is_assignments.informed++;

        // Count to-be assignments
        if (processImpact.to_be_raci_r && processImpact.to_be_raci_r.trim()) summary.to_be_assignments.responsible++;
        if (processImpact.to_be_raci_a && processImpact.to_be_raci_a.trim()) summary.to_be_assignments.accountable++;
        if (processImpact.to_be_raci_c && processImpact.to_be_raci_c.trim()) summary.to_be_assignments.consulted++;
        if (processImpact.to_be_raci_i && processImpact.to_be_raci_i.trim()) summary.to_be_assignments.informed++;
      } else {
        summary.processes_without_raci++;
      }
    });

    return summary;
  } catch (error) {
    console.error('Failed to get RACI summary:', error);
    throw error;
  }
};

/**
 * Validate RACI assignments for a process
 * @param {Array} raciAssignments - Array of RACI assignments
 * @returns {Array} Array of validation errors
 */
export const validateRACIAssignments = (raciAssignments) => {
  const errors = [];

  if (!raciAssignments || raciAssignments.length === 0) {
    return errors; // Empty assignments are allowed
  }

  // Check for exactly one accountable person in As-Is
  const asIsAccountable = raciAssignments.filter(raci => raci.as_is_accountable);
  if (asIsAccountable.length > 1) {
    errors.push('Only one stakeholder can be Accountable in As-Is state');
  }

  // Check for exactly one accountable person in To-Be
  const toBeAccountable = raciAssignments.filter(raci => raci.to_be_accountable);
  if (toBeAccountable.length > 1) {
    errors.push('Only one stakeholder can be Accountable in To-Be state');
  }

  // Check for at least one responsible person if there's an accountable
  if (asIsAccountable.length === 1) {
    const asIsResponsible = raciAssignments.filter(raci => raci.as_is_responsible);
    if (asIsResponsible.length === 0) {
      errors.push('At least one stakeholder must be Responsible when Accountable is assigned in As-Is state');
    }
  }

  if (toBeAccountable.length === 1) {
    const toBeResponsible = raciAssignments.filter(raci => raci.to_be_responsible);
    if (toBeResponsible.length === 0) {
      errors.push('At least one stakeholder must be Responsible when Accountable is assigned in To-Be state');
    }
  }

  return errors;
};

// =============================================
// PROCESS HIERARCHY MANAGEMENT OPERATIONS
// =============================================

/**
 * Get process hierarchy for an assessment in tree structure
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Array>} Array of hierarchical processes
 */
export const getProcessHierarchyTree = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_hierarchy')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('level_number')
      .order('sort_order')
      .order('process_code');

    if (error) {
      console.error('Error fetching process hierarchy:', error);
      throw error;
    }

    // Build tree structure
    return buildHierarchyTree(data || []);
  } catch (error) {
    console.error('Failed to get process hierarchy tree:', error);
    throw error;
  }
};

/**
 * Build hierarchical tree structure from flat array
 * @param {Array} processes - Flat array of processes
 * @returns {Array} Hierarchical tree structure
 */
const buildHierarchyTree = (processes) => {
  const processMap = new Map();
  const rootProcesses = [];

  // Create map for quick lookup
  processes.forEach(process => {
    processMap.set(process.id, { ...process, children: [] });
  });

  // Build tree structure
  processes.forEach(process => {
    const processNode = processMap.get(process.id);
    
    if (process.parent_id && processMap.has(process.parent_id)) {
      const parent = processMap.get(process.parent_id);
      parent.children.push(processNode);
    } else {
      rootProcesses.push(processNode);
    }
  });

  return rootProcesses;
};

/**
 * Create or update a process in hierarchy
 * @param {Object} processData - Process data
 * @returns {Promise<Object>} Created/updated process
 */
export const upsertProcessHierarchy = async (processData) => {
  const {
    id,
    assessment_id,
    process_code,
    process_name,
    level_number,
    parent_id,
    sort_order = 0,
    is_active = true
  } = processData;

  if (!assessment_id || !process_code || !process_name || level_number === undefined) {
    throw new Error('Assessment ID, process code, name, and level are required');
  }

  try {
    const hierarchyData = {
      assessment_id,
      process_code: process_code.trim(),
      process_name: process_name.trim(),
      level_number,
      parent_id: parent_id || null,
      sort_order,
      is_active
    };

    let query;
    if (id) {
      // Update existing process
      query = supabase
        .from('process_hierarchy')
        .update(hierarchyData)
        .eq('id', id);
    } else {
      // Create new process
      query = supabase
        .from('process_hierarchy')
        .insert([hierarchyData]);
    }

    const { data, error } = await query
      .select('*')
      .single();

    if (error) {
      console.error('Error upserting process hierarchy:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to upsert process hierarchy:', error);
    throw error;
  }
};

/**
 * Delete a process from hierarchy (and its children)
 * @param {string} processId - The process ID to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteProcessHierarchy = async (processId) => {
  if (!processId) {
    throw new Error('Process ID is required');
  }

  try {
    // Note: CASCADE delete will handle children automatically
    const { error } = await supabase
      .from('process_hierarchy')
      .delete()
      .eq('id', processId);

    if (error) {
      console.error('Error deleting process hierarchy:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete process hierarchy:', error);
    throw error;
  }
};

/**
 * Reorder processes in hierarchy
 * @param {Array} reorderedProcesses - Array of {id, sort_order} objects
 * @returns {Promise<boolean>} Success status
 */
export const reorderProcessHierarchy = async (reorderedProcesses) => {
  if (!reorderedProcesses || reorderedProcesses.length === 0) {
    return true;
  }

  try {
    // Update sort orders in batch
    const updates = reorderedProcesses.map(({ id, sort_order }) => 
      supabase
        .from('process_hierarchy')
        .update({ sort_order })
        .eq('id', id)
    );

    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error('Failed to reorder process hierarchy:', error);
    throw error;
  }
};

/**
 * Validate process hierarchy rules
 * @param {Object} processData - Process data to validate
 * @param {Array} existingProcesses - Existing processes in hierarchy
 * @returns {Array} Array of validation errors
 */
export const validateProcessHierarchy = (processData, existingProcesses = []) => {
  const errors = [];

  if (!processData.process_code?.trim()) {
    errors.push('Process code is required');
  }

  if (!processData.process_name?.trim()) {
    errors.push('Process name is required');
  }

  if (processData.level_number < 0 || processData.level_number > 3) {
    errors.push('Level must be between 0 and 3');
  }

  // Check for duplicate process codes
  const duplicate = existingProcesses.find(p => 
    p.id !== processData.id && 
    p.process_code === processData.process_code?.trim()
  );
  
  if (duplicate) {
    errors.push('Process code already exists in this assessment');
  }

  // Validate parent-child relationship
  if (processData.parent_id) {
    const parent = existingProcesses.find(p => p.id === processData.parent_id);
    if (!parent) {
      errors.push('Selected parent process not found');
    } else if (parent.level_number >= processData.level_number) {
      errors.push('Parent process must be at a higher level (lower number)');
    }
  } else if (processData.level_number > 0) {
    errors.push('Processes below L0 must have a parent');
  }

  return errors;
};

// =============================================
// BULK IMPORT/EXPORT OPERATIONS
// =============================================

/**
 * Bulk import process hierarchy from Excel data
 * @param {string} assessmentId - The assessment ID
 * @param {Array} processData - Array of process objects from Excel
 * @returns {Promise<Object>} Import results with stats and errors
 */
export const bulkImportProcessHierarchy = async (assessmentId, processData) => {
  if (!assessmentId || !Array.isArray(processData)) {
    throw new Error('Assessment ID and process data array are required');
  }

  const results = {
    total: processData.length,
    created: 0,
    updated: 0,
    errors: []
  };

  try {
    // Get existing processes for validation
    const existingProcesses = await getProcessHierarchyFlat(assessmentId);
    
    // Validate all processes first
    const validationErrors = [];
    processData.forEach((process, index) => {
      const processErrors = validateProcessHierarchy(process, existingProcesses);
      if (processErrors.length > 0) {
        validationErrors.push({
          row: index + 1,
          errors: processErrors
        });
      }
    });

    if (validationErrors.length > 0) {
      results.errors = validationErrors;
      return results;
    }

    // Process in transaction-like manner
    for (const [index, process] of processData.entries()) {
      try {
        const processData = {
          ...process,
          assessment_id: assessmentId
        };

        await upsertProcessHierarchy(processData);
        
        if (process.id) {
          results.updated++;
        } else {
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          row: index + 1,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Bulk import failed:', error);
    throw error;
  }
};

/**
 * Export process hierarchy for Excel
 * @param {string} assessmentId - The assessment ID
 * @returns {Promise<Array>} Flattened process data for Excel export
 */
export const exportProcessHierarchyForExcel = async (assessmentId) => {
  if (!assessmentId) {
    throw new Error('Assessment ID is required');
  }

  try {
    const hierarchyTree = await getProcessHierarchyTree(assessmentId);
    const flatData = [];

    const flattenForExport = (processes, parentPath = '') => {
      processes.forEach(process => {
        const fullPath = parentPath ? `${parentPath} > ${process.process_name}` : process.process_name;
        
        flatData.push({
          id: process.id,
          process_code: process.process_code,
          process_name: process.process_name,
          level_number: process.level_number,
          level_label: `L${process.level_number}`,
          parent_id: process.parent_id,
          sort_order: process.sort_order,
          hierarchy_path: fullPath,
          created_at: process.created_at,
          updated_at: process.updated_at
        });

        if (process.children && process.children.length > 0) {
          flattenForExport(process.children, fullPath);
        }
      });
    };

    flattenForExport(hierarchyTree);
    return flatData;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};