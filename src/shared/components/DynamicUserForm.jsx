 import { useState, useEffect, useRef } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import { CSVLink } from 'react-csv';
import './DynamicUserForm.css';

// Excel-style dropdown filter component with checkboxes
const ExcelStyleFilter = ({ columnName, uniqueValues, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening
  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 200)
      });
    }
    setIsOpen(!isOpen);
  };

  // Filter values based on search term
  const filteredValues = uniqueValues.filter(value =>
    String(value || '').toLowerCase().includes(searchTerm.toLowerCase())
  );


  // Handle individual checkbox change
  const handleCheckboxChange = (value, checked) => {
    let newSelectedValues;
    if (checked) {
      newSelectedValues = [...selectedValues, value];
    } else {
      newSelectedValues = selectedValues.filter(v => v !== value);
    }
    onChange(newSelectedValues);
  };

  // Handle "Select All" functionality
  const handleSelectAll = (checked) => {
    if (checked) {
      // Select all filtered values plus special values and current selections
      const allValues = [...new Set([...selectedValues, '__BLANK__', '__NOT_BLANK__', ...filteredValues])];
      onChange(allValues);
    } else {
      // Deselect only the filtered values
      const newSelectedValues = selectedValues.filter(value => 
        !filteredValues.includes(value) && value !== '__BLANK__' && value !== '__NOT_BLANK__'
      );
      onChange(newSelectedValues);
    }
  };

  // Check if all visible items are selected
  const allVisibleSelected = filteredValues.length > 0 && 
    filteredValues.every(value => selectedValues.includes(value)) &&
    selectedValues.includes('__BLANK__') &&
    selectedValues.includes('__NOT_BLANK__');

  const selectedCount = selectedValues.length;
  const displayText = selectedCount === 0 ? 'All' : 
                     selectedCount === 1 ? selectedValues[0] === '__BLANK__' ? '(blank)' :
                                         selectedValues[0] === '__NOT_BLANK__' ? '(not blank)' :
                                         selectedValues[0] :
                     `${selectedCount} selected`;

  return (
    <div className="excel-filter-container" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`excel-filter-button ${selectedCount > 0 ? 'has-selection' : ''}`}
        onClick={handleToggleDropdown}
        title={selectedCount > 0 ? `${selectedCount} filter(s) applied` : 'Click to filter'}
      >
        <span className="filter-text">{displayText}</span>
        <span className="filter-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div 
          className="excel-filter-dropdown"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          <div className="filter-search">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-search-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="filter-options">
            <div className="filter-option select-all">
              <label>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                <span className="checkmark"></span>
                Select All
              </label>
            </div>
            
            <div className="filter-divider"></div>
            
            {/* Special options */}
            <div className="filter-option">
              <label>
                <input
                  type="checkbox"
                  checked={selectedValues.includes('__BLANK__')}
                  onChange={(e) => handleCheckboxChange('__BLANK__', e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="special-option">(blank)</span>
              </label>
            </div>
            
            <div className="filter-option">
              <label>
                <input
                  type="checkbox"
                  checked={selectedValues.includes('__NOT_BLANK__')}
                  onChange={(e) => handleCheckboxChange('__NOT_BLANK__', e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="special-option">(not blank)</span>
              </label>
            </div>
            
            {filteredValues.length > 0 && <div className="filter-divider"></div>}
            
            {/* Regular values */}
            <div className="filter-values-container">
              {filteredValues.length === 0 ? (
                <div className="filter-option">
                  <div style={{padding: '6px 12px', fontStyle: 'italic', color: '#6c757d'}}>
                    {uniqueValues.length === 0 ? 'Loading values...' : 'No values found'}
                  </div>
                </div>
              ) : (
                filteredValues.map(value => (
                  <div key={value} className="filter-option">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(value)}
                        onChange={(e) => handleCheckboxChange(value, e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      <span className="filter-value" title={value}>{value}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="filter-actions">
            <button
              type="button"
              className="filter-action-btn clear-btn"
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="filter-action-btn apply-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DynamicUserForm = () => {
  const { currentProject } = useProject();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [columns, setColumns] = useState([]);
  const [roles, setRoles] = useState([]);
  const [trainingLocations, setTrainingLocations] = useState([]);
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('tablesDensity') || 'normal';
  });
  const [userPermissions, setUserPermissions] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 50,
    totalUsers: 0,
    totalPages: 1
  });
  const [columnFilters, setColumnFilters] = useState({});
  const [uniqueValues, setUniqueValues] = useState({});

  // Filter users based on search term and column filters
  const filteredUsers = users.filter(user => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = columns.some(col => 
        String(user[col.column_name]).toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }

    // Column filters (now supporting multi-select)
    for (const [columnName, filterValues] of Object.entries(columnFilters)) {
      if (filterValues && filterValues.length > 0) {
        const userValue = String(user[columnName] || '');
        
        // Check if any of the selected filter values match
        const matchesAnyFilter = filterValues.some(filterValue => {
          // Handle special filter values
          if (filterValue === '__BLANK__') {
            // Filter for blank/empty values
            return userValue.trim() === '';
          } else if (filterValue === '__NOT_BLANK__') {
            // Filter for non-blank values
            return userValue.trim() !== '';
          } else {
            // Regular exact match filtering
            return userValue === filterValue;
          }
        });
        
        if (!matchesAnyFilter) {
          return false;
        }
      }
    }

    return true;
  });

  // Fetch users from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentProject) {
          setUsers([]);
          setLoading(false);
          return;
        }

        console.log('DynamicUserForm: Loading users for project:', currentProject.name);
        setLoading(true);
        
        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('project_roles')
          .select('project_role_name');
        
        if (rolesError) throw rolesError;
        setRoles(rolesData.map((role, index) => ({
          id: index + 1,
          name: role.project_role_name
        })));

        // Fetch training locations from reference table
        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations')
          .select('id, name')
          .eq('active', true)
          .order('display_order');
        
        if (locationsError) {
          console.warn('Reference table not available, using fallback');
          // Fallback: extract from existing users if reference table doesn't exist
          const { data: userData } = await supabase
            .from('end_users')
            .select('training_location');
          const uniqueLocations = [...new Set(userData?.map(u => u.training_location).filter(Boolean))];
          setTrainingLocations(uniqueLocations.map((loc, index) => ({ id: index + 1, name: loc })));
        } else {
          setTrainingLocations(locationsData || []);
        }

        // Fetch table schema
        const { data: schemaData, error: schemaError } = await supabase
          .rpc('get_table_columns', { table_name: 'end_users' });
        
        if (schemaError) throw schemaError;
        
        // Custom column ordering - move location_name after sub_division and exclude system columns
        const customOrder = [
          'id', 'name', 'email', 'job_title', 'country', 'division', 'sub_division', 'location_name', 
          'training_location', 'project_role'
        ];
        
        // Filter out system columns that shouldn't be displayed/edited
        const filteredColumns = schemaData.filter(col => 
          !['project_id', 'created_at', 'updated_at'].includes(col.column_name)
        );
        
        const orderedColumns = filteredColumns.sort((a, b) => {
          const indexA = customOrder.indexOf(a.column_name);
          const indexB = customOrder.indexOf(b.column_name);
          
          // If column not in custom order, put it at the end
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
        
        setColumns(orderedColumns);

        // Fetch users - use filtered query based on user permissions
        const columnNames = schemaData.map(col => col.column_name);
        
        // Get user permissions for editing
        const permissions = await SimpleAuthService.getUserPermissions('users');
        setUserPermissions(permissions);
        
        // Fetch ALL users for the current project (using increased Supabase limit of 5000)
        const { data: usersData, error: usersError, count } = await supabase
          .from('end_users')
          .select('*', { count: 'exact' })
          .eq('project_id', currentProject.id)
          .order('name');
        
        if (usersError) {
          throw usersError;
        }
        
        console.log('👥 Users loaded:', usersData?.length, 'of', count, 'total in database');
        
        
        setUsers(usersData || []);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject]);

  // Separate effect to fetch unique values when columns are loaded
  useEffect(() => {
    const fetchUniqueValues = async () => {
      if (columns.length > 0 && currentProject) {
        try {
          const { data: allUsersForFilters, error: filterError } = await supabase
            .from('end_users')
            .select('*')
            .eq('project_id', currentProject.id);

          if (filterError) {
            console.error('❌ Error fetching filter data:', filterError);
          } else if (allUsersForFilters && allUsersForFilters.length > 0) {
            const uniqueVals = {};
            columns.forEach(col => {
              const columnName = col.column_name;
              const values = [...new Set(
                allUsersForFilters
                  .map(user => user[columnName])
                  .filter(val => val !== null && val !== undefined && val !== '')
                  .map(val => String(val)) // Convert all values to strings
              )].sort();
              uniqueVals[columnName] = values;
            });
            setUniqueValues(uniqueVals);
          }
        } catch (error) {
          console.error('❌ Error fetching unique values for filters:', error);
        }
      }
    };

    fetchUniqueValues();
  }, [columns, currentProject]);

  // Handle user updates
  const handleUpdate = async (userId, updatedData) => {
    try {
      const { data, error } = await supabase
        .from('end_users')
        .update(updatedData)
        .eq('id', userId)
        .select();

      if (error) throw error;
      
      // Update local state with fresh data from database
      setUsers(users.map(user => 
        user.id === userId ? { ...user, ...data[0] } : user
      ));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle user deletion
  const handleDelete = async (userId) => {
    try {
      const { error } = await supabase
        .from('end_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(users.filter(user => user.id !== userId));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle new user creation
  const handleCreate = async (newUser) => {
    try {
      if (!currentProject) {
        setError('Please select a project first');
        return;
      }

      // Add project_id to the new user
      const userWithProject = {
        ...newUser,
        project_id: currentProject.id
      };

      const { data, error } = await supabase
        .from('end_users')
        .insert([userWithProject])
        .select();

      if (error) throw error;
      
      // Update local state
      setUsers([...users, data[0]]);
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle density change
  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('tablesDensity', newDensity);
  };

  if (loading) return (
    <div className="dynamic-user-form">
      <div className="users-form-header">
        <h2>👥 End Users Management</h2>
        <p className="users-form-description">View and edit end users for your project</p>
      </div>
      <div className="loading-state">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '20px' }}>⏳</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>Loading All Users...</h3>
          <p style={{ color: '#6c757d', fontSize: '14px' }}>
            {currentProject ? `Fetching users for project: ${currentProject.name}` : 'Preparing user data...'}
          </p>
        </div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="dynamic-user-form">
      <div className="error-state">
        <h3>Error loading users</h3>
        <p>{error}</p>
      </div>
    </div>
  );

  if (!currentProject) return (
    <div className="dynamic-user-form">
      <div className="no-project-state">
        <h3>No Project Selected</h3>
        <p>Please select a project from the Projects page to manage users.</p>
        <p>Each project has its own isolated set of users and data.</p>
      </div>
    </div>
  );

  return (
    <div className={`dynamic-user-form ${density}`}>
      <div className="users-form-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <h2>End Users Management</h2>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#2c3e50' }}>
              {filteredUsers.length} of {users.length} users
            </div>
            {Object.values(columnFilters).some(filter => filter && filter.length > 0) && (
              <div style={{ fontSize: '0.9rem', color: '#28a745', fontWeight: '500' }}>
                {Object.values(columnFilters).filter(filter => filter && filter.length > 0)
                    .reduce((total, filterArray) => total + filterArray.length, 0)} filter(s) active
              </div>
            )}
          </div>
        </div>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="users-form-description">
          Manage end users, their roles, and personal information. Use the search feature to find specific users.
        </p>
      </div>
      
      <div className="users-controls">
        <div className="search-save-container">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search users by any field..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="action-section">
            <div className="density-control">
              <label htmlFor="density-select-users">Density:</label>
              <select 
                id="density-select-users"
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
                const newId = prompt('Enter new user ID:');
                if (newId) {
                  // Create new user object with all table columns
                  const newUser = {
                    id: newId,
                    name: '',
                    email: '',
                    job_title: '',
                    country: '',
                    division: '',
                    sub_division: '',
                    location_name: '',
                    training_location: trainingLocations[0]?.name || '',
                    project_role: ''
                  };
                  handleCreate(newUser);
                }
              }}
              className="save-all-btn"
              style={{ background: '#007bff' }}
            >
              Add New User
            </button>
            <button 
              onClick={async () => {
                try {
                  // Execute all updates in parallel
                  await Promise.all(
                    Object.entries(edits).map(([userId, updatedData]) => 
                      handleUpdate(userId, updatedData)
                    )
                  );
                  
                  // Clear edits after successful save
                  setEdits({});
                  
                  // Refresh data from database
                  const { data: usersData, error } = await supabase
                    .from('end_users')
                    .select('*');
                  
                  if (error) throw error;
                  setUsers(usersData);
                } catch (error) {
                  setError(error.message);
                }
              }}
              disabled={Object.keys(edits).length === 0}
              className="save-all-btn"
            >
              Save All Changes {Object.keys(edits).length > 0 && `(${Object.keys(edits).length})`}
            </button>
          </div>
        </div>
      </div>
      
      <div className="users-table-container">
        <table>
        <thead className="table-header">
          <tr>
            {columns.map(col => (
              <th key={col.column_name} style={{width: col.column_name === 'id' ? '10%' : 'auto'}}>
                {col.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </th>
            ))}
            <th style={{width: '120px'}}>Actions</th>
          </tr>
          <tr className="filter-row">
            {columns.map(col => (
              <th key={`filter-${col.column_name}`} className="filter-cell">
                <ExcelStyleFilter
                  columnName={col.column_name}
                  uniqueValues={uniqueValues[col.column_name] || []}
                  selectedValues={columnFilters[col.column_name] || []}
                  onChange={(selectedValues) => {
                    setColumnFilters(prev => ({
                      ...prev,
                      [col.column_name]: selectedValues
                    }));
                    // Reset to first page when applying filters
                    setPagination(prev => ({ ...prev, currentPage: 1 }));
                  }}
                />
              </th>
            ))}
            <th className="filter-cell">
              <button
                onClick={() => {
                  setColumnFilters({});
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                }}
                className="clear-filters-btn"
                title="Clear all filters"
              >
                Clear
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map(user => (
            <tr key={user.id}>
              {columns.map(col => (
                <td key={col.column_name}>
                  {col.column_name === 'role' || col.column_name === 'project_role' ? (
                    <select
                      value={edits[user.id]?.[col.column_name] ?? user[col.column_name]}
                      onChange={e => setEdits(prev => ({
                        ...prev,
                        [user.id]: {
                          ...prev[user.id],
                          [col.column_name]: e.target.value
                        }
                      }))}
                    >
                      <option value="">Select a role</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  ) : col.column_name === 'training_location' ? (
                    <select
                      value={edits[user.id]?.[col.column_name] ?? user[col.column_name]}
                      onChange={e => setEdits(prev => ({
                        ...prev,
                        [user.id]: {
                          ...prev[user.id],
                          [col.column_name]: e.target.value
                        }
                      }))}
                    >
                      <option value="">Select a location</option>
                      {trainingLocations.map(location => (
                        <option key={location.id} value={location.name}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={col.data_type === 'integer' ? 'number' : 'text'}
                      value={edits[user.id]?.[col.column_name] ?? user[col.column_name]}
                      onChange={e => setEdits(prev => ({
                        ...prev,
                        [user.id]: {
                          ...prev[user.id],
                          [col.column_name]: col.data_type === 'integer' ? 
                            parseInt(e.target.value) : e.target.value
                        }
                      }))}
                    />
                  )}
                </td>
              ))}
              <td>
                <button 
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete user ${user.name || user.id}?`)) {
                      handleDelete(user.id);
                    }
                  }}
                  className="delete-btn"
                  title="Delete user"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {Object.keys(edits).length > 0 && (
        <div className="table-footer">
          <div className="table-info">
            <span style={{color: '#007bff', fontWeight: '500'}}>
              💾 {Object.keys(edits).length} unsaved changes
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DynamicUserForm;
