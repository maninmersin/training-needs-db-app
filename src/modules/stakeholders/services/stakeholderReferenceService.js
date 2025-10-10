import { supabase } from '@core/services/supabaseClient';

// =============================================
// STAKEHOLDER REFERENCE DATA SERVICE
// Handles fetching of customizable dropdown values
// =============================================

/**
 * Get stakeholder types for a project
 */
export const getStakeholderTypes = async (projectId) => {
  if (!projectId) {
    // Return default values if no project
    return [
      'Executive', 'Senior Manager', 'Manager', 'Supervisor', 
      'Key User', 'Subject Matter Expert', 'Union Representative',
      'External Partner', 'Vendor', 'Customer', 'General'
    ];
  }

  try {
    const { data, error } = await supabase
      .from('stakeholder_types')
      .select('type_name')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    // If no custom types, return defaults
    if (!data || data.length === 0) {
      return [
        'Executive', 'Senior Manager', 'Manager', 'Supervisor', 
        'Key User', 'Subject Matter Expert', 'Union Representative',
        'External Partner', 'Vendor', 'Customer', 'General'
      ];
    }

    return data.map(item => item.type_name);
  } catch (error) {
    console.error('Error fetching stakeholder types:', error);
    // Fallback to defaults on error
    return [
      'Executive', 'Senior Manager', 'Manager', 'Supervisor', 
      'Key User', 'Subject Matter Expert', 'Union Representative',
      'External Partner', 'Vendor', 'Customer', 'General'
    ];
  }
};

/**
 * Get stakeholder categories for a project
 */
export const getStakeholderCategories = async (projectId) => {
  if (!projectId) {
    return ['Internal', 'External'];
  }

  try {
    const { data, error } = await supabase
      .from('stakeholder_categories')
      .select('category_name')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    // If no custom categories, return defaults
    if (!data || data.length === 0) {
      return ['Internal', 'External'];
    }

    return data.map(item => item.category_name);
  } catch (error) {
    console.error('Error fetching stakeholder categories:', error);
    return ['Internal', 'External'];
  }
};

/**
 * Get stakeholder priorities for a project
 */
export const getStakeholderPriorities = async (projectId) => {
  if (!projectId) {
    return ['Primary', 'Secondary'];
  }

  try {
    const { data, error } = await supabase
      .from('stakeholder_priorities')
      .select('priority_name')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    // If no custom priorities, return defaults
    if (!data || data.length === 0) {
      return ['Primary', 'Secondary'];
    }

    return data.map(item => item.priority_name);
  } catch (error) {
    console.error('Error fetching stakeholder priorities:', error);
    return ['Primary', 'Secondary'];
  }
};

/**
 * Get all reference data for a project
 */
export const getAllReferenceData = async (projectId) => {
  try {
    const [types, categories, priorities] = await Promise.all([
      getStakeholderTypes(projectId),
      getStakeholderCategories(projectId),
      getStakeholderPriorities(projectId)
    ]);

    return {
      types,
      categories,
      priorities
    };
  } catch (error) {
    console.error('Error fetching all reference data:', error);
    return {
      types: ['Executive', 'Senior Manager', 'Manager', 'Supervisor', 'Key User', 'Subject Matter Expert', 'Union Representative', 'External Partner', 'Vendor', 'Customer', 'General'],
      categories: ['Internal', 'External'],
      priorities: ['Primary', 'Secondary']
    };
  }
};