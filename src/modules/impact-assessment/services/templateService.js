import { supabase } from '@core/services/supabaseClient';

/**
 * Process Template Service
 * Handles CRUD operations for process hierarchy templates
 * Enables reusable process structures across assessments
 */

// =============================================
// TEMPLATE CRUD OPERATIONS
// =============================================

/**
 * Get all process templates accessible to a project
 * @param {string} projectId - The project ID
 * @returns {Promise<Array>} Array of available templates
 */
export const getProcessTemplates = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for template operations');
  }

  try {
    const { data, error } = await supabase
      .from('process_templates')
      .select(`
        id,
        name,
        description,
        industry,
        change_type,
        hierarchy_structure,
        is_public,
        created_at,
        creator:auth_users!created_by(
          id,
          email
        )
      `)
      .or(`is_public.eq.true,created_by.eq.${(await supabase.auth.getUser()).data.user?.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching process templates:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get process templates:', error);
    throw error;
  }
};

/**
 * Get a single process template by ID
 * @param {string} templateId - The template ID
 * @returns {Promise<Object>} Template with full hierarchy structure
 */
export const getProcessTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_templates')
      .select(`
        *,
        creator:auth_users!created_by(
          id,
          email
        )
      `)
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('Error fetching process template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to get process template:', error);
    throw error;
  }
};

/**
 * Create a new process template
 * @param {Object} templateData - Template data
 * @returns {Promise<Object>} Created template
 */
export const createProcessTemplate = async (templateData) => {
  const { 
    name, 
    description, 
    industry, 
    change_type, 
    hierarchy_structure, 
    is_public = false 
  } = templateData;

  if (!name || !hierarchy_structure) {
    throw new Error('Template name and hierarchy structure are required');
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      throw new Error('User must be authenticated to create templates');
    }

    const { data, error } = await supabase
      .from('process_templates')
      .insert({
        name,
        description,
        industry,
        change_type,
        hierarchy_structure,
        is_public,
        created_by: user.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating process template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create process template:', error);
    throw error;
  }
};

/**
 * Update a process template
 * @param {string} templateId - The template ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated template
 */
export const updateProcessTemplate = async (templateId, updateData) => {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('process_templates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating process template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update process template:', error);
    throw error;
  }
};

/**
 * Delete a process template
 * @param {string} templateId - The template ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteProcessTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  try {
    const { error } = await supabase
      .from('process_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting process template:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete process template:', error);
    throw error;
  }
};

// =============================================
// INDUSTRY STANDARD TEMPLATES
// =============================================

/**
 * Get predefined industry templates
 * @returns {Array} Industry standard templates
 */
export const getIndustryTemplates = () => {
  return [
    {
      id: 'retail_standard',
      name: 'Retail Operations Standard',
      description: 'Standard retail business processes including Buy, Move, Sell operations',
      industry: 'retail',
      change_type: 'system_implementation',
      hierarchy_structure: {
        processes: [
          {
            code: '1',
            name: 'PLAN',
            children: [
              { code: '1.1', name: 'Strategic Planning', children: [] },
              { code: '1.2', name: 'Financial Planning', children: [] },
              { code: '1.3', name: 'Inventory Planning', children: [] }
            ]
          },
          {
            code: '2',
            name: 'BUY',
            children: [
              { 
                code: '2.1', 
                name: 'Supplier Management',
                children: [
                  { code: '2.1.1', name: 'Supplier Onboarding' },
                  { code: '2.1.2', name: 'Supplier Performance' }
                ]
              },
              { 
                code: '2.2', 
                name: 'Product Sourcing',
                children: [
                  { code: '2.2.1', name: 'Product Selection' },
                  { code: '2.2.2', name: 'Pricing Negotiation' }
                ]
              },
              { 
                code: '2.3', 
                name: 'Purchase Order Management',
                children: [
                  { code: '2.3.1', name: 'Create & Maintain Purchase Order' },
                  { code: '2.3.2', name: 'PO Approval Process' }
                ]
              }
            ]
          },
          {
            code: '3',
            name: 'MOVE',
            children: [
              { 
                code: '3.1', 
                name: 'Allocation & Replenishment',
                children: [
                  { code: '3.1.1', name: 'Trading Actions' },
                  { code: '3.1.2', name: 'Analyse Sales & Stock' },
                  { code: '3.1.3', name: 'Allocation Management' }
                ]
              },
              { 
                code: '3.2', 
                name: 'Inbound Goods Movement',
                children: [
                  { code: '3.2.1', name: 'Delivery Request' },
                  { code: '3.2.2', name: 'Shipment Request' },
                  { code: '3.2.3', name: 'Goods Receipt' },
                  { code: '3.2.4', name: 'Intake Management' }
                ]
              },
              { 
                code: '3.3', 
                name: 'Inbound Processing',
                children: [
                  { code: '3.3.1', name: 'Goods Receipt' },
                  { code: '3.3.2', name: 'Quality Control' },
                  { code: '3.3.3', name: 'Put Away' }
                ]
              },
              { 
                code: '3.4', 
                name: 'Outbound Goods Movement',
                children: [
                  { code: '3.4.1', name: 'Picking' },
                  { code: '3.4.2', name: 'Export Management' }
                ]
              },
              { 
                code: '3.5', 
                name: 'Outbound Processing',
                children: [
                  { code: '3.5.1', name: 'Order Processing' },
                  { code: '3.5.2', name: 'Load and Despatch' },
                  { code: '3.5.3', name: 'Demand Management' }
                ]
              }
            ]
          },
          {
            code: '4',
            name: 'SELL',
            children: [
              { code: '4.1', name: 'Customer Management', children: [] },
              { code: '4.2', name: 'Sales Operations', children: [] },
              { code: '4.3', name: 'Marketing & Promotions', children: [] }
            ]
          }
        ]
      }
    },
    {
      id: 'manufacturing_standard',
      name: 'Manufacturing Operations',
      description: 'Standard manufacturing processes including Plan, Make, Deliver',
      industry: 'manufacturing',
      change_type: 'system_implementation',
      hierarchy_structure: {
        processes: [
          {
            code: '1',
            name: 'PLAN',
            children: [
              { code: '1.1', name: 'Demand Planning', children: [] },
              { code: '1.2', name: 'Production Planning', children: [] },
              { code: '1.3', name: 'Resource Planning', children: [] }
            ]
          },
          {
            code: '2',
            name: 'SOURCE',
            children: [
              { code: '2.1', name: 'Raw Material Procurement', children: [] },
              { code: '2.2', name: 'Supplier Management', children: [] },
              { code: '2.3', name: 'Inventory Management', children: [] }
            ]
          },
          {
            code: '3',
            name: 'MAKE',
            children: [
              { code: '3.1', name: 'Production Control', children: [] },
              { code: '3.2', name: 'Quality Assurance', children: [] },
              { code: '3.3', name: 'Equipment Management', children: [] }
            ]
          },
          {
            code: '4',
            name: 'DELIVER',
            children: [
              { code: '4.1', name: 'Order Fulfillment', children: [] },
              { code: '4.2', name: 'Logistics Management', children: [] },
              { code: '4.3', name: 'Customer Service', children: [] }
            ]
          }
        ]
      }
    },
    {
      id: 'finance_standard',
      name: 'Financial Services',
      description: 'Standard financial services processes',
      industry: 'financial_services',
      change_type: 'regulatory_compliance',
      hierarchy_structure: {
        processes: [
          {
            code: '1',
            name: 'CUSTOMER ONBOARDING',
            children: [
              { code: '1.1', name: 'KYC Verification', children: [] },
              { code: '1.2', name: 'Account Opening', children: [] },
              { code: '1.3', name: 'Risk Assessment', children: [] }
            ]
          },
          {
            code: '2',
            name: 'TRANSACTION PROCESSING',
            children: [
              { code: '2.1', name: 'Payment Processing', children: [] },
              { code: '2.2', name: 'Trade Settlement', children: [] },
              { code: '2.3', name: 'Reconciliation', children: [] }
            ]
          },
          {
            code: '3',
            name: 'RISK MANAGEMENT',
            children: [
              { code: '3.1', name: 'Credit Risk', children: [] },
              { code: '3.2', name: 'Operational Risk', children: [] },
              { code: '3.3', name: 'Compliance Monitoring', children: [] }
            ]
          }
        ]
      }
    }
  ];
};

/**
 * Create industry template in database
 * @param {string} templateKey - Industry template key
 * @param {string} projectId - Project ID for context
 * @returns {Promise<Object>} Created template
 */
export const createIndustryTemplate = async (templateKey, projectId) => {
  const industryTemplates = getIndustryTemplates();
  const template = industryTemplates.find(t => t.id === templateKey);
  
  if (!template) {
    throw new Error('Industry template not found');
  }

  return await createProcessTemplate({
    name: template.name,
    description: template.description,
    industry: template.industry,
    change_type: template.change_type,
    hierarchy_structure: template.hierarchy_structure,
    is_public: false
  });
};

// =============================================
// TEMPLATE VALIDATION
// =============================================

/**
 * Validate template hierarchy structure
 * @param {Object} hierarchyStructure - Hierarchy structure to validate
 * @returns {Array} Validation errors
 */
export const validateTemplateHierarchy = (hierarchyStructure) => {
  const errors = [];
  
  if (!hierarchyStructure || !hierarchyStructure.processes) {
    errors.push('Template must have a processes array');
    return errors;
  }

  const processCodesSeen = new Set();
  
  const validateProcessLevel = (processes, level = 0, parentCode = '') => {
    processes.forEach((process, index) => {
      // Validate required fields
      if (!process.code || !process.name) {
        errors.push(`Process at level ${level}, position ${index} missing code or name`);
        return;
      }

      // Validate unique codes
      if (processCodesSeen.has(process.code)) {
        errors.push(`Duplicate process code: ${process.code}`);
      } else {
        processCodesSeen.add(process.code);
      }

      // Validate code format (should be hierarchical)
      if (level > 0 && parentCode && !process.code.startsWith(parentCode + '.')) {
        errors.push(`Process code ${process.code} should start with parent code ${parentCode}.`);
      }

      // Recursively validate children
      if (process.children && process.children.length > 0) {
        validateProcessLevel(process.children, level + 1, process.code);
      }
    });
  };

  validateProcessLevel(hierarchyStructure.processes);
  return errors;
};

/**
 * Convert flat process list to hierarchical structure
 * @param {Array} processes - Flat array of processes
 * @returns {Object} Hierarchical structure
 */
export const convertToHierarchy = (processes) => {
  const processMap = new Map();
  const rootProcesses = [];

  // Sort by code to ensure proper hierarchy
  const sortedProcesses = processes.sort((a, b) => a.code.localeCompare(b.code));

  // First pass: create all processes
  sortedProcesses.forEach(process => {
    processMap.set(process.code, { 
      ...process, 
      children: [] 
    });
  });

  // Second pass: build hierarchy
  sortedProcesses.forEach(process => {
    const parts = process.code.split('.');
    
    if (parts.length === 1) {
      // Root level process
      rootProcesses.push(processMap.get(process.code));
    } else {
      // Child process - find parent
      const parentCode = parts.slice(0, -1).join('.');
      const parent = processMap.get(parentCode);
      
      if (parent) {
        parent.children.push(processMap.get(process.code));
      } else {
        // Parent not found, treat as root
        rootProcesses.push(processMap.get(process.code));
      }
    }
  });

  return {
    processes: rootProcesses
  };
};