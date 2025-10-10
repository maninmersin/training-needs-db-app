import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ModuleContext = createContext();

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
};

export const ModuleProvider = ({ children }) => {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [moduleHistory, setModuleHistory] = useState(['dashboard']);
  const location = useLocation();

  const getModuleFromPath = (path) => {
    if (path === '/') return 'dashboard';
    if (path.startsWith('/training')) return 'training';
    if (path.startsWith('/stakeholder-engagement')) return 'stakeholder-engagement';
    if (path.startsWith('/impact-assessment')) return 'impact-assessment';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/other-tools')) return 'other-tools';
    
    // Stakeholder module paths
    const stakeholderPaths = [
      '/stakeholder-directory', '/influence-interest-matrix', '/stakeholder-reference-data'
    ];
    
    // Legacy paths - map to appropriate modules
    const legacyTrainingPaths = [
      '/training-sessions', '/training-scheduler', '/schedule-manager', 
      '/drag-drop-assignments', '/schedule-calendar', '/stakeholder-calendar',
      '/courses', '/import-export-courses', '/reference-data', '/dynamic-users',
      '/import-export', '/edit-mappings', '/export-all-data', '/trainers',
      '/pivot-report', '/attendance-tracker', '/attendance-reports', '/attendance-compliance'
    ];
    const legacyAdminPaths = [
      '/user-management', '/stakeholder-access', '/role-permissions'
    ];
    
    if (stakeholderPaths.some(p => path.startsWith(p))) return 'stakeholder-engagement';
    if (legacyTrainingPaths.some(p => path.startsWith(p))) return 'training';
    if (legacyAdminPaths.some(p => path.startsWith(p))) return 'admin';
    
    return 'dashboard';
  };

  // Update current module based on location
  useEffect(() => {
    const newModule = getModuleFromPath(location.pathname);
    if (newModule !== currentModule) {
      setCurrentModule(newModule);
      setModuleHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[newHistory.length - 1] !== newModule) {
          newHistory.push(newModule);
          // Keep only last 10 modules in history
          return newHistory.slice(-10);
        }
        return newHistory;
      });
    }
  }, [location.pathname, currentModule]);

  const switchModule = (moduleId) => {
    setCurrentModule(moduleId);
    setModuleHistory(prev => {
      const newHistory = [...prev];
      if (newHistory[newHistory.length - 1] !== moduleId) {
        newHistory.push(moduleId);
        return newHistory.slice(-10);
      }
      return newHistory;
    });
  };

  const getModuleDisplayName = (moduleId) => {
    const moduleNames = {
      'dashboard': 'Dashboard',
      'training': 'Training Management',
      'stakeholder-engagement': 'Stakeholder Engagement',
      'impact-assessment': 'Impact Assessment',
      'admin': 'Administration',
      'other-tools': 'Other Tools'
    };
    return moduleNames[moduleId] || 'Unknown Module';
  };

  const isModuleActive = (moduleId) => {
    return currentModule === moduleId;
  };

  const getPreviousModule = () => {
    return moduleHistory.length > 1 ? moduleHistory[moduleHistory.length - 2] : null;
  };

  const value = {
    currentModule,
    moduleHistory,
    switchModule,
    getModuleDisplayName,
    isModuleActive,
    getPreviousModule,
    getModuleFromPath
  };

  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  );
};