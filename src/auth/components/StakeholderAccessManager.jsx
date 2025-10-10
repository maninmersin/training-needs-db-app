import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './StakeholderAccessManager.css';

const StakeholderAccessManager = () => {
  const { currentProject, isLoading: projectLoading } = useProject();
  const [stakeholders, setStakeholders] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [trainingLocations, setTrainingLocations] = useState([]);
  const [userFunctionalAreas, setUserFunctionalAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');

  useEffect(() => {
    // Only fetch data when we have a current project and project loading is complete
    if (!projectLoading && currentProject) {
      fetchData();
    } else if (!projectLoading && !currentProject) {
      setLoading(false);
      setError('No project selected. Please select a project to manage stakeholder access.');
    }
  }, [currentProject, projectLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStakeholders(),
        fetchFunctionalAreas(),
        fetchTrainingLocations(),
        fetchUserFunctionalAreas()
      ]);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStakeholders = async () => {
    const { data, error } = await supabase
      .from('auth_users')
      .select(`
        *,
        auth_user_roles (
          role_id,
          auth_roles (id, name)
        )
      `)
      .order('email');

    if (error) throw error;
    
    // Filter to only show stakeholder assignment editor users
    const stakeholderUsers = data?.filter(user => 
      user.auth_user_roles?.some(ur => ur.auth_roles?.name === 'stakeholder_assignment_editor')
    ) || [];
    
    setStakeholders(stakeholderUsers);
  };

  const fetchFunctionalAreas = async () => {
    if (!currentProject) {
      setFunctionalAreas([]);
      return;
    }

    const { data, error } = await supabase
      .from('functional_areas')
      .select('*')
      .eq('active', true)
      .eq('project_id', currentProject.id)
      .order('display_order');

    if (error) throw error;
    setFunctionalAreas(data || []);
  };

  const fetchTrainingLocations = async () => {
    if (!currentProject) {
      setTrainingLocations([]);
      return;
    }

    const { data, error } = await supabase
      .from('training_locations')
      .select('*')
      .eq('active', true)
      .eq('project_id', currentProject.id)
      .order('name');

    if (error) throw error;
    setTrainingLocations(data || []);
  };

  const fetchUserFunctionalAreas = async () => {
    if (!currentProject) {
      setUserFunctionalAreas([]);
      return;
    }

    const { data, error } = await supabase
      .from('auth_user_functional_areas')
      .select(`
        *,
        functional_areas (id, name, description),
        training_locations (id, name, description)
      `)
      .eq('project_id', currentProject.id);

    if (error) {
      // Table might not exist yet, that's okay
      console.log('User functional areas table not found, will create when needed');
      setUserFunctionalAreas([]);
      return;
    }
    setUserFunctionalAreas(data || []);
  };

  const createUserFunctionalAreasTable = async () => {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS auth_user_functional_areas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        functional_area_id INTEGER NOT NULL REFERENCES functional_areas(id) ON DELETE CASCADE,
        access_level VARCHAR(20) DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, functional_area_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_functional_areas_user 
      ON auth_user_functional_areas(user_id);

      CREATE INDEX IF NOT EXISTS idx_user_functional_areas_area 
      ON auth_user_functional_areas(functional_area_id);
    `;

    try {
      const { error } = await supabase.rpc('execute_sql', { sql: createTableSQL });
      if (error) throw error;
      console.log('User functional areas table created successfully');
    } catch (err) {
      console.error('Error creating user functional areas table:', err);
      throw err;
    }
  };

  const handleAssignFunctionalArea = async (userId, functionalAreaId, accessLevel = 'read') => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      // Try to insert, if table doesn't exist, create it first
      let { error } = await supabase
        .from('auth_user_functional_areas')
        .insert({
          user_id: userId,
          functional_area_id: functionalAreaId,
          access_level: accessLevel,
          project_id: currentProject.id
        });

      if (error && error.code === '42P01') { // Table doesn't exist
        await createUserFunctionalAreasTable();
        
        // Retry the insert
        const { error: retryError } = await supabase
          .from('auth_user_functional_areas')
          .insert({
            user_id: userId,
            functional_area_id: functionalAreaId,
            access_level: accessLevel,
            project_id: currentProject.id
          });
        
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }

      await fetchUserFunctionalAreas();
    } catch (err) {
      if (err.code === '23505') { // Unique constraint violation
        setError('User already has access to this functional area');
      } else {
        setError(`Failed to assign functional area: ${err.message}`);
      }
    }
  };

  const handleAssignTrainingLocation = async (userId, trainingLocationId, accessLevel = 'read') => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      // First, try to insert
      let { data, error } = await supabase
        .from('auth_user_functional_areas')
        .insert({
          user_id: userId,
          training_location_id: trainingLocationId,
          access_level: accessLevel,
          project_id: currentProject.id
        });

      if (error && error.code === '42804') { // Type error, table might not exist
        await createUserFunctionalAreasTable();
        
        // Retry the insert
        const { data: retryData, error: retryError } = await supabase
          .from('auth_user_functional_areas')
          .insert({
            user_id: userId,
            training_location_id: trainingLocationId,
            access_level: accessLevel,
            project_id: currentProject.id
          });
        
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }

      await fetchUserFunctionalAreas();
    } catch (err) {
      if (err.code === '23505') { // Unique constraint violation
        setError('User already has access to this training location');
      } else {
        setError(`Failed to assign training location: ${err.message}`);
      }
    }
  };

  const handleRemoveFunctionalArea = async (userId, functionalAreaId) => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      const { error } = await supabase
        .from('auth_user_functional_areas')
        .delete()
        .eq('user_id', userId)
        .eq('functional_area_id', functionalAreaId)
        .eq('project_id', currentProject.id);

      if (error) throw error;
      await fetchUserFunctionalAreas();
    } catch (err) {
      setError(`Failed to remove functional area: ${err.message}`);
    }
  };

  const handleUpdateAccessLevel = async (userId, functionalAreaId, newAccessLevel) => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      const { error } = await supabase
        .from('auth_user_functional_areas')
        .update({ 
          access_level: newAccessLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('functional_area_id', functionalAreaId)
        .eq('project_id', currentProject.id);

      if (error) throw error;
      await fetchUserFunctionalAreas();
    } catch (err) {
      setError(`Failed to update access level: ${err.message}`);
    }
  };

  const handleUpdateLocationAccessLevel = async (userId, trainingLocationId, newAccessLevel) => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      const { error } = await supabase
        .from('auth_user_functional_areas')
        .update({ access_level: newAccessLevel })
        .eq('user_id', userId)
        .eq('training_location_id', trainingLocationId)
        .eq('project_id', currentProject.id);

      if (error) throw error;
      
      // Refresh data
      await fetchUserFunctionalAreas();
    } catch (err) {
      console.error('Error updating location access level:', err);
      setError(`Failed to update location access level: ${err.message}`);
    }
  };

  const handleRemoveTrainingLocation = async (userId, trainingLocationId) => {
    try {
      if (!currentProject) {
        setError('No project selected');
        return;
      }

      const { error } = await supabase
        .from('auth_user_functional_areas')
        .delete()
        .eq('user_id', userId)
        .eq('training_location_id', trainingLocationId)
        .eq('project_id', currentProject.id);

      if (error) throw error;
      
      // Refresh data
      await fetchUserFunctionalAreas();
    } catch (err) {
      console.error('Error removing training location:', err);
      setError(`Failed to remove training location: ${err.message}`);
    }
  };

  const getUserFunctionalAreas = (userId) => {
    return userFunctionalAreas.filter(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.functional_area_id !== null && 
      ufa.functional_area_id !== undefined
    );
  };

  const getUserTrainingLocations = (userId) => {
    return userFunctionalAreas.filter(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.training_location_id !== null && 
      ufa.training_location_id !== undefined
    );
  };

  const hasAccessToArea = (userId, functionalAreaId) => {
    return userFunctionalAreas.some(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.functional_area_id !== null && 
      String(ufa.functional_area_id) === String(functionalAreaId)
    );
  };

  const hasAccessToLocation = (userId, trainingLocationId) => {
    return userFunctionalAreas.some(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.training_location_id !== null && 
      String(ufa.training_location_id) === String(trainingLocationId)
    );
  };

  const getAccessLevel = (userId, functionalAreaId) => {
    const access = userFunctionalAreas.find(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.functional_area_id !== null && 
      String(ufa.functional_area_id) === String(functionalAreaId)
    );
    return access?.access_level || 'read';
  };

  const getLocationAccessLevel = (userId, trainingLocationId) => {
    const access = userFunctionalAreas.find(ufa => 
      String(ufa.user_id) === String(userId) && 
      ufa.training_location_id !== null && 
      String(ufa.training_location_id) === String(trainingLocationId)
    );
    return access?.access_level || 'read';
  };

  const filteredStakeholders = stakeholders.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = !filterArea || getUserFunctionalAreas(user.id).some(ufa => 
      ufa.functional_area_id.toString() === filterArea
    );
    return matchesSearch && matchesArea;
  });

  if (projectLoading) {
    return <div className="loading">Loading project context...</div>;
  }

  if (!currentProject) {
    return (
      <div className="stakeholder-access-manager">
        <div className="dashboard-header">
          <h1>Stakeholder Access Management</h1>
          <p>Select a project to manage stakeholder access</p>
        </div>
        <div className="error-message">
          No project selected. Please select a project to manage stakeholder access.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading stakeholder access management...</div>;
  }

  return (
    <div className="stakeholder-access-manager">
      <div className="dashboard-header">
        <h1>Stakeholder Access Management</h1>
        <p>Manage functional area access for stakeholder users</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search stakeholders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="area-filter"
          >
            <option value="">All Functional Areas</option>
            {functionalAreas.map(area => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stakeholders Table */}
      <div className="stakeholders-table-container">
        <table className="stakeholders-table">
          <thead>
            <tr>
              <th>Stakeholder</th>
              <th>Functional Areas</th>
              <th>Training Locations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStakeholders.map(stakeholder => (
              <tr key={stakeholder.id}>
                <td>
                  <div className="stakeholder-info">
                    <div className="email">{stakeholder.email}</div>
                    <div className="status">
                      <span className={`status ${stakeholder.is_verified ? 'verified' : 'unverified'}`}>
                        {stakeholder.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="functional-areas-list">
                    {getUserFunctionalAreas(stakeholder.id).map(ufa => (
                      <div key={ufa.functional_area_id} className="area-access">
                        <span className="area-name">
                          {ufa.functional_areas?.name || 'Unknown Area'}
                        </span>
                        <select
                          value={ufa.access_level}
                          onChange={(e) => handleUpdateAccessLevel(
                            stakeholder.id, 
                            ufa.functional_area_id, 
                            e.target.value
                          )}
                          className="access-level-select"
                        >
                          <option value="read">Read Only</option>
                          <option value="write">Read/Write</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveFunctionalArea(
                            stakeholder.id, 
                            ufa.functional_area_id
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {getUserFunctionalAreas(stakeholder.id).length === 0 && (
                      <span className="no-access">No functional area access</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="training-locations-list">
                    {getUserTrainingLocations(stakeholder.id).map(ufa => (
                      <div key={ufa.training_location_id} className="location-access">
                        <span className="location-name">
                          {ufa.training_locations?.name || 'Unknown Location'}
                        </span>
                        <select
                          value={ufa.access_level}
                          onChange={(e) => handleUpdateLocationAccessLevel(
                            stakeholder.id, 
                            ufa.training_location_id, 
                            e.target.value
                          )}
                          className="access-level-select"
                        >
                          <option value="read">Read Only</option>
                          <option value="write">Read/Write</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveTrainingLocation(
                            stakeholder.id, 
                            ufa.training_location_id
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {getUserTrainingLocations(stakeholder.id).length === 0 && (
                      <span className="no-access">No training location access</span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={async () => {
                      setSelectedStakeholder(stakeholder);
                      // Refresh user functional areas data when opening modal
                      await fetchUserFunctionalAreas();
                    }}
                  >
                    Manage Access
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manage Access Modal */}
      {selectedStakeholder && (
        <div className="modal-overlay" key={selectedStakeholder.id}>
          <div className="modal">
            <div className="modal-header">
              <h2>Manage Access for {selectedStakeholder.email}</h2>
              <button onClick={() => setSelectedStakeholder(null)}>×</button>
            </div>
            <div className="modal-body">
              <h3>Functional Areas</h3>
              <div className="functional-areas-grid">
                {functionalAreas.map(area => {
                  const hasAccess = hasAccessToArea(selectedStakeholder.id, area.id);
                  const accessLevel = getAccessLevel(selectedStakeholder.id, area.id);
                  
                  return (
                    <div key={area.id} className="area-control">
                      <div className="area-info">
                        <h4>{area.name}</h4>
                        {area.description && <p>{area.description}</p>}
                      </div>
                      <div className="area-controls">
                        {hasAccess ? (
                          <div className="access-controls">
                            <select
                              value={accessLevel}
                              onChange={(e) => handleUpdateAccessLevel(
                                selectedStakeholder.id, 
                                area.id, 
                                e.target.value
                              )}
                            >
                              <option value="read">Read Only</option>
                              <option value="write">Read/Write</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveFunctionalArea(
                                selectedStakeholder.id, 
                                area.id
                              )}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="grant-access">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignFunctionalArea(
                                    selectedStakeholder.id, 
                                    area.id, 
                                    e.target.value
                                  );
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="">Grant Access...</option>
                              <option value="read">Read Only</option>
                              <option value="write">Read/Write</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <h3>Training Locations</h3>
              <div className="training-locations-grid">
                {trainingLocations.map((location, index) => {
                  const hasAccess = hasAccessToLocation(selectedStakeholder.id, location.id);
                  
                  return (
                    <div key={location.id} className="location-item">
                      <div className="location-info">
                        <div className="location-name">{location.name}</div>
                        <div className="location-description">{location.description}</div>
                      </div>
                      <div className="access-controls">
                        {hasAccess ? (
                          <div className="current-access">
                            <select
                              value={getLocationAccessLevel(selectedStakeholder.id, location.id)}
                              onChange={(e) => handleUpdateLocationAccessLevel(
                                selectedStakeholder.id, 
                                location.id, 
                                e.target.value
                              )}
                            >
                              <option value="read">Read Only</option>
                              <option value="write">Read/Write</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveTrainingLocation(
                                selectedStakeholder.id, 
                                location.id
                              )}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="grant-access">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignTrainingLocation(
                                    selectedStakeholder.id, 
                                    location.id, 
                                    e.target.value
                                  );
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="">Grant Access...</option>
                              <option value="read">Read Only</option>
                              <option value="write">Read/Write</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedStakeholder(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakeholderAccessManager;