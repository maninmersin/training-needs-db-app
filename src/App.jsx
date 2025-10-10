import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { ModularSidebar, ErrorBoundary, Home, ModuleSwitcher, Breadcrumb, UserHeader } from '@core/components';
import { LoginComponent, ProtectedRoute } from '@auth/components';
import { ModuleProvider } from '@core/contexts';
import { ProjectProvider } from '@core/contexts/ProjectContext';
import './App.css';
import '@core/components/ErrorBoundary.css';
import '@modules/training/components/schedule-manager/ScheduleSelector.css';
import { supabase } from '@core/services';

// Lazy load heavy components
const DynamicUserForm = lazy(() => import('@shared/components/DynamicUserForm'));
const RoleCourseMappingsEditor = lazy(() => import('@shared/components/RoleCourseMappingsEditor'));
const ImportExportEndUsers = lazy(() => import('@shared/components/ImportExportEndUsers'));
const PivotReport = lazy(() => import('@shared/components/PivotReport'));
const CoursesForm = lazy(() => import('@shared/components/CoursesForm'));
const ImportExportCourses = lazy(() => import('@shared/components/ImportExportCourses'));
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
const StakeholderReferenceDataManager = lazy(() => import('@modules/stakeholders/components/StakeholderReferenceDataManager'));

// User management components
const UserManagementDashboard = lazy(() => import('@auth/components/UserManagementDashboard'));
const StakeholderAccessManager = lazy(() => import('@auth/components/StakeholderAccessManager'));
const RolePermissionsEditor = lazy(() => import('@auth/components/RolePermissionsEditor'));

// Module Dashboards
const TrainingDashboard = lazy(() => import('@modules/training/components/TrainingDashboard'));
const AdminDashboard = lazy(() => import('@auth/components/AdminDashboard'));
const OtherToolsDashboard = lazy(() => import('@modules/other-tools/components/OtherToolsDashboard'));

// Project Management Components
const ProjectSelectionDashboard = lazy(() => import('@modules/projects/components/ProjectSelectionDashboard'));

// Stakeholder Management Components
const StakeholderDashboard = lazy(() => import('@modules/stakeholders/components/StakeholderDashboard'));
const StakeholderDirectory = lazy(() => import('@modules/stakeholders/components/StakeholderDirectory'));
const InfluenceInterestMatrix = lazy(() => import('@modules/stakeholders/components/InfluenceInterestMatrix'));

// Impact Assessment Components
const ImpactAssessmentDashboard = lazy(() => import('@modules/impact-assessment/components/ImpactAssessmentDashboard'));
const AssessmentManager = lazy(() => import('@modules/impact-assessment/components/AssessmentManager'));
const AssessmentDetailView = lazy(() => import('@modules/impact-assessment/components/AssessmentDetailView'));
const ImpactAnalyticsDashboard = lazy(() => import('@modules/impact-assessment/components/analytics/ImpactAnalyticsDashboard'));
const StakeholderImpactCorrelationView = lazy(() => import('@modules/impact-assessment/components/StakeholderImpactCorrelationView'));
const ResponsibilityChangeTrackingDashboard = lazy(() => import('@modules/impact-assessment/components/ResponsibilityChangeTrackingDashboard'));
const RACIComparisonMatrices = lazy(() => import('@modules/impact-assessment/components/RACIComparisonMatrices'));

// Impact Assessment Setup Components
const ProcessHierarchyManager = lazy(() => import('@modules/impact-assessment/components/ProcessHierarchyManager'));
const ProcessHierarchyImportExport = lazy(() => import('@modules/impact-assessment/components/ProcessHierarchyImportExport'));
const ReferenceDataSetup = lazy(() => import('@modules/impact-assessment/components/ReferenceDataSetup'));

