import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  getSystemsReferenceData,
  getStakeholderRolesReferenceData,
  getStatusOptionsReferenceData
} from '../services/impactAssessmentService';
import { supabase } from '@core/services/supabaseClient';
import './ReferenceDataSetup.css';

/**
 * Reference Data Setup Component
 * Manages dropdown options for Impact Assessment forms
 * Focuses on the 3 essential categories: Status, Core Systems, Stakeholder Role Codes
 */
const ReferenceDataSetup = () => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Reference data categories for Impact Analysis
  const [referenceData, setReferenceData] = useState({
    status_options: [],
    core_systems: [],
    stakeholder_roles: []
  });

  // Form state for adding new items
  const [activeCategory, setActiveCategory] = useState('status_options');
  const [newItem, setNewItem] = useState({ 
    code: '', 
    name: '', 
    description: '', 
    sort_order: 0, 
    color_code: '#6B7280' 
  });
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    if (currentProject?.id) {
      loadReferenceData();
    }
  }, [currentProject?.id]);

  const loadReferenceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load the 3 specific reference data categories using existing service functions
      const [statusOptions, coreSystems, stakeholderRoles] = await Promise.all([
        getStatusOptionsReferenceData(currentProject.id),
        getSystemsReferenceData(currentProject.id),
        getStakeholderRolesReferenceData(currentProject.id)
      ]);

      setReferenceData({
        status_options: statusOptions || [],
        core_systems: coreSystems || [],
        stakeholder_roles: stakeholderRoles || []
      });
    } catch (err) {
      console.error('Error loading reference data:', err);
      setError(err.message || 'Failed to load reference data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    if (!newItem.name.trim()) {
      setError('Item name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let itemData;
      let tableName;

      // Determine table and data structure based on category
      switch (activeCategory) {
        case 'status_options':
          tableName = 'impact_assessment_status_options';
          itemData = {
            project_id: currentProject.id,
            status_code: newItem.code || newItem.name.toUpperCase().replace(/\s+/g, '_'),
            status_name: newItem.name.trim(),
            description: newItem.description.trim(),
            color_code: newItem.color_code || '#6B7280',
            sort_order: newItem.sort_order || 0
          };
          break;
        case 'core_systems':
          tableName = 'impact_assessment_systems';
          itemData = {
            project_id: currentProject.id,
            system_code: newItem.code || newItem.name.toUpperCase().replace(/\s+/g, '_'),
            system_name: newItem.name.trim(),
            description: newItem.description.trim(),
            is_current: true,
            is_future: false,
            sort_order: newItem.sort_order || 0
          };
          break;
        case 'stakeholder_roles':
          tableName = 'impact_assessment_stakeholder_roles';
          itemData = {
            project_id: currentProject.id,
            role_code: newItem.code || newItem.name.toUpperCase().replace(/\s+/g, '_'),
            role_name: newItem.name.trim(),
            description: newItem.description.trim(),
            sort_order: newItem.sort_order || 0
          };
          break;
        default:
          throw new Error('Invalid category');
      }

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from(tableName)
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        setSuccessMessage('Reference data updated successfully');
      } else {
        // Create new item
        const { error } = await supabase
          .from(tableName)
          .insert(itemData);

        if (error) throw error;
        setSuccessMessage('Reference data added successfully');
      }

      // Reset form
      setNewItem({ code: '', name: '', description: '', sort_order: 0, color_code: '#6B7280' });
      setEditingItem(null);
      
      // Reload data
      await loadReferenceData();
    } catch (err) {
      console.error('Error saving reference data:', err);
      setError(err.message || 'Failed to save reference data');
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item) => {
    setNewItem({
      code: item.status_code || item.system_code || item.role_code || '',
      name: item.status_name || item.system_name || item.role_name || item.name || '',
      description: item.description || '',
      sort_order: item.sort_order || 0,
      color_code: item.color_code || '#6B7280'
    });
    setEditingItem(item);
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this reference data item?')) {
      return;
    }

    try {
      let tableName;
      switch (activeCategory) {
        case 'status_options':
          tableName = 'impact_assessment_status_options';
          break;
        case 'core_systems':
          tableName = 'impact_assessment_systems';
          break;
        case 'stakeholder_roles':
          tableName = 'impact_assessment_stakeholder_roles';
          break;
        default:
          throw new Error('Invalid category');
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setSuccessMessage('Reference data deleted successfully');
      await loadReferenceData();
    } catch (err) {
      console.error('Error deleting reference data:', err);
      setError(err.message || 'Failed to delete reference data');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      let tableName;
      let updateData;
      
      switch (activeCategory) {
        case 'status_options':
          tableName = 'impact_assessment_status_options';
          // Status options don't have is_active field, skip this functionality
          setError('Status options cannot be deactivated');
          return;
        case 'core_systems':
          tableName = 'impact_assessment_systems';
          updateData = { is_current: !item.is_current };
          break;
        case 'stakeholder_roles':
          tableName = 'impact_assessment_stakeholder_roles';
          // Stakeholder roles don't have is_active field, skip this functionality
          setError('Stakeholder roles cannot be deactivated');
          return;
        default:
          throw new Error('Invalid category');
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      setSuccessMessage(`Reference data ${item.is_current ? 'deactivated' : 'activated'} successfully`);
      await loadReferenceData();
    } catch (err) {
      console.error('Error toggling reference data:', err);
      setError(err.message || 'Failed to update reference data');
    }
  };

  const cancelEdit = () => {
    setNewItem({ code: '', name: '', description: '', sort_order: 0, color_code: '#6B7280' });
    setEditingItem(null);
  };

  const getCategoryDisplayName = (category) => {
    const names = {
      status_options: 'Status Options',
      core_systems: 'Core Systems',
      stakeholder_roles: 'Stakeholder Role Codes'
    };
    return names[category] || category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryDescription = (category) => {
    const descriptions = {
      status_options: 'Status tracking options for impact assessments (e.g., Review, In Progress, Complete)',
      core_systems: 'System references for As-Is and To-Be system mapping (e.g., ISCM, Manhattan, RMS)',
      stakeholder_roles: 'Stakeholder role abbreviations for RACI assignments (e.g., MAA, AM, Merch, DC)'
    };
    return descriptions[category] || '';
  };

  if (loading) {
    return (
      <div className="reference-data-loading">
        <div className="loading-spinner"></div>
        <p>Loading reference data...</p>
      </div>
    );
  }

  return (
    <div className="reference-data-setup">
      {/* Header */}
      <div className="setup-header">
        <h1>Reference Data Setup</h1>
        <p>Configure dropdown options for Impact Assessment forms - Status tracking, Core Systems, and Stakeholder Role Codes</p>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          <p>{successMessage}</p>
        </div>
      )}

      <div className="reference-data-content">
        {/* Category Selection */}
        <div className="category-selector">
          <h2>Reference Data Categories</h2>
          <div className="category-buttons">
            {Object.keys(referenceData).map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`category-btn ${activeCategory === category ? 'active' : ''}`}
              >
                {getCategoryDisplayName(category)}
                <span className="item-count">({referenceData[category].length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Category Management */}
        <div className="category-management">
          <div className="category-info">
            <h3>{getCategoryDisplayName(activeCategory)}</h3>
            <p>{getCategoryDescription(activeCategory)}</p>
          </div>

          {/* Add/Edit Form */}
          <div className="item-form">
            <h4>{editingItem ? 'Edit Item' : 'Add New Item'}</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="item-code">Code</label>
                <input
                  type="text"
                  id="item-code"
                  value={newItem.code}
                  onChange={(e) => setNewItem(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Enter code (auto-generated if empty)"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="item-name">Name *</label>
                <input
                  type="text"
                  id="item-name"
                  value={newItem.name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter item name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="item-description">Description</label>
                <input
                  type="text"
                  id="item-description"
                  value={newItem.description}
                  onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="sort-order">Sort Order</label>
                <input
                  type="number"
                  id="sort-order"
                  value={newItem.sort_order}
                  onChange={(e) => setNewItem(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  className="form-input"
                  min="0"
                />
              </div>

              {activeCategory === 'status_options' && (
                <div className="form-group">
                  <label htmlFor="color-code">Color</label>
                  <input
                    type="color"
                    id="color-code"
                    value={newItem.color_code}
                    onChange={(e) => setNewItem(prev => ({ ...prev, color_code: e.target.value }))}
                    className="form-input"
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              {editingItem && (
                <button onClick={cancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
              )}
              <button 
                onClick={handleSaveItem} 
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="items-list">
            <h4>Current Items ({referenceData[activeCategory].length})</h4>
            {referenceData[activeCategory].length === 0 ? (
              <div className="empty-list">
                <p>No items defined yet. Add items using the form above.</p>
              </div>
            ) : (
              <div className="items-table-container">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Sort Order</th>
                      {activeCategory === 'status_options' && <th>Color</th>}
                      {activeCategory === 'core_systems' && <th>Status</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceData[activeCategory].map(item => {
                      const itemCode = item.status_code || item.system_code || item.role_code || '';
                      const itemName = item.status_name || item.system_name || item.role_name || item.name || '';
                      const isActive = activeCategory === 'core_systems' ? item.is_current : true;
                      
                      return (
                        <tr key={item.id} className={!isActive ? 'inactive' : ''}>
                          <td className="item-code">{itemCode}</td>
                          <td className="item-name">{itemName}</td>
                          <td className="item-description">{item.description || 'No description'}</td>
                          <td className="item-sort">{item.sort_order}</td>
                          {activeCategory === 'status_options' && (
                            <td className="item-color">
                              <span 
                                className="color-swatch" 
                                style={{ backgroundColor: item.color_code }}
                                title={item.color_code}
                              ></span>
                            </td>
                          )}
                          {activeCategory === 'core_systems' && (
                            <td className="item-status">
                              <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                                {isActive ? 'Current' : 'Future'}
                              </span>
                            </td>
                          )}
                          <td className="item-actions">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="action-btn edit-btn"
                              title="Edit item"
                            >
                              ✏️
                            </button>
                            {activeCategory === 'core_systems' && (
                              <button
                                onClick={() => handleToggleActive(item)}
                                className={`action-btn toggle-btn ${isActive ? 'deactivate' : 'activate'}`}
                                title={isActive ? 'Mark as Future' : 'Mark as Current'}
                              >
                                {isActive ? '🔄' : '✅'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="action-btn delete-btn"
                              title="Delete item"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceDataSetup;