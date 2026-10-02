import { NavLink } from 'react-router-dom';
import {
  FaBars, FaTimes
} from 'react-icons/fa';
import '../Sidebar.css';

const AdminModuleSidebar = ({ isOpen, onToggle }) => {
  return (
    <div 
      className={`custom-sidebar ${isOpen ? 'open' : ''}`} 
      data-testid="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-title">Administration</div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className="sidebar-submenu">
            <div className="submenu-header">
              <span>User & Access Management</span>
            </div>
            <ul>
              <li>
                <NavLink to="/user-management" className="sidebar-link">
                  User Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/role-permissions" className="sidebar-link">
                  Roles & Permissions
                </NavLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default AdminModuleSidebar;