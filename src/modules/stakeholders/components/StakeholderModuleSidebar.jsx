import { NavLink } from 'react-router-dom';
import { 
  FaBars, FaTimes
} from 'react-icons/fa';
import '../../../core/components/Sidebar.css';

const StakeholderModuleSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">Stakeholders</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Registry & Mapping</span>
            </div>
            <ul>
              <li>
                <NavLink to="/stakeholder-directory" className="sidebar-link">
                  Stakeholder Directory
                </NavLink>
              </li>
              <li>
                <NavLink to="/influence-interest-matrix" className="sidebar-link">
                  Influence/Interest Matrix
                </NavLink>
              </li>
              <li>
                <NavLink to="/stakeholder-reference-data" className="sidebar-link">
                  Reference Data
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Communication Hub</span>
            </div>
            <ul>
              <li>
                <NavLink to="/stakeholder-communications" className="sidebar-link">
                  Communication Tracking
                  <span className="coming-soon">Coming Soon</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/communication-templates" className="sidebar-link">
                  Templates & Messages
                  <span className="coming-soon">Coming Soon</span>
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Analytics & Insights</span>
            </div>
            <ul>
              <li>
                <NavLink to="/stakeholder-analytics" className="sidebar-link">
                  Engagement Metrics
                  <span className="coming-soon">Coming Soon</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/change-readiness" className="sidebar-link">
                  Change Readiness Assessment
                  <span className="coming-soon">Coming Soon</span>
                </NavLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default StakeholderModuleSidebar;