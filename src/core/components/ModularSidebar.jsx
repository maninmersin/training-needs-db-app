import React from 'react';
import { useModule } from '@core/contexts';
import TrainingModuleSidebar from '@modules/training/components/TrainingModuleSidebar';
import AdminModuleSidebar from './sidebars/AdminModuleSidebar';
import DashboardSidebar from './sidebars/DashboardSidebar';
import PlaceholderSidebar from './sidebars/PlaceholderSidebar';
import OtherToolsSidebar from '@modules/other-tools/components/OtherToolsSidebar';
import StakeholderModuleSidebar from '@modules/stakeholders/components/StakeholderModuleSidebar';
import ImpactAssessmentModuleSidebar from '@modules/impact-assessment/components/ImpactAssessmentModuleSidebar';

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
      case 'stakeholder-engagement':
        return (
          <StakeholderModuleSidebar 
            isOpen={isOpen}
            onToggle={onToggle}
          />
        );
      case 'impact-assessment':
        return (
          <ImpactAssessmentModuleSidebar 
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
      case 'other-tools':
        return (
          <OtherToolsSidebar 
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