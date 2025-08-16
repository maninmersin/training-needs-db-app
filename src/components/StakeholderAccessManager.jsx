import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './StakeholderAccessManager.css';

const StakeholderAccessManager = () => {
  const [stakeholders, setStakeholders] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [userFunctionalAreas, setUserFunctionalAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStakeholders(),
        fetchFunctionalAreas(),
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
      .from('a_users')
      .select(`
        *,
        a_user_roles (
          role_id,
          a_roles (id, name)
        )
      `)
      .order('email');

    if (error) throw error;
    
    // Filter to only show stakeholder users (non-admin roles)
    const stakeholderUsers = data?.filter(user => 
      user.a_user_roles?.some(ur => ur.a_roles?.name?.toLowerCase() === 'stakeholder')
    ) || [];
    
    setStakeholders(stakeholderUsers);
  };

  const fetchFunctionalAreas = async () => {
    const { data, error } = await supabase
      .from('functional_areas_tbl')
      .select('*')
      .eq('active', true)
      .order('display_order');

    if (error) throw error;
    setFunctionalAreas(data || []);
  };

  const fetchUserFunctionalAreas = async () => {
    const { data, error } = await supabase
      .from('a_user_functional_areas')
      .select(`
        *,
        functional_areas_tbl (id, name, description)
      `);

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
      CREATE TABLE IF NOT EXISTS a_user_functional_areas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES a_users(id) ON DELETE CASCADE,
        functional_area_id INTEGER NOT NULL REFERENCES functional_areas_tbl(id) ON DELETE CASCADE,
        access_level VARCHAR(20) DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, functional_area_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_functional_areas_user 
      ON a_user_functional_areas(user_id);

      CREATE INDEX IF NOT EXISTS idx_user_functional_areas_area 
      ON a_user_functional_areas(functional_area_id);
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
      // Try to insert, if table doesn't exist, create it first
      let { error } = await supabase
        .from('a_user_functional_areas')
        .insert({
          user_id: userId,
          functional_area_id: functionalAreaId,
          access_level: accessLevel
        });

      if (error && error.code === '42P01') { // Table doesn't exist
        await createUserFunctionalAreasTable();
        
        // Retry the insert
        const { error: retryError } = await supabase
          .from('a_user_functional_areas')
          .insert({
            user_id: userId,
            functional_area_id: functionalAreaId,
            access_level: accessLevel
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

  const handleRemoveFunctionalArea = async (userId, functionalAreaId) => {
    try {
      const { error } = await supabase
        .from('a_user_functional_areas')
        .delete()
        .eq('user_id', userId)
        .eq('functional_area_id', functionalAreaId);

      if (error) throw error;
      await fetchUserFunctionalAreas();
    } catch (err) {
      setError(`Failed to remove functional area: ${err.message}`);
    }
  };

  const handleUpdateAccessLevel = async (userId, functionalAreaId, newAccessLevel) => {
    try {
      const { error } = await supabase
        .from('a_user_functional_areas')
        .update({ 
          access_level: newAccessLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('functional_area_id', functionalAreaId);

      if (error) throw error;
      await fetchUserFunctionalAreas();
    } catch (err) {
      setError(`Failed to update access level: ${err.message}`);
    }
  };

  const getUserFunctionalAreas = (userId) => {
    return userFunctionalAreas.filter(ufa => ufa.user_id === userId);
  };

  const hasAccessToArea = (userId, functionalAreaId) => {
    return userFunctionalAreas.some(ufa => 
      ufa.user_id === userId && ufa.functional_area_id === functionalAreaId
    );
  };

  const getAccessLevel = (userId, functionalAreaId) => {
    const access = userFunctionalAreas.find(ufa => 
      ufa.user_id === userId && ufa.functional_area_id === functionalAreaId
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
                          {ufa.functional_areas_tbl?.name || 'Unknown Area'}
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
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setSelectedStakeholder(stakeholder)}
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
        <div className="modal-overlay">
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