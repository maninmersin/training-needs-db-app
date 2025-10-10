import { NavLink } from 'react-router-dom';
import { FaHome, FaBars, FaTimes, FaCog } from 'react-icons/fa';
import '../Sidebar.css';

const PlaceholderSidebar = ({ moduleTitle, isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">{moduleTitle}</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/" className="sidebar-link">
              <FaHome className="sidebar-icon" />
              <span>Dashboard</span>
            </NavLink>
          </li>
          
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <FaCog className="sidebar-icon" />
              <span>Coming Soon</span>
            </div>
            <ul>
              <li className="sidebar-placeholder">
                <div className="placeholder-content">
                  <p>🚧 This module is under development</p>
                  <p>Features will include:</p>
                  <ul>
                    <li>Dashboard & Analytics</li>
                    <li>Management Tools</li>
                    <li>Reporting & Insights</li>
                    <li>Configuration Options</li>
                  </ul>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default PlaceholderSidebar;