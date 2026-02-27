import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CrewPanelLayout from './components/CrewPanelLayout';
import SuperadminPanelLayout from './components/SuperadminPanelLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedSuperadminRoute from './components/ProtectedSuperadminRoute';
import CrewManagementDashboard from './pages/CrewManagementDashboard';
import CrewListPage from './pages/CrewListPage';
import CrewLogin from './pages/CrewLogin';
import LoginPage from './pages/LoginPage';
import SuperadminLoginPage from './pages/SuperadminLoginPage';
import CrewPanelDashboard from './pages/CrewPanelDashboard';
import CrewEnrolledProjectsPage from './pages/CrewEnrolledProjectsPage';
import CrewProfilePage from './pages/CrewProfilePage';
import CrewSettingsPage from './pages/CrewSettingsPage';
import CrewTicketsPage from './pages/CrewTicketsPage';
import CrewTimesheetPage from './pages/CrewTimesheetPage';
import CrewAvailabilityPage from './pages/CrewAvailabilityPage';
import ProjectsPage from './pages/ProjectsPage';
import AdminTicketsPage from './pages/AdminTicketsPage';
import SuperadminDashboard from './pages/SuperadminDashboard';
import SuperadminAdminsPage from './pages/SuperadminAdminsPage';
import SuperadminTicketsPage from './pages/SuperadminTicketsPage';
import './App.css';

function App() {
  return (
    <Router>
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
                <Route path="/leads" element={<div className="page-placeholder">Leads — Coming soon</div>} />
                <Route path="/people" element={<div className="page-placeholder">People</div>} />
                <Route path="/companies" element={<div className="page-placeholder">Companies</div>} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/tickets" element={<AdminTicketsPage />} />
                <Route path="/schedule" element={<div className="page-placeholder">Schedule</div>} />
                <Route path="/settings" element={<div className="page-placeholder">Settings</div>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
