import { supabase } from '@core/services/supabaseClient';

/**
 * Enhanced Stakeholder Service
 * Stage 1: Foundation with industry-standard fields and 1-5 scales
 * Handles all CRUD operations for enhanced stakeholder management
 * Includes proper project-based RLS isolation
 */

// =============================================
// STAKEHOLDER CRUD OPERATIONS
// =============================================

/**
 * Get all stakeholders for a project with enhanced fields
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of stakeholders with all enhanced fields
 */
export const getStakeholders = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for stakeholder operations');
  }

  try {
    const { data, error } = await supabase
      .from('stakeholders')
      .select(`
        *,
        relationship_owner_profile:auth_users!relationship_owner(
          id,
          email
        )
      `)
      .eq('project_id', projectId)
      .order('name');

    if (error) {
      console.error('Error fetching stakeholders:', error);
      throw error;
    }

    // Add calculated fields
    return (data || []).map(stakeholder => ({
      ...stakeholder,
      quadrant: getStakeholderQuadrant(stakeholder.power_level, stakeholder.interest_level),
      engagement_gap: stakeholder.target_engagement_level - stakeholder.current_engagement_level,
      power_description: getPowerDescription(stakeholder.power_level),
      interest_description: getInterestDescription(stakeholder.interest_level),
      engagement_description: getEngagementDescription(stakeholder.current_engagement_level),
      target_engagement_description: getEngagementDescription(stakeholder.target_engagement_level),
      status_color: getStatusColor(stakeholder.engagement_status),
      days_since_contact: stakeholder.last_contact_date ? 
        Math.floor((new Date() - new Date(stakeholder.last_contact_date)) / (1000 * 60 * 60 * 24)) : null
    }));
  } catch (error) {
    console.error('Failed to get stakeholders:', error);
    throw error;
  }
};

/**
 * Get a single stakeholder by ID with enhanced fields
 * @param {number} stakeholderId - The stakeholder ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Enhanced stakeholder object
 */
export const getStakeholder = async (stakeholderId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for stakeholder operations');
  }

  try {
    const { data, error } = await supabase
      .from('stakeholders')
      .select(`
        *,
        relationship_owner_profile:auth_users!relationship_owner(
          id,
          email
        )
      `)
      .eq('id', stakeholderId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching stakeholder:', error);
      throw error;
    }

    // Add calculated fields
    return {
      ...data,
      quadrant: getStakeholderQuadrant(data.power_level, data.interest_level),
      engagement_gap: data.target_engagement_level - data.current_engagement_level,
      power_description: getPowerDescription(data.power_level),
      interest_description: getInterestDescription(data.interest_level),
      engagement_description: getEngagementDescription(data.current_engagement_level),
      target_engagement_description: getEngagementDescription(data.target_engagement_level),
      status_color: getStatusColor(data.engagement_status),
      days_since_contact: data.last_contact_date ? 
        Math.floor((new Date() - new Date(data.last_contact_date)) / (1000 * 60 * 60 * 24)) : null
    };
  } catch (error) {
    console.error('Failed to get stakeholder:', error);
    throw error;
  }
};

/**
 * Create a new stakeholder with enhanced fields
 * @param {Object} stakeholderData - The stakeholder data
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Created stakeholder
 */
