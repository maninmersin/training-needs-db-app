import { NavLink } from 'react-router-dom';
import { 
  FaBars, FaTimes
} from 'react-icons/fa';
import '../../../core/components/Sidebar.css';

const TrainingModuleSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">TNA</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Setup</span>
            </div>
            <ul>
              <li>
                <NavLink to="/reference-data" className="sidebar-link">
                  Reference Data
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
                <NavLink to="/edit-mappings" className="sidebar-link">
                  Role-Course Mappings
                </NavLink>
              </li>
              <li>
                <NavLink to="/trainers" className="sidebar-link">
                  Trainers
                </NavLink>
              </li>
              <li>
                <NavLink to="/export-all-data" className="sidebar-link">
                  Export All Data
                </NavLink>
              </li>
              <li>
                <NavLink to="/pivot-report" className="sidebar-link">
                  Pivot Tables
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Schedule Management</span>
            </div>
            <ul>
              <li>
                <NavLink to="/training-sessions" className="sidebar-link">
                  Session Calculator
                </NavLink>
              </li>
              <li>
                <NavLink to="/training-scheduler?restart=true" className="sidebar-link">
                  Schedule Creator
                </NavLink>
              </li>
              <li>
                <NavLink to="/schedule-manager?restart=true" className="sidebar-link">
                  Schedule Manager
                </NavLink>
              </li>
              <li>
                <NavLink to="/drag-drop-assignments" className="sidebar-link">
                  User Assignments
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Attendance Management</span>
            </div>
            <ul>
              <li>
                <NavLink to="/attendance-tracker" className="sidebar-link">
                  Attendance Tracker
                </NavLink>
              </li>
              <li>
                <NavLink to="/attendance-compliance" className="sidebar-link">
                  Reports
                </NavLink>
              </li>
            </ul>
          </li>

        </ul>
      </nav>
    </div>
  );
};

export default TrainingModuleSidebar;