import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FaCogs, FaUsers, FaUserShield, FaKey, FaUserCog,
  FaDatabase, FaLock, FaChartLine 
} from 'react-icons/fa';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const adminProcesses = [
    {
      title: 'User Management',
      description: 'Manage user accounts, profiles, and system access',
      icon: FaUserCog,
      path: '/user-management',
      color: '#3498db'
    },
    {
      title: 'Stakeholder Access',
      description: 'Configure stakeholder permissions and access levels',
      icon: FaUserShield,
      path: '/stakeholder-access',
      color: '#9b59b6'
    },
    {
      title: 'Roles & Permissions',
      description: 'Define system roles and manage user permissions',
      icon: FaKey,
      path: '/role-permissions',
      color: '#e74c3c'
    }
  ];

  const adminFeatures = [
    {
      title: 'Centralized User Control',
      description: 'Single point of control for all user accounts and access management',
      icon: FaUsers,
      color: '#27ae60'
    },
    {
      title: 'Security & Compliance',
      description: 'Robust security controls and compliance monitoring capabilities',
      icon: FaLock,
      color: '#16a085'
    },
    {
      title: 'System Monitoring',
      description: 'Track system usage, performance metrics, and user activity',
      icon: FaChartLine,
      color: '#8e44ad'
    }
  ];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <FaCogs className="header-icon" />
          <div>
            <h1>System Administration</h1>
            <p>Centralized management of users, access controls, and system security</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="quick-actions">
          <h2>Core Admin Functions</h2>
          <div className="actions-grid">
            {adminProcesses.map((process, index) => {
              const IconComponent = process.icon;
              return (
                <Link 
                  key={index} 
                  to={process.path} 
                  className="action-card"
                  style={{ borderLeftColor: process.color }}
                >
                  <div className="action-icon" style={{ backgroundColor: process.color }}>
                    <IconComponent />
                  </div>
                  <div className="action-content">
                    <h3>{process.title}</h3>
                    <p>{process.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="upcoming-features">
          <h2>Administration Capabilities</h2>
          <div className="features-grid">
            {adminFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div 
                  key={index} 
                  className="feature-card"
                  style={{ borderLeftColor: feature.color }}
                >
                  <div className="feature-icon" style={{ backgroundColor: feature.color }}>
                    <IconComponent />
                  </div>
                  <div className="feature-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="stats-overview">
          <h2>Administrative Benefits</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Secure Access</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">User Control</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Audit Trail</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Compliance</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;