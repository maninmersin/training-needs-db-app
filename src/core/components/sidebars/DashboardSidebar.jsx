import { NavLink } from 'react-router-dom';
import { FaHome, FaChartPie, FaBars, FaTimes } from 'react-icons/fa';
import '../Sidebar.css';

const DashboardSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">Home</div>
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
          
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <FaChartPie className="sidebar-icon" />
              <span>Quick Access</span>
            </div>
            <ul>
              <li>
                <NavLink to="/training" className="sidebar-link">
                  📚 Training Module
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin" className="sidebar-link">
                  ⚙️ Administration
                </NavLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default DashboardSidebar;