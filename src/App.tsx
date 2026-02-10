import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CrewManagementDashboard from './pages/CrewManagementDashboard';
import CrewLogin from './pages/CrewLogin';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Crew panel - login screen (no sidebar layout) */}
        <Route path="/crew" element={<CrewLogin />} />
        <Route path="/crew/login" element={<CrewLogin />} />

        {/* Crew dashboard - after login (with layout) */}
        <Route
          path="/crew/dashboard"
          element={
            <Layout>
              <CrewManagementDashboard />
            </Layout>
          }
        />

        {/* Main app routes (with layout) */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<CrewManagementDashboard />} />
                <Route path="/leads" element={<div>Leads</div>} />
                <Route path="/people" element={<div>People</div>} />
                <Route path="/companies" element={<div>Companies</div>} />
                <Route path="/projects" element={<div>Projects</div>} />
                <Route path="/schedule" element={<div>Schedule</div>} />
                <Route path="/settings" element={<div>Settings</div>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
