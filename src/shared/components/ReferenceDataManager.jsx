import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './ReferenceDataManager.css';

const ReferenceDataManager = () => {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('project_roles');
  const [data, setData] = useState({
    project_roles: [],
    functional_areas: [],
    training_locations: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [searchTerms, setSearchTerms] = useState({
    project_roles: '',
    functional_areas: '',
    training_locations: ''
  });
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('tablesDensity') || 'normal';
  });

  // Tab configuration
  const tabs = {
    project_roles: {
      title: 'Project Roles',
      table: 'project_roles',
      displayField: 'project_role_name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '10%', readonly: true },
        { key: 'project_role_name', label: 'Role Name', type: 'text', width: '60%' },
        { key: 'created_at', label: 'Created', type: 'datetime', width: '20%', readonly: true }
      ]
    },
    functional_areas: {
      title: 'Functional Areas',
      table: 'functional_areas',
      displayField: 'name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '8%', readonly: true },
        { key: 'name', label: 'Name', type: 'text', width: '25%' },
        { key: 'description', label: 'Description', type: 'text', width: '35%' },
        { key: 'display_order', label: 'Order', type: 'number', width: '10%' },
        { key: 'active', label: 'Active', type: 'boolean', width: '10%' },
        { key: 'created_at', label: 'Created', type: 'datetime', width: '12%', readonly: true }
      ]
    },
    training_locations: {
      title: 'Training Locations',
      table: 'training_locations',
      displayField: 'name',
      columns: [
        { key: 'id', label: 'ID', type: 'number', width: '6%', readonly: true },
        { key: 'name', label: 'Name', type: 'text', width: '20%' },
        { key: 'description', label: 'Description', type: 'text', width: '25%' },
        { key: 'capacity', label: 'Capacity', type: 'number', width: '8%' },
        { key: 'classrooms_count', label: 'Classrooms', type: 'number', width: '8%' },
        { key: 'display_order', label: 'Order', type: 'number', width: '8%' },
        { key: 'active', label: 'Active', type: 'boolean', width: '8%' },
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

  // Fetch data for all reference tables
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        if (!currentProject) {
          setData({
            project_roles: [],
            functional_areas: [],
            training_locations: []
          });
          setLoading(false);
          return;
        }

        setLoading(true);
        
        // Fetch project roles (filtered by project_id)
        const { data: rolesData, error: rolesError } = await supabase
          .from('project_roles')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('project_role_name');
        
        if (rolesError) throw rolesError;

        // Fetch functional areas (filtered by project_id)
        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        
        if (areasError && !areasError.message.includes('does not exist')) {
          throw areasError;
        }

        // Fetch training locations (filtered by project_id)
        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        
        if (locationsError && !locationsError.message.includes('does not exist')) {
          throw locationsError;
        }

        setData({
          project_roles: rolesData || [],
          functional_areas: areasData || [],
          training_locations: locationsData || []
        });
        
      } catch (error) {
        setError(error.message);
        console.error('Error fetching reference data:', error);
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
      
      // Add project_id for functional_areas, training_locations, and project_roles
      if (tabKey === 'functional_areas' || tabKey === 'training_locations' || tabKey === 'project_roles') {
        newItem = { ...newItem, project_id: currentProject.id };
      }
      
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
        <p>Each project has its own isolated set of functional areas and training locations.</p>
      </div>
    </div>
  );

  const currentTab = tabs[activeTab];
  const filteredData = getFilteredData(activeTab);

  return (
    <div className={`reference-data-manager ${density}`}>
      <div className="reference-header">
        <h2>Reference Data Management</h2>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="reference-description">
          Manage project roles, functional areas, and training locations to ensure consistent data entry across the application.
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
                  <td key={col.key}>
                    {renderInput(activeTab, item, col)}
                  </td>
                ))}
                <td>
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

export default ReferenceDataManager;