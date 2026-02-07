import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CrewManagementDashboard from './pages/CrewManagementDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<CrewManagementDashboard />} />
          <Route path="/crew" element={<CrewManagementDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
