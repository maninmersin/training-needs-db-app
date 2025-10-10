import { NavLink } from 'react-router-dom';
import { 
  FaBars, FaTimes, FaProjectDiagram, FaTable,
  FaFileExport, FaCog, FaChartLine
} from 'react-icons/fa';
import '../../../core/components/Sidebar.css';

const OtherToolsSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">Other Tools</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Plan on a Page</span>
            </div>
            <ul>
              <li>
                <NavLink to="/other-tools/poap" className="sidebar-link">
                  Timeline Editor
                </NavLink>
              </li>
              <li>
                <NavLink to="/other-tools/poap/library" className="sidebar-link">
                  Plans Library
                </NavLink>
              </li>
              <li>
                <NavLink to="/other-tools/poap/export" className="sidebar-link">
                  Export Tools
                </NavLink>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Analytics Tools</span>
            </div>
            <ul>
              <li>
                <div className="sidebar-placeholder">
                  <span>Advanced Analytics</span>
                  <small style={{ opacity: 0.6 }}>(Coming Soon)</small>
                </div>
              </li>
              <li>
                <div className="sidebar-placeholder">
                  <span>Custom Reports</span>
                  <small style={{ opacity: 0.6 }}>(Coming Soon)</small>
                </div>
              </li>
            </ul>
          </li>

          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>Utilities</span>
            </div>
            <ul>
              <li>
                <div className="sidebar-placeholder">
                  <span>Data Import/Export</span>
                  <small style={{ opacity: 0.6 }}>(Coming Soon)</small>
                </div>
              </li>
              <li>
                <div className="sidebar-placeholder">
                  <span>Integration Tools</span>
                  <small style={{ opacity: 0.6 }}>(Coming Soon)</small>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default OtherToolsSidebar;