import React from 'react';
import { useModule } from '@core/contexts';
import TrainingModuleSidebar from '@modules/training/components/TrainingModuleSidebar';
import AdminModuleSidebar from './sidebars/AdminModuleSidebar';
import DashboardSidebar from './sidebars/DashboardSidebar';

const ModularSidebar = ({ isOpen, onToggle }) => {
  const { currentModule } = useModule();

  const getSidebarComponent = () => {
    switch (currentModule) {
      case 'dashboard':
        return (
          <DashboardSidebar 
            isOpen={isOpen}
            onToggle={onToggle}
          />
        );
      case 'training':
        return (
          <TrainingModuleSidebar
            isOpen={isOpen}
            onToggle={onToggle}
          />
        );
      case 'admin':
        return (
          <AdminModuleSidebar
            isOpen={isOpen}
            onToggle={onToggle}
          />
        );
      default:
        return (
          <DashboardSidebar 
            isOpen={isOpen}
            onToggle={onToggle}
          />
        );
    }
  };

  return getSidebarComponent();
};

export default ModularSidebar;