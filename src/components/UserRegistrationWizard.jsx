import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './UserRegistrationWizard.css';

const UserRegistrationWizard = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available data for selections
  const [roles, setRoles] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    email: '',
    password: '',
    confirmPassword: '',
    
    // Step 2: Role Assignment
    userType: 'stakeholder', // 'admin', 'stakeholder', 'trainer'
    selectedRoles: [],
    
    // Step 3: Access Control (for stakeholders)
    functionalAreaAccess: [], // { areaId, accessLevel }
    
    // Step 4: Review
    sendWelcomeEmail: true
  });

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Email and password setup' },
    { number: 2, title: 'Role Assignment', description: 'Assign user type and roles' },
    { number: 3, title: 'Access Control', description: 'Configure functional area access' },
    { number: 4, title: 'Review & Create', description: 'Review settings and create user' }
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('a_roles')
        .select('*')
        .order('name');

      if (rolesError && rolesError.code !== '42P01') throw rolesError;
      setRoles(rolesData || []);

      // Fetch functional areas
      const { data: areasData, error: areasError } = await supabase
        .from('functional_areas_tbl')
        .select('*')
        .eq('active', true)
        .order('display_order');

      if (areasError && areasError.code !== '42P01') throw areasError;
      setFunctionalAreas(areasData || []);

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load form data');
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return false;
        }
        break;
      
      case 2:
        if (formData.selectedRoles.length === 0) {
          setError('Please select at least one role');
          return false;
        }
        break;
      
      case 3:
        if (formData.userType === 'stakeholder' && formData.functionalAreaAccess.length === 0) {
          setError('Stakeholders must have access to at least one functional area');
          return false;
        }
        break;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    setError(null);
  };

  const handleUserTypeChange = (userType) => {
    setFormData(prev => {
      const newData = { ...prev, userType };
      
      // Auto-select appropriate roles based on user type
      let selectedRoles = [];
      if (userType === 'admin') {
        const adminRole = roles.find(r => r.name.toLowerCase() === 'admin');
        if (adminRole) selectedRoles = [adminRole.id];
      } else if (userType === 'stakeholder') {
        const stakeholderRole = roles.find(r => r.name.toLowerCase() === 'stakeholder');
        if (stakeholderRole) selectedRoles = [stakeholderRole.id];
      } else if (userType === 'trainer') {
        const trainerRole = roles.find(r => r.name.toLowerCase() === 'trainer');
        if (trainerRole) selectedRoles = [trainerRole.id];
      }
      
      return { ...newData, selectedRoles };
    });
  };

  const handleFunctionalAreaAccess = (areaId, accessLevel) => {
    setFormData(prev => {
      const existingAccess = prev.functionalAreaAccess.find(fa => fa.areaId === areaId);
      let newAccess;
      
      if (existingAccess) {
        if (accessLevel === null) {
          // Remove access
          newAccess = prev.functionalAreaAccess.filter(fa => fa.areaId !== areaId);
        } else {
          // Update access level
          newAccess = prev.functionalAreaAccess.map(fa => 
            fa.areaId === areaId ? { ...fa, accessLevel } : fa
          );
        }
      } else {
        // Add new access
        newAccess = [...prev.functionalAreaAccess, { areaId, accessLevel }];
      }
      
      return { ...prev, functionalAreaAccess: newAccess };
    });
  };

  const handleCreateUser = async () => {
    if (!validateStep(3)) return;

    try {
      setLoading(true);
      setError(null);

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Insert user into a_users table
      const { error: userError } = await supabase
        .from('a_users')
        .insert({
          id: userId,
          email: formData.email,
          is_verified: true
        });

      if (userError) throw userError;

      // Assign roles
      if (formData.selectedRoles.length > 0) {
        const roleInserts = formData.selectedRoles.map(roleId => ({
          user_id: userId,
          role_id: roleId
        }));

        const { error: rolesError } = await supabase
          .from('a_user_roles')
          .insert(roleInserts);

        if (rolesError) throw rolesError;
      }

      // Assign functional area access for stakeholders
      if (formData.userType === 'stakeholder' && formData.functionalAreaAccess.length > 0) {
        const accessInserts = formData.functionalAreaAccess.map(fa => ({
          user_id: userId,
          functional_area_id: fa.areaId,
          access_level: fa.accessLevel
        }));

        try {
          const { error: accessError } = await supabase
            .from('a_user_functional_areas')
            .insert(accessInserts);

          if (accessError && accessError.code === '42P01') {
            // Table doesn't exist, create it
            await createUserFunctionalAreasTable();
            
            const { error: retryError } = await supabase
              .from('a_user_functional_areas')
              .insert(accessInserts);
            
            if (retryError) throw retryError;
          } else if (accessError) {
            throw accessError;
          }
        } catch (err) {
          console.error('Error assigning functional area access:', err);
        }
      }

      // Send welcome email if requested
      if (formData.sendWelcomeEmail) {
        try {
          const { error: emailError } = await supabase.auth.admin.generateLink({
            type: 'invite',
            email: formData.email
          });
          if (emailError) console.warn('Failed to send welcome email:', emailError);
        } catch (err) {
          console.warn('Failed to send welcome email:', err);
        }
      }

      // Call completion callback
      if (onComplete) {
        onComplete({
          userId,
          email: formData.email,
          userType: formData.userType,
          roles: formData.selectedRoles,
          functionalAreas: formData.functionalAreaAccess
        });
      }

    } catch (err) {
      setError(`Failed to create user: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
    `;

    const { error } = await supabase.rpc('execute_sql', { sql: createTableSQL });
    if (error) throw error;
  };

  const getAccessLevel = (areaId) => {
    const access = formData.functionalAreaAccess.find(fa => fa.areaId === areaId);
    return access?.accessLevel || null;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="wizard-step">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="wizard-step">
            <h3>Role Assignment</h3>
            <div className="form-group">
              <label>User Type</label>
              <div className="user-type-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="userType"
                    value="admin"
                    checked={formData.userType === 'admin'}
                    onChange={(e) => handleUserTypeChange(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Administrator</strong>
                    <p>Full system access and user management capabilities</p>
                  </div>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="userType"
                    value="stakeholder"
                    checked={formData.userType === 'stakeholder'}
                    onChange={(e) => handleUserTypeChange(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Stakeholder</strong>
                    <p>Limited access based on functional areas</p>
                  </div>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="userType"
                    value="trainer"
                    checked={formData.userType === 'trainer'}
                    onChange={(e) => handleUserTypeChange(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Trainer</strong>
                    <p>Training session management and course access</p>
                  </div>
                </label>
              </div>
            </div>
            
            {roles.length > 0 && (
              <div className="form-group">
                <label>Additional Roles (Optional)</label>
                <div className="checkbox-group">
                  {roles.map(role => (
                    <label key={role.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.selectedRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              selectedRoles: [...formData.selectedRoles, role.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selectedRoles: formData.selectedRoles.filter(r => r !== role.id)
                            });
                          }
                        }}
                      />
                      {role.name}
                      {role.description && <span className="role-description">- {role.description}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="wizard-step">
            <h3>Access Control</h3>
            {formData.userType === 'stakeholder' ? (
              <div className="form-group">
                <label>Functional Area Access</label>
                <p className="help-text">Select the functional areas this stakeholder can access:</p>
                <div className="functional-areas-grid">
                  {functionalAreas.map(area => {
                    const accessLevel = getAccessLevel(area.id);
                    return (
                      <div key={area.id} className="area-access-control">
                        <div className="area-info">
                          <h4>{area.name}</h4>
                          {area.description && <p>{area.description}</p>}
                        </div>
                        <div className="access-controls">
                          <select
                            value={accessLevel || ''}
                            onChange={(e) => {
                              const level = e.target.value || null;
                              handleFunctionalAreaAccess(area.id, level);
                            }}
                          >
                            <option value="">No Access</option>
                            <option value="read">Read Only</option>
                            <option value="write">Read/Write</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="access-info">
                <p>
                  {formData.userType === 'admin' 
                    ? 'Administrators have full system access by default.'
                    : 'Trainers have access to training management features by default.'
                  }
                </p>
                <p>Specific functional area restrictions can be configured later if needed.</p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="wizard-step">
            <h3>Review & Create</h3>
            <div className="review-section">
              <div className="review-item">
                <label>Email:</label>
                <span>{formData.email}</span>
              </div>
              <div className="review-item">
                <label>User Type:</label>
                <span>{formData.userType.charAt(0).toUpperCase() + formData.userType.slice(1)}</span>
              </div>
              <div className="review-item">
                <label>Roles:</label>
                <span>
                  {formData.selectedRoles.map(roleId => {
                    const role = roles.find(r => r.id === roleId);
                    return role?.name;
                  }).filter(Boolean).join(', ') || 'None'}
                </span>
              </div>
              {formData.userType === 'stakeholder' && (
                <div className="review-item">
                  <label>Functional Area Access:</label>
                  <div className="access-summary">
                    {formData.functionalAreaAccess.map(fa => {
                      const area = functionalAreas.find(a => a.id === fa.areaId);
                      return (
                        <div key={fa.areaId} className="access-item">
                          <span>{area?.name}</span>
                          <span className="access-level">{fa.accessLevel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.sendWelcomeEmail}
                  onChange={(e) => setFormData({...formData, sendWelcomeEmail: e.target.checked})}
                />
                Send welcome email with login instructions
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="user-registration-wizard">
      <div className="wizard-header">
        <h1>Create New User</h1>
        <div className="wizard-progress">
          {steps.map(step => (
            <div 
              key={step.number} 
              className={`progress-step ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
            >
              <div className="step-number">{step.number}</div>
              <div className="step-info">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="wizard-content">
        {renderStep()}
      </div>

      <div className="wizard-footer">
        <div className="wizard-actions">
          {currentStep > 1 && (
            <button 
              className="btn btn-secondary"
              onClick={handlePrevious}
              disabled={loading}
            >
              Previous
            </button>
          )}
          
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          
          {currentStep < 4 ? (
            <button 
              className="btn btn-primary"
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </button>
          ) : (
            <button 
              className="btn btn-success"
              onClick={handleCreateUser}
              disabled={loading}
            >
              {loading ? 'Creating User...' : 'Create User'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserRegistrationWizard;