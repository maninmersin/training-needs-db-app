import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './StakeholderReferenceDataManager.css';

const StakeholderReferenceDataManager = () => {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('stakeholder_types');
  const [data, setData] = useState({
    stakeholder_types: [],
    stakeholder_categories: [],
    stakeholder_priorities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [searchTerms, setSearchTerms] = useState({
    stakeholder_types: '',
    stakeholder_categories: '',
    stakeholder_priorities: ''
  });
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('tablesDensity') || 'normal';
  });

  // Tab configuration
  const tabs = {
    stakeholder_types: {
      title: 'Stakeholder Types',
      table: 'stakeholder_types',
      displayField: 'type_name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '8%', readonly: true },
        { key: 'type_name', label: 'Type Name', type: 'text', width: '25%' },
        { key: 'description', label: 'Description', type: 'text', width: '35%' },
        { key: 'display_order', label: 'Order', type: 'number', width: '10%' },
        { key: 'active', label: 'Active', type: 'boolean', width: '10%' },
        { key: 'created_at', label: 'Created', type: 'datetime', width: '12%', readonly: true }
      ]
    },
    stakeholder_categories: {
      title: 'Stakeholder Categories',
      table: 'stakeholder_categories',
      displayField: 'category_name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '8%', readonly: true },
        { key: 'category_name', label: 'Category Name', type: 'text', width: '25%' },
        { key: 'description', label: 'Description', type: 'text', width: '35%' },
        { key: 'display_order', label: 'Order', type: 'number', width: '10%' },
        { key: 'active', label: 'Active', type: 'boolean', width: '10%' },
        { key: 'created_at', label: 'Created', type: 'datetime', width: '12%', readonly: true }
      ]
    },
    stakeholder_priorities: {
      title: 'Stakeholder Priorities',
      table: 'stakeholder_priorities',
      displayField: 'priority_name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '8%', readonly: true },
        { key: 'priority_name', label: 'Priority Name', type: 'text', width: '25%' },
        { key: 'description', label: 'Description', type: 'text', width: '35%' },
        { key: 'display_order', label: 'Order', type: 'number', width: '10%' },
        { key: 'active', label: 'Active', type: 'boolean', width: '10%' },
        { key: 'created_at', label: 'Created', type: 'datetime', width: '12%', readonly: true }
      ]
    }
  };

  // Filter data based on search term
  const getFilteredData = (tabKey) => {
    const tabData = data[tabKey] || [];
    const searchTerm = searchTerms[tabKey].toLowerCase();
    
    if (!searchTerm) return tabData;
    
    return tabData.filter(item => {
      return tabs[tabKey].columns.some(col => {
        const value = item[col.key];
        if (value === null || value === undefined) return false;
        return value.toString().toLowerCase().includes(searchTerm);
      });
    });
  };

  // Initialize default data for a project
  const initializeDefaultData = async () => {
    if (!currentProject?.id) return;
    
    try {
      // Call the database function to insert all defaults
      const { error } = await supabase
        .rpc('insert_all_default_stakeholder_reference_data', {
          p_project_id: currentProject.id
        });
        
      if (error) {
        console.error('Error initializing defaults:', error);
        // If RPC fails, fall back to manual insertion
        await insertDefaultsManually();
      }
    } catch (error) {
      console.error('Error with RPC, trying manual insertion:', error);
      await insertDefaultsManually();
    }
  };

  // Fallback manual insertion if RPC is not available
  const insertDefaultsManually = async () => {
    try {
      // Insert default types
      const defaultTypes = [
        { type_name: 'Executive', description: 'Executive leadership level', display_order: 1 },
        { type_name: 'Senior Manager', description: 'Senior management level', display_order: 2 },
        { type_name: 'Manager', description: 'Management level', display_order: 3 },
        { type_name: 'Supervisor', description: 'Supervisory level', display_order: 4 },
        { type_name: 'Key User', description: 'Key system user or power user', display_order: 5 },
        { type_name: 'Subject Matter Expert', description: 'Domain expert or technical specialist', display_order: 6 },
        { type_name: 'Union Representative', description: 'Union or staff representative', display_order: 7 },
        { type_name: 'External Partner', description: 'External partner organization', display_order: 8 },
        { type_name: 'Vendor', description: 'Vendor or supplier', display_order: 9 },
        { type_name: 'Customer', description: 'Customer or client', display_order: 10 },
        { type_name: 'General', description: 'General stakeholder', display_order: 11 }
      ].map(item => ({ ...item, project_id: currentProject.id, active: true }));

      const defaultCategories = [
        { category_name: 'Internal', description: 'Internal to organization - employees, departments, teams', display_order: 1 },
        { category_name: 'External', description: 'External to organization - customers, suppliers, partners', display_order: 2 }
      ].map(item => ({ ...item, project_id: currentProject.id, active: true }));

      const defaultPriorities = [
        { priority_name: 'Primary', description: 'Primary stakeholder - high importance and direct impact', display_order: 1 },
        { priority_name: 'Secondary', description: 'Secondary stakeholder - moderate importance and indirect impact', display_order: 2 }
      ].map(item => ({ ...item, project_id: currentProject.id, active: true }));

      // Insert all defaults (ignoring conflicts if they already exist)
      await Promise.all([
        supabase.from('stakeholder_types').upsert(defaultTypes, { onConflict: 'project_id,type_name', ignoreDuplicates: true }),
        supabase.from('stakeholder_categories').upsert(defaultCategories, { onConflict: 'project_id,category_name', ignoreDuplicates: true }),
        supabase.from('stakeholder_priorities').upsert(defaultPriorities, { onConflict: 'project_id,priority_name', ignoreDuplicates: true })
      ]);
    } catch (error) {
      console.error('Error inserting defaults manually:', error);
    }
  };

  // Fetch data for all reference tables
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        if (!currentProject) {
          setData({
            stakeholder_types: [],
            stakeholder_categories: [],
            stakeholder_priorities: []
          });
          setLoading(false);
          return;
        }

        setLoading(true);
        
        // Fetch stakeholder types (filtered by project_id)
        const { data: typesData, error: typesError } = await supabase
          .from('stakeholder_types')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        
        if (typesError && !typesError.message.includes('does not exist')) {
          throw typesError;
        }

        // Fetch stakeholder categories (filtered by project_id)
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('stakeholder_categories')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        
        if (categoriesError && !categoriesError.message.includes('does not exist')) {
          throw categoriesError;
        }

        // Fetch stakeholder priorities (filtered by project_id)
        const { data: prioritiesData, error: prioritiesError } = await supabase
          .from('stakeholder_priorities')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        
        if (prioritiesError && !prioritiesError.message.includes('does not exist')) {
          throw prioritiesError;
        }

        // If any table is empty, initialize defaults
        if (!typesData?.length || !categoriesData?.length || !prioritiesData?.length) {
          await initializeDefaultData();
          // Refetch after initialization
          return fetchAllData();
        }

        setData({
          stakeholder_types: typesData || [],
          stakeholder_categories: categoriesData || [],
          stakeholder_priorities: prioritiesData || []
        });
        
      } catch (error) {
        setError(error.message);
        console.error('Error fetching stakeholder reference data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [currentProject]);

  // Handle updates
  const handleUpdate = async (tabKey, itemId, updatedData) => {
    try {
      const table = tabs[tabKey].table;
      const { error } = await supabase
        .from(table)
        .update(updatedData)
        .eq('id', itemId);

      if (error) throw error;
      
      // Update local state
      setData(prev => ({
        ...prev,
        [tabKey]: prev[tabKey].map(item => 
          item.id === itemId ? { ...item, ...updatedData } : item
        )
      }));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle deletion
  const handleDelete = async (tabKey, itemId) => {
    try {
      const table = tabs[tabKey].table;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      // Update local state
      setData(prev => ({
        ...prev,
        [tabKey]: prev[tabKey].filter(item => item.id !== itemId)
      }));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle creation
  const handleCreate = async (tabKey, newItem) => {
    try {
      if (!currentProject) {
        setError('Please select a project first');
        return;
      }

      const table = tabs[tabKey].table;
      
      // Add project_id for stakeholder reference tables
      newItem = { ...newItem, project_id: currentProject.id };
      
      const { data: newData, error } = await supabase
        .from(table)
        .insert([newItem])
        .select();

      if (error) throw error;
      
      // Update local state
      setData(prev => ({
        ...prev,
        [tabKey]: [...prev[tabKey], newData[0]]
      }));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle density change
  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('tablesDensity', newDensity);
  };

  // Render input field based on column type
  const renderInput = (tabKey, item, column) => {
    if (column.readonly) {
      let displayValue = item[column.key];
      if (column.type === 'datetime' && displayValue) {
        displayValue = new Date(displayValue).toLocaleDateString('en-GB');
      }
      return <span className="readonly-field">{displayValue}</span>;
    }

    const currentValue = edits[`${tabKey}-${item.id}`]?.[column.key] ?? item[column.key];

    switch (column.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={currentValue || false}
            onChange={e => setEdits(prev => ({
              ...prev,
              [`${tabKey}-${item.id}`]: {
                ...prev[`${tabKey}-${item.id}`],
                [column.key]: e.target.checked
              }
            }))}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={currentValue || ''}
            onChange={e => setEdits(prev => ({
              ...prev,
              [`${tabKey}-${item.id}`]: {
                ...prev[`${tabKey}-${item.id}`],
                [column.key]: parseInt(e.target.value) || null
              }
            }))}
          />
        );
      default:
        return (
          <input
            type="text"
            value={currentValue || ''}
            onChange={e => setEdits(prev => ({
              ...prev,
              [`${tabKey}-${item.id}`]: {
                ...prev[`${tabKey}-${item.id}`],
                [column.key]: e.target.value
              }
            }))}
          />
        );
    }
  };

  if (loading) return (
    <div className="reference-data-manager">
      <div className="loading-state">
        <h3>Loading reference data...</h3>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="reference-data-manager">
      <div className="error-state">
        <h3>Error loading reference data</h3>
        <p>{error}</p>
      </div>
    </div>
  );

  if (!currentProject) return (
    <div className="reference-data-manager">
      <div className="no-project-state">
        <h3>No Project Selected</h3>
        <p>Please select a project from the Projects page to manage reference data.</p>
        <p>Each project has its own isolated set of stakeholder types, categories, and priorities.</p>
      </div>
    </div>
  );

  const currentTab = tabs[activeTab];
  const filteredData = getFilteredData(activeTab);

  return (
    <div className={`reference-data-manager ${density}`}>
      <div className="reference-header">
        <h2>Stakeholder Reference Data Management</h2>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="reference-description">
          Manage stakeholder types, categories, and priorities to ensure consistent data entry across the application.
          Position on Change, RAG Status, Power/Interest Levels, and Engagement Levels are system constants.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {Object.entries(tabs).map(([key, tab]) => (
          <button
            key={key}
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {tab.title} ({data[key].length})
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="reference-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder={`Search ${currentTab.title.toLowerCase()}...`}
            value={searchTerms[activeTab]}
            onChange={e => setSearchTerms(prev => ({
              ...prev,
              [activeTab]: e.target.value
            }))}
            className="search-input"
          />
        </div>
        <div className="action-section">
          <div className="density-control">
            <label htmlFor="density-select">Density:</label>
            <select 
              id="density-select"
              className="density-select"
              value={density}
              onChange={(e) => handleDensityChange(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="compact">Compact</option>
              <option value="dense">Dense</option>
            </select>
          </div>
          <button 
            onClick={() => {
              const newItem = {};
              currentTab.columns.forEach(col => {
                if (!col.readonly) {
                  switch (col.type) {
                    case 'boolean':
                      newItem[col.key] = true;
                      break;
                    case 'number':
                      newItem[col.key] = col.key === 'display_order' ? 999 : 1;
                      break;
                    default:
                      newItem[col.key] = '';
                  }
                }
              });
              handleCreate(activeTab, newItem);
            }}
            className="add-item-btn"
          >
            Add New {currentTab.title.slice(0, -1)}
          </button>
          <button 
            onClick={async () => {
              try {
                await Promise.all(
                  Object.entries(edits).map(([key, changes]) => {
                    const [tabKey, itemId] = key.split('-');
                    if (tabKey === activeTab) {
                      return handleUpdate(tabKey, parseInt(itemId), changes);
                    }
                  }).filter(Boolean)
                );
                setEdits({});
              } catch (error) {
                setError(error.message);
              }
            }}
            disabled={!Object.keys(edits).some(key => key.startsWith(activeTab))}
            className="save-all-btn"
          >
            Save All Changes
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="reference-table-container">
        <table>
          <thead className="table-header">
            <tr>
              {currentTab.columns.map(col => (
                <th key={col.key} style={{width: col.width}}>
                  {col.label}
                </th>
              ))}
              <th style={{width: '10%'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => (
              <tr key={item.id}>
                {currentTab.columns.map(col => (
                  <td key={col.key} style={{width: col.width}}>
                    {renderInput(activeTab, item, col)}
                  </td>
                ))}
                <td style={{width: '10%'}}>
                  <button 
                    onClick={() => {
                      const displayValue = item[currentTab.displayField] || item.id;
                      if (window.confirm(`Are you sure you want to delete "${displayValue}"?`)) {
                        handleDelete(activeTab, item.id);
                      }
                    }}
                    className="delete-btn"
                    title="Delete item"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="table-footer">
          Showing {filteredData.length} of {data[activeTab].length} {currentTab.title.toLowerCase()}
          {Object.keys(edits).filter(key => key.startsWith(activeTab)).length > 0 && (
            <span style={{marginLeft: '20px', color: '#007bff', fontWeight: '500'}}>
              • {Object.keys(edits).filter(key => key.startsWith(activeTab)).length} unsaved changes
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StakeholderReferenceDataManager;