import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useModule } from '@core/contexts';
import { FaHome, FaAngleRight } from 'react-icons/fa';
import './Breadcrumb.css';

const Breadcrumb = () => {
  const location = useLocation();
  const { currentModule, getModuleDisplayName } = useModule();

  const getBreadcrumbItems = () => {
    const path = location.pathname;
    const items = [];

    // Always start with Home
    items.push({
      name: 'Dashboard',
      path: '/',
      icon: FaHome
    });

    // Add module if not on dashboard
    if (currentModule !== 'dashboard') {
      const moduleDisplayName = getModuleDisplayName(currentModule);
      
      let modulePath;
      switch (currentModule) {
        case 'training':
          modulePath = '/training';
          break;
        case 'admin':
          modulePath = '/admin';
          break;
        case 'stakeholder-engagement':
          modulePath = '/stakeholder-engagement';
          break;
        case 'impact-assessment':
          modulePath = '/impact-assessment';
          break;
        default:
          modulePath = '/';
      }
      
      items.push({
        name: moduleDisplayName,
        path: modulePath
      });
    }

    // Add specific page based on current path
    const pageInfo = getPageInfo(path, currentModule);
    if (pageInfo && pageInfo.name !== items[items.length - 1]?.name) {
      items.push(pageInfo);
    }

    return items;
  };

  const getPageInfo = (path, module) => {
    // Training module pages
    if (module === 'training') {
      if (path === '/training-sessions') return { name: 'Session Calculator', path };
      if (path.startsWith('/training-scheduler')) return { name: 'TSC Wizard', path };
      if (path.startsWith('/schedule-manager')) return { name: 'Schedule Manager', path };
      if (path === '/drag-drop-assignments') return { name: 'User Assignments', path };
      if (path === '/schedule-calendar') return { name: 'Training Calendar', path };
    }

    // Admin module pages
    if (module === 'admin') {
      if (path === '/courses') return { name: 'Courses', path };
      if (path === '/import-export-courses') return { name: 'Import/Export Courses', path };
      if (path === '/reference-data') return { name: 'Reference Data', path };
      if (path === '/dynamic-users') return { name: 'End Users', path };
      if (path === '/import-export') return { name: 'Import/Export Users', path };
      if (path === '/edit-mappings') return { name: 'Role-Course Mappings', path };
      if (path === '/trainers') return { name: 'Trainers', path };
      if (path === '/pivot-report') return { name: 'Pivot Tables', path };
      if (path === '/user-management') return { name: 'User Management', path };
      if (path === '/stakeholder-access') return { name: 'Stakeholder Access', path };
      if (path === '/role-permissions') return { name: 'Roles & Permissions', path };
      if (path === '/stakeholder-calendar') return { name: 'Stakeholder Calendar', path };
      if (path === '/export-all-data') return { name: 'Export All Data', path };
    }

    // Stakeholder Engagement module pages
    if (module === 'stakeholder-engagement') {
      if (path === '/stakeholder-engagement') return { name: 'Dashboard', path };
      if (path === '/stakeholder-directory') return { name: 'Stakeholder Directory', path };
      if (path === '/influence-interest-matrix') return { name: 'Influence/Interest Matrix', path };
      if (path === '/stakeholder-reference-data') return { name: 'Reference Data', path };
    }

    return null;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Don't show breadcrumb if we're only on Dashboard
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const IconComponent = item.icon;
          
          return (
            <li key={item.path} className="breadcrumb-item">
              {index > 0 && <FaAngleRight className="breadcrumb-separator" />}
              {isLast ? (
                <span className="breadcrumb-current">
                  {IconComponent && <IconComponent className="breadcrumb-icon" />}
                  {item.name}
                </span>
              ) : (
                <Link to={item.path} className="breadcrumb-link">
                  {IconComponent && <IconComponent className="breadcrumb-icon" />}
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;