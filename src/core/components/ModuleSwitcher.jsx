import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaHome, 
  FaGraduationCap, 
  FaUsers, 
  FaChartLine, 
  FaCogs,
  FaToolbox,
  FaProjectDiagram
} from 'react-icons/fa';
import './ModuleSwitcher.css';

const modules = [
  {
    id: 'dashboard',
    name: 'Home',
    icon: FaHome,
    path: '/',
    description: 'Overview & Analytics'
  },
  {
    id: 'training',
    name: 'TNA',
    icon: FaGraduationCap,
    path: '/training',
    description: 'Training Needs & Scheduling'
  },
  {
    id: 'stakeholder-engagement',
    name: 'Stakeholder Engagement',
    icon: FaUsers,
    path: '/stakeholder-engagement',
    description: 'Stakeholder Management & Communication'
  },
  {
    id: 'impact-assessment',
    name: 'Impact Assessment',
    icon: FaChartLine,
    path: '/impact-assessment',
    description: 'Business Process Impact & Change Analysis'
  },
  {
    id: 'admin',
    name: 'Administration',
    icon: FaCogs,
    path: '/admin',
    description: 'System Configuration & User Management'
  },
  {
    id: 'other-tools',
    name: 'Other Tools',
    icon: FaToolbox,
    path: '/other-tools',
    description: 'Additional Planning & Visualization Tools'
  }
];

const ModuleSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentModule = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.startsWith('/training')) return 'training';
    if (path.startsWith('/stakeholder-engagement') || 
        path.startsWith('/stakeholder-directory') || 
        path.startsWith('/influence-interest-matrix') ||
        path.startsWith('/stakeholder-reference-data')) return 'stakeholder-engagement';
    if (path.startsWith('/impact-assessment')) return 'impact-assessment';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/other-tools')) return 'other-tools';
    
    // Legacy paths - map to appropriate modules
    const legacyTrainingPaths = [
      '/training-sessions', '/training-scheduler', '/schedule-manager', 
      '/drag-drop-assignments', '/schedule-calendar', '/stakeholder-calendar',
      '/courses', '/import-export-courses', '/reference-data', '/dynamic-users',
      '/import-export', '/edit-mappings', '/export-all-data', '/trainers',
      '/pivot-report', '/attendance-tracker', '/attendance-reports', '/attendance-compliance'
    ];
    const legacyAdminPaths = [
      '/user-management', '/stakeholder-access', '/role-permissions', '/projects'
    ];
    
    if (legacyTrainingPaths.some(p => path.startsWith(p))) return 'training';
    if (legacyAdminPaths.some(p => path.startsWith(p))) return 'admin';
    
    return 'dashboard';
  };

  const activeModule = getCurrentModule();

  const handleModuleClick = (module) => {
    if (module.isPlaceholder) {
      // Show placeholder message for future modules
      alert(`${module.name} module coming soon! This will include comprehensive ${module.description.toLowerCase()} capabilities.`);
      return;
    }
    
    navigate(module.path);
  };

  return (
    <div className="module-switcher">
      <div className="module-switcher-container">
        {modules.map((module) => {
          const IconComponent = module.icon;
          const isActive = activeModule === module.id;
          
          return (
            <button
              key={module.id}
              className={`module-tab ${isActive ? 'active' : ''} ${module.isPlaceholder ? 'placeholder' : ''}`}
              onClick={() => handleModuleClick(module)}
              title={module.description}
            >
              <IconComponent className="module-icon" />
              <span className="module-name">{module.name}</span>
              {module.isPlaceholder && (
                <span className="coming-soon-badge">Soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleSwitcher;