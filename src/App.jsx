import { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';
import './components/ErrorBoundary.css';
import './components/ScheduleSelector.css';
import { supabase } from './supabaseClient';

// Import critical components normally (for faster initial load)
import Home from './components/Home';
import LoginComponent from './components/LoginComponent';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load heavy components
const DynamicUserForm = lazy(() => import('./components/DynamicUserForm'));
const RoleCourseMappingsEditor = lazy(() => import('./components/RoleCourseMappingsEditor'));
const ImportExportEndUsers = lazy(() => import('./components/ImportExportEndUsers'));
const PivotReport = lazy(() => import('./components/PivotReport'));
const CoursesForm = lazy(() => import('./components/CoursesForm'));
const ImportExportCourses = lazy(() => import('./components/ImportExportCourses'));
const ExportAllData = lazy(() => import('./components/ExportAllData'));
const TrainingSessionCalculator = lazy(() => import('./components/TrainingSessionCalculator'));
const TrainingSessionCalendar = lazy(() => import('./components/TrainingSessionCalendar'));
const ScheduleCalendar = lazy(() => import('./components/ScheduleCalendar'));
const TSCWizard = lazy(() => import('./components/TSCWizard'));
const ScheduleManager = lazy(() => import('./components/ScheduleManager'));
const TrainerManagement = lazy(() => import('./components/TrainerManagement'));
const DragDropAssignmentPage = lazy(() => import('./components/DragDropAssignmentPage'));
const ReferenceDataManager = lazy(() => import('./components/ReferenceDataManager'));
const StakeholderCalendarPage = lazy(() => import('./components/StakeholderCalendarPage'));

// User management components
const UserManagementDashboard = lazy(() => import('./components/UserManagementDashboard'));
const StakeholderAccessManager = lazy(() => import('./components/StakeholderAccessManager'));
const RolePermissionsEditor = lazy(() => import('./components/RolePermissionsEditor'));
import './index.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  };

  return (  
    <Router>
      <ErrorBoundary 
        onGoHome={() => window.location.href = '/'}
        onError={(error, errorInfo) => {
          // Could integrate with error reporting service here
          console.error('App Error:', error, errorInfo);
        }}
      >
        <div className="app-container">
          <Sidebar
            handleLogout={handleLogout}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
          />
          <main className="main-content" style={{ marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }}>
          <Suspense fallback={
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading component...</p>
            </div>
          }>
            <Routes>
            <Route path="/login" element={<LoginComponent />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/dynamic-users" element={<DynamicUserForm />} />
              <Route path="/import-export" element={<ImportExportEndUsers />} />
              <Route path="/edit-mappings" element={<RoleCourseMappingsEditor />} />
              <Route path="/pivot-report" element={<PivotReport />} />
              <Route path="/courses" element={<CoursesForm />} />
              <Route path="/import-export-courses" element={<ImportExportCourses />} />
              <Route path="/reference-data" element={<ReferenceDataManager />} />
              <Route path="/export-all-data" element={<ExportAllData />} />
              <Route path="/training-sessions" element={<TrainingSessionCalculator/>} />
              <Route path="/schedule-calendar" element={<TrainingSessionCalendar/>} /> 
              <Route path="/training-scheduler" element={<TSCWizard />} />
              <Route path="/schedule-manager" element={<ScheduleManager />} />
              <Route path="/trainers" element={<TrainerManagement />} />
              <Route path="/drag-drop-assignments" element={<DragDropAssignmentPage />} />
              <Route path="/stakeholder-calendar" element={<StakeholderCalendarPage />} />
              
              {/* User Management Routes */}
              <Route path="/user-management" element={<UserManagementDashboard />} />
              <Route path="/stakeholder-access" element={<StakeholderAccessManager />} />
              <Route path="/role-permissions" element={<RolePermissionsEditor />} />
            </Route>
            </Routes>
          </Suspense>
          </main>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