export const createStakeholder = async (stakeholderData, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for stakeholder operations');
  }

  try {
    // Validate the stakeholder data
    const validation = validateStakeholder(stakeholderData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const stakeholder = {
      ...stakeholderData,
      project_id: projectId,
      // Set defaults for new fields if not provided
      stakeholder_category: stakeholderData.stakeholder_category || 'Internal',
      stakeholder_priority: stakeholderData.stakeholder_priority || 'Primary',
      power_level: stakeholderData.power_level || 3,
      interest_level: stakeholderData.interest_level || 3,
      current_engagement_level: stakeholderData.current_engagement_level || 0,
      target_engagement_level: stakeholderData.target_engagement_level || 3,
      engagement_status: stakeholderData.engagement_status || 'A'
    };

    const { data, error } = await supabase
      .from('stakeholders')
      .insert([stakeholder])
      .select(`
        *,
        relationship_owner_profile:auth_users!relationship_owner(
          id,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error creating stakeholder:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create stakeholder:', error);
    throw error;
  }
};

/**
 * Update an existing stakeholder with enhanced fields
 * @param {number} stakeholderId - The stakeholder ID
 * @param {Object} stakeholderData - The updated stakeholder data
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Updated stakeholder
 */
export const updateStakeholder = async (stakeholderId, stakeholderData, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for stakeholder operations');
  }

  try {
    // Validate the stakeholder data
    const validation = validateStakeholder(stakeholderData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('stakeholders')
      .update(stakeholderData)
      .eq('id', stakeholderId)
      .eq('project_id', projectId)
      .select(`
        *,
        relationship_owner_profile:auth_users!relationship_owner(
          id,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error updating stakeholder:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update stakeholder:', error);
    throw error;
  }
};

/**
 * Delete a stakeholder
 * @param {number} stakeholderId - The stakeholder ID
 * @param {string} projectId - The project ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteStakeholder = async (stakeholderId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for stakeholder operations');
  }

  try {
    const { error } = await supabase
      .from('stakeholders')
      .delete()
      .eq('id', stakeholderId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting stakeholder:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete stakeholder:', error);
    throw error;
  }
};

// =============================================
// PROJECT USERS FOR RELATIONSHIP OWNERSHIP
// =============================================

/**
 * Get all users in a project for relationship owner selection
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of project users
 */
export const getProjectUsers = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for getting project users');
  }

  try {
    const { data, error } = await supabase
      .from('project_users')
      .select(`
        user_id,
        auth_users!inner(
          id,
          email
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching project users:', error);
      throw error;
    }

    // Transform the data to a more usable format
    return (data || []).map(item => ({
      id: item.auth_users.id,
      email: item.auth_users.email,
      name: item.auth_users.email.split('@')[0] // Use email prefix as display name
    }));
  } catch (error) {
    console.error('Failed to get project users:', error);
    throw error;
  }
};

// =============================================
// ENHANCED SEARCH AND FILTERING
// =============================================

/**
 * Search stakeholders with enhanced filtering
 * @param {string} projectId - The project ID
 * @param {string} searchTerm - Search term for name, title, department
 * @param {Object} filters - Enhanced filter options
 * @returns {Promise<Array>} Filtered stakeholders
 */
export const searchStakeholders = async (projectId, searchTerm = '', filters = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for search operations');
  }

  try {
    let query = supabase
      .from('stakeholders')
      .select(`
        *,
        relationship_owner_profile:auth_users!relationship_owner(
          id,
          email
        )
      `)
      .eq('project_id', projectId);

    // Apply text search
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%`);
    }

    // Apply enhanced filters
    if (filters.stakeholder_type) {
      query = query.eq('stakeholder_type', filters.stakeholder_type);
    }
    if (filters.stakeholder_category) {
      query = query.eq('stakeholder_category', filters.stakeholder_category);
    }
    if (filters.stakeholder_priority) {
      query = query.eq('stakeholder_priority', filters.stakeholder_priority);
    }
    if (filters.power_level) {
      query = query.eq('power_level', filters.power_level);
    }
    if (filters.interest_level) {
      query = query.eq('interest_level', filters.interest_level);
    }
    if (filters.current_engagement_level !== undefined) {
      query = query.eq('current_engagement_level', filters.current_engagement_level);
    }
    if (filters.position_on_change) {
      query = query.eq('position_on_change', filters.position_on_change);
    }
    if (filters.engagement_status) {
      query = query.eq('engagement_status', filters.engagement_status);
    }
    if (filters.relationship_owner) {
      query = query.eq('relationship_owner', filters.relationship_owner);
    }

    // Apply date filters
    if (filters.contact_overdue_days) {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - filters.contact_overdue_days);
      query = query.or(`last_contact_date.is.null,last_contact_date.lt.${overdueDate.toISOString().split('T')[0]}`);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error searching stakeholders:', error);
      throw error;
    }

    // Add calculated fields to search results
    return (data || []).map(stakeholder => ({
      ...stakeholder,
      quadrant: getStakeholderQuadrant(stakeholder.power_level, stakeholder.interest_level),
      engagement_gap: stakeholder.target_engagement_level - stakeholder.current_engagement_level,
      power_description: getPowerDescription(stakeholder.power_level),
      interest_description: getInterestDescription(stakeholder.interest_level),
      engagement_description: getEngagementDescription(stakeholder.current_engagement_level),
      status_color: getStatusColor(stakeholder.engagement_status),
      days_since_contact: stakeholder.last_contact_date ? 
        Math.floor((new Date() - new Date(stakeholder.last_contact_date)) / (1000 * 60 * 60 * 24)) : null
    }));
  } catch (error) {
    console.error('Failed to search stakeholders:', error);
    throw error;
  }
};

// =============================================
// ANALYTICS AND STATISTICS
// =============================================

/**
 * Get enhanced stakeholder statistics
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Enhanced statistics
 */
