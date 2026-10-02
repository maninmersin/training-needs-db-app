import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaGraduationCap,
  FaCogs
} from 'react-icons/fa';
import './ModuleSwitcher.css';

const modules = [
  {
    id: 'training',
    name: 'TNA',
    icon: FaGraduationCap,
    path: '/training',
    description: 'Training Needs & Scheduling'
  },
  {
    id: 'admin',
    name: 'Administration',
    icon: FaCogs,
    path: '/admin',
    description: 'System Configuration & User Management'
  }
];

const ModuleSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentModule = () => {
    const path = location.pathname;
    if (path.startsWith('/training')) return 'training';
    if (path.startsWith('/admin')) return 'admin';

    // Legacy paths - map to appropriate modules
    const legacyTrainingPaths = [
      '/training-sessions', '/training-scheduler', '/schedule-manager',
      '/drag-drop-assignments', '/schedule-calendar',
      '/courses', '/import-export-courses', '/reference-data', '/dynamic-users',
      '/import-export', '/edit-mappings', '/export-all-data', '/trainers',
      '/pivot-report', '/attendance-tracker', '/attendance-reports', '/attendance-compliance'
    ];
    const legacyAdminPaths = [
      '/user-management', '/role-permissions', '/projects'
    ];

    if (legacyTrainingPaths.some(p => path.startsWith(p))) return 'training';
    if (legacyAdminPaths.some(p => path.startsWith(p))) return 'admin';

    return 'training'; // Default to training instead of dashboard
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