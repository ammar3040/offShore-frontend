import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CrewPanelLayout from './components/CrewPanelLayout';
import SuperadminPanelLayout from './components/SuperadminPanelLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedSuperadminRoute from './components/ProtectedSuperadminRoute';
import PageLoader from './components/PageLoader';
import './App.css';

const CrewManagementDashboard = lazy(() => import('./pages/CrewManagementDashboard'));
const CrewListPage = lazy(() => import('./pages/CrewListPage'));
const CrewDetailsPage = lazy(() => import('./pages/CrewDetailsPage'));
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
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const AdminTicketsPage = lazy(() => import('./pages/AdminTicketsPage'));
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard'));
const SuperadminAdminsPage = lazy(() => import('./pages/SuperadminAdminsPage'));
const SuperadminTicketsPage = lazy(() => import('./pages/SuperadminTicketsPage'));
const SuperadminAdminInvoicePage = lazy(() => import('./pages/SuperadminAdminInvoicePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const AdminBillsPage = lazy(() => import('./pages/AdminBillsPage'));

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Unified login - choose Admin, Crew, or Superadmin */}
          <Route path="/login" element={<LoginPage />} />

          {/* Superadmin portal */}
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

          {/* Crew portal login (no sidebar layout) */}
          <Route path="/crew/login" element={<CrewLogin redirectTo="/panel/crew/dashboard" />} />

          {/* Crew panel - detached from admin, own URL space */}
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

          {/* Crew dashboard - after crew login (with layout) */}
          <Route
            path="/crew/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <CrewManagementDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Main app routes (with layout) */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<CrewManagementDashboard />} />
                    <Route path="/crew" element={<CrewListPage />} />
                    <Route path="/crew/:crewId" element={<CrewDetailsPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
                    <Route path="/rig" element={<RigsPage />} />
                    <Route path="/timeline" element={<TimelinePage />} />
                    <Route path="/tickets" element={<AdminTicketsPage />} />
                    <Route path="/payroll" element={<PayrollPage />} />
                    <Route path="/contracts" element={<ContractsPage />} />
                    <Route path="/bills" element={<AdminBillsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
