import { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import AdminLoginPage from './AdminLoginPage';
import CrewLogin from './CrewLogin';
import './LoginPage.css';

type Role = 'admin' | 'crew';

const LoginPage = () => {
  const [role, setRole] = useState<Role>('admin');

  return (
    <div className="login-page">
      <div className="login-page-background" />
      <div className="login-page-card">
        <div className="login-page-role-switcher">
          <button
            type="button"
            className={`login-page-role-btn ${role === 'admin' ? 'active' : ''}`}
            onClick={() => setRole('admin')}
          >
            <Shield size={20} />
            Login as Admin
          </button>
          <button
            type="button"
            className={`login-page-role-btn ${role === 'crew' ? 'active' : ''}`}
            onClick={() => setRole('crew')}
          >
            <Users size={20} />
            Login as Crew
          </button>
        </div>
        {role === 'admin' ? (
          <AdminLoginPage embedded />
        ) : (
          <CrewLogin redirectTo="/panel/crew/dashboard" embedded />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
