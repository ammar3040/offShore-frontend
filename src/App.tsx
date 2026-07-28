import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanelLayout from './components/AdminPanelLayout';
import CrewPanelLayout from './components/CrewPanelLayout';
import SuperadminPanelLayout from './components/SuperadminPanelLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedSuperadminRoute from './components/ProtectedSuperadminRoute';
import PageLoader from './components/PageLoader';
import { Toaster } from './components/ui/sonner';
import { applyAppTheme } from './lib/useAppTheme';
import './App.css';

applyAppTheme();

const CrewManagementDashboard = lazy(() => import('./pages/CrewManagementDashboard'));
const CrewListPage = lazy(() => import('./pages/CrewListPage'));
const CrewDetailsPage = lazy(() => import('./pages/CrewDetailsPage'));
const CrewMemberFormPage = lazy(() => import('./pages/CrewMemberFormPage'));
const CrewLogin = lazy(() => import('./pages/CrewLogin'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SuperadminLoginPage = lazy(() => import('./pages/SuperadminLoginPage'));
const CrewPanelDashboard = lazy(() => import('./pages/CrewPanelDashboard'));
const CrewEnrolledProjectsPage = lazy(() => import('./pages/CrewEnrolledProjectsPage'));
const CrewProfilePage = lazy(() => import('./pages/CrewProfilePage'));
const CrewSettingsPage = lazy(() => import('./pages/CrewSettingsPage'));
const CrewTicketsPage = lazy(() => import('./pages/CrewTicketsPage'));
const CrewTimesheetPage = lazy(() => import('./pages/CrewTimesheetPage'));
const CrewAvailabilityPage = lazy(() => import('./pages/CrewAvailabilityPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailsPage = lazy(() => import('./pages/ProjectDetailsPage'));
const RigsPage = lazy(() => import('./pages/RigsPage'));
const RigDetailsPage = lazy(() => import('./pages/RigDetailsPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const AdminTicketsPage = lazy(() => import('./pages/AdminTicketsPage'));
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard'));
const SuperadminAdminsPage = lazy(() => import('./pages/SuperadminAdminsPage'));
const SuperadminTicketsPage = lazy(() => import('./pages/SuperadminTicketsPage'));
const SuperadminAdminInvoicePage = lazy(() => import('./pages/SuperadminAdminInvoicePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const AdminBillsPage = lazy(() => import('./pages/AdminBillsPage'));
const DocumentsCertsPage = lazy(() => import('./pages/DocumentsCertsPage'));

function App() {
  return (
    <Router>
      <Toaster theme="light" richColors position="bottom-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/panel/superadmin/login" element={<SuperadminLoginPage />} />
          <Route
            path="/panel/superadmin"
            element={
              <ProtectedSuperadminRoute>
                <SuperadminPanelLayout />
              </ProtectedSuperadminRoute>
            }
          >
            <Route path="dashboard" element={<SuperadminDashboard />} />
            <Route path="admins" element={<SuperadminAdminsPage />} />
            <Route path="tickets" element={<SuperadminTicketsPage />} />
            <Route path="admin-invoice" element={<SuperadminAdminInvoicePage />} />
            <Route index element={<Navigate to="/panel/superadmin/dashboard" replace />} />
          </Route>

          <Route path="/crew/login" element={<CrewLogin redirectTo="/panel/crew/dashboard" />} />
          <Route
            path="/panel/crew/login"
            element={<CrewLogin redirectTo="/panel/crew/dashboard" />}
          />
          <Route path="/panel/crew" element={<CrewPanelLayout />}>
            <Route path="dashboard" element={<CrewPanelDashboard />} />
            <Route path="enrolled-projects" element={<CrewEnrolledProjectsPage />} />
            <Route path="profile" element={<CrewProfilePage />} />
            <Route path="settings" element={<CrewSettingsPage />} />
            <Route path="tickets" element={<CrewTicketsPage />} />
            <Route path="timesheet" element={<CrewTimesheetPage />} />
            <Route path="availability" element={<CrewAvailabilityPage />} />
            <Route index element={<Navigate to="/panel/crew/dashboard" replace />} />
          </Route>

          {/* Admin CRM — shared AppShell layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminPanelLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CrewManagementDashboard />} />
            <Route path="crew" element={<CrewListPage />} />
            <Route path="crew/add" element={<CrewMemberFormPage />} />
            <Route path="crew/edit/:crewId" element={<CrewMemberFormPage />} />
            <Route path="crew/:crewId" element={<CrewDetailsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
            <Route path="rig" element={<RigsPage />} />
            <Route path="rig/:rigId" element={<RigDetailsPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="bills" element={<AdminBillsPage />} />
            <Route path="documents" element={<DocumentsCertsPage />} />
            <Route path="crew/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
