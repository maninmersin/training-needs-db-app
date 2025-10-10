import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { supabaseAdmin, isAdminAvailable, getAdminErrorMessage } from '@core/services/supabaseAdmin';
import './UserManagementDashboard.css';

const UserManagementDashboard = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Form states for creating users
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    roles: [],
    functionalAreas: [],
    isActive: true
  });

  // Form states for editing users
  const [editFormData, setEditFormData] = useState({
    email: '',
    password: '',
    roles: []
  });

  const [showPassword, setShowPassword] = useState(false);

  const [validationErrors, setValidationErrors] = useState({});

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const validateEditForm = () => {
    const errors = {};

    // Email validation
    if (!editFormData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(editFormData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation (only if password is provided)
    if (editFormData.password && editFormData.password.trim() !== '') {
      if (!validatePassword(editFormData.password)) {
        errors.password = 'Password must be at least 6 characters long';
      }
    }

    // Roles validation (at least one role required)
    if (editFormData.roles.length === 0) {
      errors.roles = 'At least one role must be assigned';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchFunctionalAreas()
      ]);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchUsers = useCallback(async () => {
    try {
      // Try to fetch users with proper joins first
      const { data: usersData, error: usersError } = await supabase
        .from('auth_users')
        .select(`
          *,
          auth_user_roles (
            role_id,
            auth_roles (
              id,
              name,
              description
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (usersError) {
        if (usersError.code === '42P01') {
          setUsers([]);
          return;
        }
        // If joins fail, fall back to manual joining
        return await fetchUsersManually();
      }

      setUsers(usersData || []);
    } catch (err) {
      // Fallback to manual joining if relationships fail
      await fetchUsersManually();
    }
  }, []);

  const fetchUsersManually = async () => {
    try {
      // Fallback method with manual joins
      const [usersResponse, userRolesResponse, rolesResponse] = await Promise.all([
        supabase.from('auth_users').select('*').order('created_at', { ascending: false }),
        supabase.from('auth_user_roles').select('user_id, role_id'),
        supabase.from('auth_roles').select('id, name, description')
      ]);

      const usersData = usersResponse.data || [];
      const userRolesData = userRolesResponse.data || [];
      const rolesData = rolesResponse.data || [];

      // Manually join the data
      const usersWithRoles = usersData.map(user => {
        const userRoles = userRolesData
          .filter(ur => ur.user_id === user.id)
          .map(ur => {
            const role = rolesData.find(r => r.id === ur.role_id);
            return {
              role_id: ur.role_id,
              auth_roles: role || { id: ur.role_id, name: 'Unknown Role', description: '' }
            };
          });

        return {
          ...user,
          auth_user_roles: userRoles
        };
      });

      setUsers(usersWithRoles);
    } catch (err) {
      setUsers([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('auth_roles')
        .select('*')
        .order('name');

      if (error) {
        if (error.code === '42P01') {
          setRoles([]);
          return;
        }
        throw error;
      }
      setRoles(data || []);
    } catch (err) {
      setRoles([]);
    }
  };

  const fetchFunctionalAreas = async () => {
    const { data, error } = await supabase
      .from('functional_areas')
      .select('*')
      .eq('active', true)
      .order('display_order');

    if (error) throw error;
    setFunctionalAreas(data || []);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // Check if admin operations are available
    if (!isAdminAvailable()) {
      setError(getAdminErrorMessage());
      return;
    }

    try {
      setLoading(true);

      // Create user in Supabase Auth using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Insert user into auth_users table (include password_hash for compatibility)
      const { error: userError } = await supabase
        .from('auth_users')
        .insert({
          id: userId,
          email: formData.email,
          password_hash: 'auth_managed', // Placeholder since Supabase Auth manages this
          is_verified: true
        });

      if (userError) throw userError;

      // Assign roles
      if (formData.roles.length > 0) {
        const roleInserts = formData.roles.map(roleId => ({
          user_id: userId,
          role_id: roleId
        }));

        const { error: rolesError } = await supabase
          .from('auth_user_roles')
          .insert(roleInserts);

        if (rolesError) throw rolesError;
      }

      // Reset form and refresh data
      setFormData({
        email: '',
        password: '',
        roles: [],
        functionalAreas: [],
        isActive: true
      });
      setShowCreateModal(false);
      await fetchUsers();

    } catch (err) {
      setError(`Failed to create user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);

      // Delete from auth_user_roles first (due to foreign key constraint)
      await supabase
        .from('auth_user_roles')
        .delete()
        .eq('user_id', userToDelete.id);

      // Delete from auth_users
      await supabase
        .from('auth_users')
        .delete()
        .eq('id', userToDelete.id);

      // Delete from Supabase Auth (if admin available)
      if (isAdminAvailable()) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
        // Auth deletion is optional, continue if it fails
      }

      await fetchUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (userId, roleId, hasRole) => {
    try {
      if (hasRole) {
        // Remove role
        await supabase
          .from('auth_user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId);
      } else {
        // Add role
        await supabase
          .from('auth_user_roles')
          .insert({ user_id: userId, role_id: roleId });
      }

      await fetchUsers();
    } catch (err) {
      setError(`Failed to update role: ${err.message}`);
    }
  };


  const openEditModal = (user) => {
    setEditingUser(user);
    setEditFormData({
      email: user.email,
      password: '',
      roles: user.auth_user_roles?.map(ur => ur.role_id) || []
    });
    setShowPassword(false);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditFormData({
      email: '',
      password: '',
      roles: []
    });
    setValidationErrors({});
    setShowPassword(false);
    setShowEditModal(false);
    setError(null);
  };

  const updateUser = async () => {
    // Validate form before submitting
    if (!validateEditForm()) {
      return;
    }

    if (!isAdminAvailable()) {
      setError(getAdminErrorMessage());
      return;
    }

    try {
      setLoading(true);

      // Update email if changed
      if (editFormData.email !== editingUser.email) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
          editingUser.id,
          { email: editFormData.email }
        );
        if (emailError) throw emailError;
      }

      // Update password if provided
      if (editFormData.password && editFormData.password.trim() !== '') {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          editingUser.id,
          { password: editFormData.password }
        );
        if (passwordError) throw passwordError;
      }


      // Update auth_users table
      const { error: userError } = await supabase
        .from('auth_users')
        .update({
          email: editFormData.email
        })
        .eq('id', editingUser.id);

      if (userError) throw userError;

      // Update roles
      await updateUserRoles(editingUser.id, editFormData.roles);

      await fetchData();
      closeEditModal();
      setError('User updated successfully');
      setTimeout(() => setError(null), 3000);

    } catch (err) {
      setError(`Failed to update user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRoles = async (userId, newRoles) => {
    // Get current roles
    const { data: currentRoles, error: fetchError } = await supabase
      .from('auth_user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (fetchError) throw fetchError;

    const currentRoleIds = currentRoles?.map(r => r.role_id) || [];

    // Roles to remove
    const rolesToRemove = currentRoleIds.filter(roleId => !newRoles.includes(roleId));
    if (rolesToRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('auth_user_roles')
        .delete()
        .eq('user_id', userId)
        .in('role_id', rolesToRemove);
      
      if (removeError) throw removeError;
    }

    // Roles to add
    const rolesToAdd = newRoles.filter(roleId => !currentRoleIds.includes(roleId));
    if (rolesToAdd.length > 0) {
      const roleInserts = rolesToAdd.map(roleId => ({
        user_id: userId,
        role_id: roleId
      }));

      const { error: addError } = await supabase
        .from('auth_user_roles')
        .insert(roleInserts);

      if (addError) throw addError;
    }
  };


  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !filterRole || user.auth_user_roles?.some(ur => ur.role_id.toString() === filterRole);
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  const getUserRoles = useCallback((user) => {
    return user.auth_user_roles?.map(ur => ur.auth_roles?.name).filter(Boolean) || [];
  }, []);

  const hasRole = useCallback((user, roleId) => {
    return user.auth_user_roles?.some(ur => ur.role_id === roleId) || false;
  }, []);

  if (loading) {
    return <div className="loading">Loading user management dashboard...</div>;
  }

  // Check if tables exist
  const tablesExist = users.length > 0 || roles.length > 0 || error === null;

  return (
    <div className="user-management-dashboard">
      <div className="dashboard-header">
        <h1>User Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Create New User
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {(users.length === 0 && roles.length === 0 && !loading) && (
        <div className="setup-notice">
          <h3>🚀 Setup Required</h3>
          <p>The user management system needs to be initialized. Please run the database schema setup first.</p>
          <div className="setup-instructions">
            <h4>Setup Instructions:</h4>
            <ol>
              <li>Go to your Supabase project dashboard</li>
              <li>Navigate to the SQL Editor</li>
              <li>Copy and paste the contents of <code>database_schema/create_user_management_tables.sql</code></li>
              <li>Execute the SQL to create the required tables and data</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="role-filter"
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Roles</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  <span className={`status ${user.is_verified ? 'verified' : 'unverified'}`}>
                    {user.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                </td>
                <td>
                  <div className="user-roles">
                    {getUserRoles(user).map(roleName => (
                      <span key={roleName} className="role-badge">{roleName}</span>
                    ))}
                  </div>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openEditModal(user)}
                    >
                      Edit User
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => confirmDeleteUser(user)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New User</h2>
              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-body">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Roles</label>
                <div className="checkbox-group">
                  {roles.map(role => (
                    <label key={role.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, roles: [...formData.roles, role.id]});
                          } else {
                            setFormData({...formData, roles: formData.roles.filter(r => r !== role.id)});
                          }
                        }}
                      />
                      {role.name}
                      {role.description && <span className="role-description">- {role.description}</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Roles Modal */}
      {selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Roles for {selectedUser.email}</h2>
              <button onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="checkbox-group">
                {roles.map(role => (
                  <label key={role.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={hasRole(selectedUser, role.id)}
                      onChange={(e) => handleToggleRole(selectedUser.id, role.id, hasRole(selectedUser, role.id))}
                    />
                    {role.name}
                    {role.description && <span className="role-description">- {role.description}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit User: {editingUser.email}</h2>
              <button onClick={closeEditModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  required
                  className={validationErrors.email ? 'error' : ''}
                />
                {validationErrors.email && <div className="error-text">{validationErrors.email}</div>}
              </div>

              <div className="form-group">
                <label>New Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
                    minLength={6}
                    placeholder="Leave blank to keep current password"
                    className={validationErrors.password ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
                {validationErrors.password && <div className="error-text">{validationErrors.password}</div>}
              </div>

              <div className="form-group">
                <label>Roles</label>
                <div className="checkbox-group">
                  {roles.map(role => (
                    <label key={role.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editFormData.roles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditFormData({...editFormData, roles: [...editFormData.roles, role.id]});
                          } else {
                            setEditFormData({...editFormData, roles: editFormData.roles.filter(r => r !== role.id)});
                          }
                        }}
                      />
                      {role.name}
                      {role.description && <span className="role-description">- {role.description}</span>}
                    </label>
                  ))}
                </div>
                {validationErrors.roles && <div className="error-text">{validationErrors.roles}</div>}
              </div>



            </div>
            <div className="modal-footer">
              <button 
                onClick={closeEditModal} 
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={updateUser} 
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Confirm Delete User</h2>
              <button onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the user <strong>{userToDelete.email}</strong>?</p>
              <p className="warning-text">This action cannot be undone and will remove all associated data.</p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteUser} 
                className="btn btn-danger"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(UserManagementDashboard);