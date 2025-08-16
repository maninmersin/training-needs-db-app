import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './RolePermissionsEditor.css';

const RolePermissionsEditor = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showCreatePermissionModal, setShowCreatePermissionModal] = useState(false);

  // Form states
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [newPermission, setNewPermission] = useState({ 
    name: '', 
    description: '', 
    resource: '', 
    action: '' 
  });

  // Default permissions for the application
  const defaultPermissions = [
    { resource: 'users', action: 'create', description: 'Create new users' },
    { resource: 'users', action: 'read', description: 'View user information' },
    { resource: 'users', action: 'update', description: 'Update user information' },
    { resource: 'users', action: 'delete', description: 'Delete users' },
    { resource: 'roles', action: 'create', description: 'Create new roles' },
    { resource: 'roles', action: 'read', description: 'View roles' },
    { resource: 'roles', action: 'update', description: 'Update roles' },
    { resource: 'roles', action: 'delete', description: 'Delete roles' },
    { resource: 'schedules', action: 'create', description: 'Create training schedules' },
    { resource: 'schedules', action: 'read', description: 'View training schedules' },
    { resource: 'schedules', action: 'update', description: 'Update training schedules' },
    { resource: 'schedules', action: 'delete', description: 'Delete training schedules' },
    { resource: 'courses', action: 'create', description: 'Create courses' },
    { resource: 'courses', action: 'read', description: 'View courses' },
    { resource: 'courses', action: 'update', description: 'Update courses' },
    { resource: 'courses', action: 'delete', description: 'Delete courses' },
    { resource: 'reports', action: 'read', description: 'View reports' },
    { resource: 'reports', action: 'export', description: 'Export reports' },
    { resource: 'assignments', action: 'create', description: 'Create user assignments' },
    { resource: 'assignments', action: 'read', description: 'View user assignments' },
    { resource: 'assignments', action: 'update', description: 'Update user assignments' },
    { resource: 'assignments', action: 'delete', description: 'Delete user assignments' },
    { resource: 'reference_data', action: 'read', description: 'View reference data' },
    { resource: 'reference_data', action: 'update', description: 'Update reference data' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchRolePermissions()
      ]);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPermissionsTable = async () => {
    const createTablesSQL = `
      -- Create permissions table
      CREATE TABLE IF NOT EXISTS a_permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        resource VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(resource, action)
      );

      -- Create role_permissions junction table
      CREATE TABLE IF NOT EXISTS a_role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES a_roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES a_permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(role_id, permission_id)
      );

      CREATE INDEX IF NOT EXISTS idx_role_permissions_role 
      ON a_role_permissions(role_id);

      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission 
      ON a_role_permissions(permission_id);
    `;

    try {
      const { error } = await supabase.rpc('execute_sql', { sql: createTablesSQL });
      if (error) throw error;
      console.log('Permissions tables created successfully');
    } catch (err) {
      console.error('Error creating permissions tables:', err);
      throw err;
    }
  };

  const initializeDefaultPermissions = async () => {
    try {
      await createPermissionsTable();
      
      for (const perm of defaultPermissions) {
        const permissionName = `${perm.resource}:${perm.action}`;
        
        const { error } = await supabase
          .from('a_permissions')
          .upsert({
            name: permissionName,
            description: perm.description,
            resource: perm.resource,
            action: perm.action
          }, { 
            onConflict: 'name',
            ignoreDuplicates: true 
          });

        if (error && error.code !== '23505') { // Ignore unique constraint violations
          console.warn(`Failed to create permission ${permissionName}:`, error);
        }
      }
      
      await fetchPermissions();
    } catch (err) {
      console.error('Error initializing default permissions:', err);
      throw err;
    }
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('a_roles')
      .select('*')
      .order('name');

    if (error) throw error;
    setRoles(data || []);
  };

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from('a_permissions')
      .select('*')
      .order('resource', { ascending: true })
      .order('action', { ascending: true });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        console.log('Permissions table not found, will initialize');
        setPermissions([]);
        return;
      }
      throw error;
    }
    setPermissions(data || []);
  };

  const fetchRolePermissions = async () => {
    const { data, error } = await supabase
      .from('a_role_permissions')
      .select(`
        *,
        a_permissions (id, name, description, resource, action)
      `);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        console.log('Role permissions table not found, will initialize');
        setRolePermissions([]);
        return;
      }
      throw error;
    }
    setRolePermissions(data || []);
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('a_roles')
        .insert(newRole);

      if (error) throw error;

      setNewRole({ name: '', description: '' });
      setShowCreateRoleModal(false);
      await fetchRoles();
    } catch (err) {
      setError(`Failed to create role: ${err.message}`);
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    try {
      if (permissions.length === 0) {
        await initializeDefaultPermissions();
      }

      const permissionName = `${newPermission.resource}:${newPermission.action}`;
      
      const { error } = await supabase
        .from('a_permissions')
        .insert({
          name: permissionName,
          description: newPermission.description,
          resource: newPermission.resource,
          action: newPermission.action
        });

      if (error) throw error;

      setNewPermission({ name: '', description: '', resource: '', action: '' });
      setShowCreatePermissionModal(false);
      await fetchPermissions();
    } catch (err) {
      setError(`Failed to create permission: ${err.message}`);
    }
  };

  const handleTogglePermission = async (roleId, permissionId, hasPermission) => {
    try {
      if (rolePermissions.length === 0 && permissions.length === 0) {
        await initializeDefaultPermissions();
        await fetchRolePermissions();
      }

      if (hasPermission) {
        // Remove permission
        const { error } = await supabase
          .from('a_role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_id', permissionId);

        if (error) throw error;
      } else {
        // Add permission
        const { error } = await supabase
          .from('a_role_permissions')
          .insert({
            role_id: roleId,
            permission_id: permissionId
          });

        if (error) throw error;
      }

      await fetchRolePermissions();
    } catch (err) {
      setError(`Failed to update permission: ${err.message}`);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role? This will remove all permissions and user assignments.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('a_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      await fetchRoles();
    } catch (err) {
      setError(`Failed to delete role: ${err.message}`);
    }
  };

  const getRolePermissions = (roleId) => {
    return rolePermissions.filter(rp => rp.role_id === roleId);
  };

  const hasPermission = (roleId, permissionId) => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading">Loading role permissions editor...</div>;
  }

  return (
    <div className="role-permissions-editor">
      <div className="dashboard-header">
        <h1>Role & Permissions Management</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowCreatePermissionModal(true)}
          >
            Create Permission
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateRoleModal(true)}
          >
            Create Role
          </button>
          {permissions.length === 0 && (
            <button 
              className="btn btn-success"
              onClick={initializeDefaultPermissions}
            >
              Initialize Default Permissions
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Roles Overview */}
      <div className="roles-overview">
        <h2>Roles</h2>
        <div className="roles-grid">
          {roles.map(role => (
            <div key={role.id} className="role-card">
              <div className="role-header">
                <h3>{role.name}</h3>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteRole(role.id)}
                >
                  Delete
                </button>
              </div>
              <p>{role.description}</p>
              <div className="role-stats">
                <span>{getRolePermissions(role.id).length} permissions</span>
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setSelectedRole(role)}
              >
                Manage Permissions
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Role</h2>
              <button onClick={() => setShowCreateRoleModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateRole} className="modal-body">
              <div className="form-group">
                <label>Role Name</label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateRoleModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Permission Modal */}
      {showCreatePermissionModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Permission</h2>
              <button onClick={() => setShowCreatePermissionModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePermission} className="modal-body">
              <div className="form-group">
                <label>Resource</label>
                <input
                  type="text"
                  value={newPermission.resource}
                  onChange={(e) => setNewPermission({...newPermission, resource: e.target.value})}
                  placeholder="e.g., users, schedules, courses"
                  required
                />
              </div>
              <div className="form-group">
                <label>Action</label>
                <input
                  type="text"
                  value={newPermission.action}
                  onChange={(e) => setNewPermission({...newPermission, action: e.target.value})}
                  placeholder="e.g., create, read, update, delete"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({...newPermission, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreatePermissionModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Permissions Modal */}
      {selectedRole && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Permissions for {selectedRole.name}</h2>
              <button onClick={() => setSelectedRole(null)}>×</button>
            </div>
            <div className="modal-body">
              {Object.keys(groupedPermissions).length === 0 ? (
                <div className="no-permissions">
                  <p>No permissions available. Initialize default permissions first.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={initializeDefaultPermissions}
                  >
                    Initialize Default Permissions
                  </button>
                </div>
              ) : (
                <div className="permissions-grid">
                  {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                    <div key={resource} className="resource-group">
                      <h3>{resource.charAt(0).toUpperCase() + resource.slice(1)}</h3>
                      <div className="permissions-list">
                        {resourcePermissions.map(permission => (
                          <label key={permission.id} className="permission-item">
                            <input
                              type="checkbox"
                              checked={hasPermission(selectedRole.id, permission.id)}
                              onChange={() => handleTogglePermission(
                                selectedRole.id,
                                permission.id,
                                hasPermission(selectedRole.id, permission.id)
                              )}
                            />
                            <div className="permission-info">
                              <span className="permission-name">{permission.action}</span>
                              <span className="permission-description">{permission.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedRole(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePermissionsEditor;