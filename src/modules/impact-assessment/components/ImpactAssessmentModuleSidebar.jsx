import { NavLink } from 'react-router-dom';
import { 
  FaBars, FaTimes
} from 'react-icons/fa';
import '../../../core/components/Sidebar.css';

const ImpactAssessmentModuleSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">Impact Assessment</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Assessment Management</span>
            </div>
            <ul>
              <li>
                <NavLink to="/impact-assessment" className="sidebar-link">
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/manage" className="sidebar-link">
                  Manage Assessments
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Setup & Configuration</span>
            </div>
            <ul>
              <li>
                <NavLink to="/impact-assessment/setup/hierarchy" className="sidebar-link">
                  Process Hierarchy
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/setup/import-export" className="sidebar-link">
                  Excel Import/Export
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/setup/reference-data" className="sidebar-link">
                  Reference Data
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>RACI Analysis</span>
            </div>
            <ul>
              <li>
                <NavLink to="/impact-assessment/analytics" className="sidebar-link">
                  Impact Analytics
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/stakeholder-correlation" className="sidebar-link">
                  Stakeholder Correlation
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/responsibility-tracking" className="sidebar-link">
                  Responsibility Tracking
                </NavLink>
              </li>
              <li>
                <NavLink to="/impact-assessment/raci-comparison" className="sidebar-link">
                  RACI Comparison
                </NavLink>
              </li>
            </ul>
          </li>

        </ul>
      </nav>
    </div>
  );
};

export default ImpactAssessmentModuleSidebar;