import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@core/components';
import AppShell from '@core/components/shell/AppShell';
import { Loader2 } from 'lucide-react';
import { LoginComponent, ProtectedRoute } from '@auth/components';
import { ModuleProvider } from '@core/contexts';
import { ProjectProvider } from '@core/contexts/ProjectContext';
import './App.css';
import '@core/components/ErrorBoundary.css';
import '@modules/training/components/schedule-manager/ScheduleSelector.css';
import { supabase } from '@core/services';

// Lazy load heavy components
const UiKit = lazy(() => import('@/components/UiKit'));
const DynamicUserForm = lazy(() => import('@shared/components/DynamicUserForm'));
const RoleCourseMappingsEditor = lazy(() => import('@shared/components/RoleCourseMappingsEditor'));
const PivotReport = lazy(() => import('@shared/components/PivotReport'));
const CoursesForm = lazy(() => import('@shared/components/CoursesForm'));
const ImportExportTrainingData = lazy(() => import('@shared/components/ImportExportTrainingData'));
const ExportAllData = lazy(() => import('@shared/components/ExportAllData'));
const TrainingSessionCalculator = lazy(() => import('@modules/training/components/tsc-wizard/TrainingSessionCalculator'));
const TrainingSessionCalendar = lazy(() => import('@modules/training/components/calendar/TrainingSessionCalendar'));
const ScheduleCalendar = lazy(() => import('@modules/training/components/calendar/ScheduleCalendar'));
const TSCWizard = lazy(() => import('@modules/training/components/tsc-wizard/TSCWizard'));
const ScheduleManager = lazy(() => import('@modules/training/components/schedule-manager/ScheduleManager'));
const TrainerManagement = lazy(() => import('@shared/components/TrainerManagement'));
const DragDropAssignmentPage = lazy(() => import('@modules/training/components/assignments/DragDropAssignmentPage'));
const ReferenceDataManager = lazy(() => import('@shared/components/ReferenceDataManager'));

// Attendance Management Components
const AttendanceTracker = lazy(() => import('@modules/training/components/attendance/AttendanceTracker'));
const AttendanceReports = lazy(() => import('@modules/training/components/attendance/AttendanceReports'));
const AttendanceComplianceDashboard = lazy(() => import('@modules/training/components/attendance/AttendanceComplianceDashboard'));

// User management components
const UserManagementDashboard = lazy(() => import('@auth/components/UserManagementDashboard'));
const RolePermissionsEditor = lazy(() => import('@auth/components/RolePermissionsEditor'));

// Module Dashboards
const TrainingDashboard = lazy(() => import('@modules/training/components/TrainingDashboard'));
const AdminDashboard = lazy(() => import('@auth/components/AdminDashboard'));

// Project Management Components
const ProjectSelectionDashboard = lazy(() => import('@modules/projects/components/ProjectSelectionDashboard'));

import './index.css';

function App() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  };

  return (  
    <Router>
      <ModuleProvider>
        <ProjectProvider>
        <ErrorBoundary 
          onGoHome={() => window.location.href = '/'}
          onError={(error, errorInfo) => {
            // Could integrate with error reporting service here
            console.error('App Error:', error, errorInfo);
          }}
        >
          <AppShell onLogout={handleLogout}>
          <Suspense fallback={
            <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading component...
            </div>
          }>
            <Routes>
            <Route path="/login" element={<LoginComponent />} />
            <Route path="/unauthorized" element={
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Unauthorized Access</h2>
                <p>You don't have permission to access this resource.</p>
                <a href="/login" className="btn btn-primary" style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  marginTop: '1rem'
                }}>
                  Back to Login
                </a>
              </div>
            } />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<TrainingDashboard />} />
              <Route path="/projects" element={<ProjectSelectionDashboard />} />
              
              {/* Module Routes */}
              <Route path="/training" element={<TrainingDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />

              {/* Legacy routes maintained for backward compatibility */}
              <Route path="/dynamic-users" element={<DynamicUserForm />} />
              {/* Import/Export now lives on the End Users and Courses screens; these old links still work */}
              <Route path="/import-export" element={<Navigate to="/dynamic-users?import=people" replace />} />
              <Route path="/import-export-user-course-mappings" element={<Navigate to="/dynamic-users?import=assignments" replace />} />
              <Route path="/import-export-courses" element={<Navigate to="/courses?import=courses" replace />} />
              <Route path="/edit-mappings" element={<RoleCourseMappingsEditor />} />
              <Route path="/pivot-report" element={<PivotReport />} />
              {import.meta.env.DEV && <Route path="/ui-kit" element={<UiKit />} />}
              <Route path="/courses" element={<CoursesForm />} />
              <Route path="/import-export-training-data" element={<ImportExportTrainingData />} />
              <Route path="/reference-data" element={<ReferenceDataManager />} />
              <Route path="/export-all-data" element={<ExportAllData />} />
              <Route path="/training-sessions" element={<TrainingSessionCalculator/>} />
              <Route path="/schedule-calendar" element={<TrainingSessionCalendar/>} /> 
              <Route path="/training-scheduler" element={<TSCWizard />} />
              <Route path="/schedule-manager" element={<ScheduleManager />} />
              <Route path="/trainers" element={<TrainerManagement />} />
              <Route path="/drag-drop-assignments" element={<DragDropAssignmentPage />} />
              
              {/* Attendance Management Routes */}
              <Route path="/attendance-tracker" element={<AttendanceTracker />} />
              <Route path="/attendance-reports" element={<AttendanceReports />} />
              <Route path="/attendance-compliance" element={<AttendanceComplianceDashboard />} />
              
              {/* User Management Routes */}
              <Route path="/user-management" element={<UserManagementDashboard />} />
              <Route path="/role-permissions" element={<RolePermissionsEditor />} />
            </Route>
            </Routes>
          </Suspense>
          </AppShell>
        </ErrorBoundary>
        </ProjectProvider>
      </ModuleProvider>
    </Router>
  );
}

export default App;