export const getStakeholderStats = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for statistics operations');
  }

  try {
    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching stakeholder stats:', error);
      throw error;
    }

    const stakeholders = data || [];
    const total = stakeholders.length;

    // Calculate enhanced statistics
    const stats = {
      total,
      
      // Power level distribution
      byPowerLevel: {
        1: stakeholders.filter(s => s.power_level === 1).length,
        2: stakeholders.filter(s => s.power_level === 2).length,
        3: stakeholders.filter(s => s.power_level === 3).length,
        4: stakeholders.filter(s => s.power_level === 4).length,
        5: stakeholders.filter(s => s.power_level === 5).length
      },
      
      // Interest level distribution
      byInterestLevel: {
        1: stakeholders.filter(s => s.interest_level === 1).length,
        2: stakeholders.filter(s => s.interest_level === 2).length,
        3: stakeholders.filter(s => s.interest_level === 3).length,
        4: stakeholders.filter(s => s.interest_level === 4).length,
        5: stakeholders.filter(s => s.interest_level === 5).length
      },
      
      // Engagement level distribution
      byEngagementLevel: {
        0: stakeholders.filter(s => s.current_engagement_level === 0).length,
        1: stakeholders.filter(s => s.current_engagement_level === 1).length,
        2: stakeholders.filter(s => s.current_engagement_level === 2).length,
        3: stakeholders.filter(s => s.current_engagement_level === 3).length,
        4: stakeholders.filter(s => s.current_engagement_level === 4).length,
        5: stakeholders.filter(s => s.current_engagement_level === 5).length
      },
      
      // Position on change distribution
      byPosition: {
        Champion: stakeholders.filter(s => s.position_on_change === 'Champion').length,
        Supporter: stakeholders.filter(s => s.position_on_change === 'Supporter').length,
        Neutral: stakeholders.filter(s => s.position_on_change === 'Neutral').length,
        Skeptic: stakeholders.filter(s => s.position_on_change === 'Skeptic').length,
        Resistor: stakeholders.filter(s => s.position_on_change === 'Resistor').length
      },
      
      // RAG Status distribution
      byRAGStatus: {
        Red: stakeholders.filter(s => s.engagement_status === 'R').length,
        Amber: stakeholders.filter(s => s.engagement_status === 'A').length,
        Green: stakeholders.filter(s => s.engagement_status === 'G').length
      },
      
      // Quadrant distribution
      byQuadrant: stakeholders.reduce((acc, s) => {
        const quadrant = getStakeholderQuadrant(s.power_level, s.interest_level);
        acc[quadrant] = (acc[quadrant] || 0) + 1;
        return acc;
      }, {}),
      
      // Engagement gap analysis
      engagementGaps: {
        ahead: stakeholders.filter(s => s.current_engagement_level > s.target_engagement_level).length,
        onTarget: stakeholders.filter(s => s.current_engagement_level === s.target_engagement_level).length,
        behind: stakeholders.filter(s => s.current_engagement_level < s.target_engagement_level).length,
        averageGap: total > 0 ? 
          stakeholders.reduce((sum, s) => sum + (s.target_engagement_level - s.current_engagement_level), 0) / total : 0
      },
      
      // Contact tracking
      contactStats: {
        neverContacted: stakeholders.filter(s => !s.last_contact_date).length,
        overdueContacts: stakeholders.filter(s => {
          if (!s.last_contact_date) return true;
          const daysSince = Math.floor((new Date() - new Date(s.last_contact_date)) / (1000 * 60 * 60 * 24));
          return daysSince > 30; // Consider 30+ days as overdue
        }).length
      }
    };

    return stats;
  } catch (error) {
    console.error('Failed to get stakeholder statistics:', error);
    throw error;
  }
};

/**
 * Get influence/interest matrix data
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Matrix data with quadrant information
 */
