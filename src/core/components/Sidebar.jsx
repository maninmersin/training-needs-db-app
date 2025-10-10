import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FaHome, FaUsers, FaCog, FaChartPie, FaSignOutAlt, FaHandPaper, FaBars, FaTimes, FaUserShield, FaUserCog, FaKey, FaFolder, FaCrown, FaClipboardCheck } from 'react-icons/fa';
import './Sidebar.css';
import ExportAllData from '@shared/components/ExportAllData';
import { AuthService } from '@auth/services/authService';

const AppSidebar = ({ handleLogout, isOpen, onToggle }) => {
  const [userRoles, setUserRoles] = useState([]);
  const [isStakeholderEditor, setIsStakeholderEditor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUserRoles = async () => {
      const roles = await AuthService.getCurrentUserRoles();
      const stakeholderEditor = await AuthService.isStakeholderAssignmentEditor();
      const admin = await AuthService.isAdmin();
      
      setUserRoles(roles);
      setIsStakeholderEditor(stakeholderEditor);
      setIsAdmin(admin);
    };

    checkUserRoles();
  }, []);
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">TNA Manager</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/" className="sidebar-link">
              <FaHome className="sidebar-icon" />
              <span>Home</span>
            </NavLink>
          </li>
          
          {/* System Setup - Only show for admins */}
          {isAdmin && (
            <li className="sidebar-submenu">
              <div className="submenu-header">
                <FaCog className="sidebar-icon" />
                <span>System Setup</span>
              </div>
              <ul>
                <li>
                  <NavLink to="/courses" className="sidebar-link">
                    Courses
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/import-export-courses" className="sidebar-link">
                    Import/Export Courses
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/reference-data" className="sidebar-link">
                    Reference Data Management
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dynamic-users" className="sidebar-link">
                    End Users
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/import-export" className="sidebar-link">
                    Import/Export End Users
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/edit-mappings" className="sidebar-link">
                    Role-Course Mappings
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/export-all-data" className="sidebar-link">
                    Export All Data
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/trainers" className="sidebar-link">
                    Trainers
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/pivot-report" className="sidebar-link">
                    Pivot Tables
                  </NavLink>
                </li>
              </ul>
            </li>
          )}

          {/* Scheduling Section */}
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <FaChartPie className="sidebar-icon" />
              <span>{isStakeholderEditor ? 'User Management' : 'Scheduling'}</span>
            </div>
            <ul>
              {/* Stakeholder editors only see User Assignments */}
              {isStakeholderEditor ? (
                <li>
                  <NavLink to="/drag-drop-assignments" className="sidebar-link">
                    <FaHandPaper className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                    User Assignments
                  </NavLink>
                </li>
              ) : (
                <>
                  {/* Full scheduling menu for admins */}
                  <li>
                    <NavLink to="/training-sessions" className="sidebar-link">
                      Training Session Calculator
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/training-scheduler?restart=true" className="sidebar-link">
                      Training Scheduler Wizard
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/schedule-manager?restart=true" className="sidebar-link">
                      Schedule Manager
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/drag-drop-assignments" className="sidebar-link">
                      <FaHandPaper className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                      User Assignments
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/stakeholder-calendar" className="sidebar-link">
                      📅 Stakeholder Calendar
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </li>

          {/* User Management - Only show for admins */}
          {isAdmin && (
            <li className="sidebar-submenu">
              <div className="submenu-header">
                <FaUsers className="sidebar-icon" />
                <span>User Management</span>
              </div>
              <ul>
                <li>
                  <NavLink to="/user-management" className="sidebar-link">
                    <FaUserCog className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                    User Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/stakeholder-access" className="sidebar-link">
                    <FaUserShield className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                    Stakeholder Access
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/role-permissions" className="sidebar-link">
                    <FaKey className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                    Roles & Permissions
                  </NavLink>
                </li>
              </ul>
            </li>
          )}

          {/* Administration - Only show for admins */}
          {isAdmin && (
            <li className="sidebar-submenu">
              <div className="submenu-header">
                <FaCrown className="sidebar-icon" />
                <span>Administration</span>
              </div>
              <ul>
                <li>
                  <NavLink to="/projects" className="sidebar-link">
                    <FaFolder className="sidebar-icon" style={{ fontSize: '12px', marginRight: '8px' }} />
                    Project Management
                  </NavLink>
                </li>
              </ul>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button 
          className="logout-button" 
          onClick={handleLogout}
          title="Logout"
        >
          <FaSignOutAlt className="sidebar-icon" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AppSidebar;
