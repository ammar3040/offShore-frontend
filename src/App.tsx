import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CrewPanelLayout from './components/CrewPanelLayout';
import ProtectedRoute from './components/ProtectedRoute';
import CrewManagementDashboard from './pages/CrewManagementDashboard';
import CrewListPage from './pages/CrewListPage';
import CrewLogin from './pages/CrewLogin';
import LoginPage from './pages/LoginPage';
import CrewPanelDashboard from './pages/CrewPanelDashboard';
import ProjectsPage from './pages/ProjectsPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Unified login - choose Admin or Crew */}
        <Route path="/login" element={<LoginPage />} />

        {/* Crew portal login (no sidebar layout) */}
        <Route path="/crew/login" element={<CrewLogin redirectTo="/panel/crew/dashboard" />} />

        {/* Crew panel - detached from admin, own URL space */}
        <Route
          path="/panel/crew/login"
          element={<CrewLogin redirectTo="/panel/crew/dashboard" />}
        />
        <Route
          path="/panel/crew/dashboard"
          element={
            <CrewPanelLayout>
              <CrewPanelDashboard />
            </CrewPanelLayout>
          }
        />

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
                <Route path="/leads" element={<div>Leads</div>} />
                <Route path="/people" element={<div>People</div>} />
                <Route path="/companies" element={<div>Companies</div>} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/schedule" element={<div>Schedule</div>} />
                <Route path="/settings" element={<div>Settings</div>} />
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