export const getInfluenceInterestMatrix = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for matrix operations');
  }

  try {
    const stakeholders = await getStakeholders(projectId);
    
    return stakeholders.map(stakeholder => ({
      ...stakeholder,
      quadrant: getStakeholderQuadrant(stakeholder.power_level, stakeholder.interest_level),
      quadrantStrategy: getQuadrantStrategy(stakeholder.power_level, stakeholder.interest_level)
    }));
  } catch (error) {
    console.error('Failed to get matrix data:', error);
    throw error;
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get stakeholder quadrant based on power and interest levels
 */
function getStakeholderQuadrant(powerLevel, interestLevel) {
  if (interestLevel >= 4 && powerLevel >= 4) return 'Manage Closely';
  if (interestLevel < 3 && powerLevel >= 4) return 'Keep Satisfied';
  if (interestLevel >= 4 && powerLevel < 3) return 'Keep Informed';
  return 'Monitor';
}

/**
 * Get quadrant strategy recommendations
 */
function getQuadrantStrategy(powerLevel, interestLevel) {
  const quadrant = getStakeholderQuadrant(powerLevel, interestLevel);
  const strategies = {
    'Manage Closely': 'Keep satisfied and fully engaged. Regular communication and involvement in decision-making.',
    'Keep Satisfied': 'Keep satisfied but don\'t overwhelm with communication. Focus on their key concerns.',
    'Keep Informed': 'Keep informed and engaged. They can be advocates but have limited power.',
    'Monitor': 'Monitor with minimal effort. Periodic updates sufficient.'
  };
  return strategies[quadrant];
}

/**
 * Get power level description
 */
function getPowerDescription(level) {
  const descriptions = {
    1: 'Very Low - Minimal ability to influence',
    2: 'Low - Limited influence on outcomes',
    3: 'Medium - Some impact on decisions',
    4: 'High - Significant influence on success',
    5: 'Very High - Critical influence on outcomes'
  };
  return descriptions[level] || 'Unknown';
}

/**
 * Get interest level description
 */
function getInterestDescription(level) {
  const descriptions = {
    1: 'Very Low - Minimal interest or concern',
    2: 'Low - Limited interest in the change',
    3: 'Medium - Moderate level of interest',
    4: 'High - Highly interested and engaged',
    5: 'Very High - Extremely interested and concerned'
  };
  return descriptions[level] || 'Unknown';
}

/**
 * Get engagement level description
 */
function getEngagementDescription(level) {
  const descriptions = {
    0: 'Not Aware - Unaware of the change',
    1: 'Aware - Knows about the change',
    2: 'Understanding - Understands the impact',
    3: 'Ready to Collaborate - Willing to participate',
    4: 'Committed - Actively supporting',
    5: 'Champion - Advocating for the change'
  };
  return descriptions[level] || 'Unknown';
}

/**
 * Get status color for RAG status
 */
function getStatusColor(status) {
  const colors = {
    'R': '#ef4444', // Red
    'A': '#f59e0b', // Amber
    'G': '#10b981'  // Green
  };
  return colors[status] || '#6b7280';
}

// =============================================
// VALIDATION FUNCTIONS
// =============================================

/**
 * Validate stakeholder data with enhanced fields
 * @param {Object} stakeholderData - The stakeholder data to validate
 * @returns {Object} Validation result
 */
export const validateStakeholder = (stakeholderData) => {
  const errors = [];

  // Required fields
  if (!stakeholderData.name || stakeholderData.name.trim().length === 0) {
    errors.push('Name is required');
  }

  // Validate power level
  if (stakeholderData.power_level !== undefined) {
    const powerLevel = parseInt(stakeholderData.power_level);
    if (isNaN(powerLevel) || powerLevel < 1 || powerLevel > 5) {
      errors.push('Power level must be between 1 and 5');
    }
  }

  // Validate interest level
  if (stakeholderData.interest_level !== undefined) {
    const interestLevel = parseInt(stakeholderData.interest_level);
    if (isNaN(interestLevel) || interestLevel < 1 || interestLevel > 5) {
      errors.push('Interest level must be between 1 and 5');
    }
  }

  // Validate engagement levels
  if (stakeholderData.current_engagement_level !== undefined) {
    const currentLevel = parseInt(stakeholderData.current_engagement_level);
    if (isNaN(currentLevel) || currentLevel < 0 || currentLevel > 5) {
      errors.push('Current engagement level must be between 0 and 5');
    }
  }

  if (stakeholderData.target_engagement_level !== undefined) {
    const targetLevel = parseInt(stakeholderData.target_engagement_level);
    if (isNaN(targetLevel) || targetLevel < 0 || targetLevel > 5) {
      errors.push('Target engagement level must be between 0 and 5');
    }
  }

  // Validate email format if provided
  if (stakeholderData.email && stakeholderData.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stakeholderData.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate engagement status
  if (stakeholderData.engagement_status && !['R', 'A', 'G'].includes(stakeholderData.engagement_status)) {
    errors.push('Engagement status must be R (Red), A (Amber), or G (Green)');
  }

  // Validate stakeholder category
  if (stakeholderData.stakeholder_category && !['Internal', 'External'].includes(stakeholderData.stakeholder_category)) {
    errors.push('Stakeholder category must be Internal or External');
  }

  // Validate stakeholder priority
  if (stakeholderData.stakeholder_priority && !['Primary', 'Secondary'].includes(stakeholderData.stakeholder_priority)) {
    errors.push('Stakeholder priority must be Primary or Secondary');
  }

  // Validate position on change
  if (stakeholderData.position_on_change && !['Champion', 'Supporter', 'Neutral', 'Skeptic', 'Resistor'].includes(stakeholderData.position_on_change)) {
    errors.push('Position on change must be Champion, Supporter, Neutral, Skeptic, or Resistor');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};