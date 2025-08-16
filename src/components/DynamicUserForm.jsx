 import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CSVLink } from 'react-csv';
import './DynamicUserForm.css';

const DynamicUserForm = () => {
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

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return columns.some(col => 
      String(user[col.column_name]).toLowerCase().includes(searchLower)
    );
  });

  // Fetch users from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('project_roles_tbl')
          .select('project_role_name');
        
        if (rolesError) throw rolesError;
        setRoles(rolesData.map((role, index) => ({
          id: index + 1,
          name: role.project_role_name
        })));

        // Fetch training locations from reference table
        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations_tbl')
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
        setColumns(schemaData);

        // Fetch users - use column info to build select query
        const columnNames = schemaData.map(col => col.column_name);
        const { data: usersData, error: usersError } = await supabase
          .from('end_users')
          .select(columnNames.join(','));
        
        if (usersError) throw usersError;
        setUsers(usersData);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
      const { data, error } = await supabase
        .from('end_users')
        .insert([newUser])
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
      <div className="loading-state">
        <h3>Loading users...</h3>
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

  return (
    <div className={`dynamic-user-form ${density}`}>
      <div className="users-form-header">
        <h2>End Users Management</h2>
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
      
      <div className="table-footer">
        Showing {filteredUsers.length} of {users.length} users
        {Object.keys(edits).length > 0 && (
          <span style={{marginLeft: '20px', color: '#007bff', fontWeight: '500'}}>
            • {Object.keys(edits).length} unsaved changes
          </span>
        )}
      </div>
      </div>
    </div>
  );
};

export default DynamicUserForm;