// Other Tools Pages
const POAPLandingPage = lazy(() => import('@modules/other-tools/pages/POAPLandingPage'));
const POAPTimelineEditor = lazy(() => import('@modules/other-tools/pages/POAPTimelineEditor'));

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

  // Add body class based on sidebar state for fixed positioned components
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
      document.body.classList.remove('sidebar-collapsed');
    } else {
      document.body.classList.add('sidebar-collapsed');
      document.body.classList.remove('sidebar-open');
    }
  }, [sidebarOpen]);

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
          <div className="app-container">
            <ModuleSwitcher />
            <div className="app-body">
              <ModularSidebar
                isOpen={sidebarOpen}
                onToggle={toggleSidebar}
              />
              <main className="main-content" style={{ marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }}>
                <UserHeader handleLogout={handleLogout} />
          <Suspense fallback={
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading component...</p>
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
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<ProjectSelectionDashboard />} />
              
              {/* Module Routes */}
              <Route path="/training" element={<TrainingDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/other-tools" element={<OtherToolsDashboard />} />
              <Route path="/other-tools/poap" element={<POAPLandingPage />} />
              <Route path="/other-tools/poap/editor" element={<POAPTimelineEditor />} />
              
              {/* Stakeholder Management Routes */}
              <Route path="/stakeholder-engagement" element={<StakeholderDashboard />} />
              <Route path="/stakeholder-directory" element={<StakeholderDirectory />} />
              <Route path="/influence-interest-matrix" element={<InfluenceInterestMatrix />} />
              <Route path="/stakeholder-reference-data" element={<StakeholderReferenceDataManager />} />
              
              {/* Impact Assessment Routes */}
              <Route path="/impact-assessment" element={<ImpactAssessmentDashboard />} />
              <Route path="/impact-assessment/manage" element={<AssessmentManager />} />
              <Route path="/impact-assessment/:assessmentId" element={<AssessmentDetailView />} />
              
              {/* Impact Analytics Routes */}
              <Route path="/impact-assessment/:assessmentId/analytics" element={<ImpactAnalyticsDashboard />} />
              <Route path="/impact-assessment/analytics" element={<ImpactAnalyticsDashboard />} />
              
              {/* RACI Analysis Routes */}
              <Route path="/impact-assessment/:assessmentId/stakeholder-correlation" element={<StakeholderImpactCorrelationView />} />
              <Route path="/impact-assessment/:assessmentId/responsibility-tracking" element={<ResponsibilityChangeTrackingDashboard />} />
              <Route path="/impact-assessment/:assessmentId/raci-comparison" element={<RACIComparisonMatrices />} />
              
              {/* Global RACI Analysis Routes (for all assessments) */}
              <Route path="/impact-assessment/stakeholder-correlation" element={<StakeholderImpactCorrelationView />} />
              <Route path="/impact-assessment/responsibility-tracking" element={<ResponsibilityChangeTrackingDashboard />} />
              <Route path="/impact-assessment/raci-comparison" element={<RACIComparisonMatrices />} />
              
              {/* Setup & Configuration Routes */}
              <Route path="/impact-assessment/setup/hierarchy" element={<ProcessHierarchyManager />} />
              <Route path="/impact-assessment/setup/hierarchy/:assessmentId" element={<ProcessHierarchyManager />} />
              <Route path="/impact-assessment/setup/import-export" element={<ProcessHierarchyImportExport />} />
              <Route path="/impact-assessment/setup/import-export/:assessmentId" element={<ProcessHierarchyImportExport />} />
              <Route path="/impact-assessment/setup/reference-data" element={<ReferenceDataSetup />} />
              
              {/* Legacy routes maintained for backward compatibility */}
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
              
              {/* Attendance Management Routes */}
              <Route path="/attendance-tracker" element={<AttendanceTracker />} />
              <Route path="/attendance-reports" element={<AttendanceReports />} />
              <Route path="/attendance-compliance" element={<AttendanceComplianceDashboard />} />
              
              {/* User Management Routes */}
              <Route path="/user-management" element={<UserManagementDashboard />} />
              <Route path="/stakeholder-access" element={<StakeholderAccessManager />} />
              <Route path="/role-permissions" element={<RolePermissionsEditor />} />
            </Route>
            </Routes>
          </Suspense>
          </main>
            </div>
          </div>
        </ErrorBoundary>
        </ProjectProvider>
      </ModuleProvider>
    </Router>
  );
}

export default App;
