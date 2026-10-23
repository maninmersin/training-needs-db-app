import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ErrorBoundary from '@core/components/ErrorBoundary';
import AppShell from '@core/components/shell/AppShell';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { LoginComponent, ProtectedRoute } from '@auth/components';
import { ModuleProvider } from '@core/contexts';
import { ProjectProvider } from '@core/contexts/ProjectContext';
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
const AdminDashboard = lazy(() => import('@auth/components/AdminDashboard'));

// Project Management Components
const ProjectSelectionDashboard = lazy(() => import('@modules/projects/components/ProjectSelectionDashboard'));


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
              <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
                <h2 className="text-lg font-semibold">Unauthorized Access</h2>
                <p className="text-sm text-muted-foreground">You don't have permission to access this resource.</p>
                <Button asChild variant="default"><a href="/login">Back to Login</a></Button>
              </div>
            } />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<ProjectSelectionDashboard />} />
              
              {/* Module Routes */}
              <Route path="/training" element={<Navigate to="/projects" replace />} />
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
