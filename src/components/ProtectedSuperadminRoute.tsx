import { Navigate } from 'react-router-dom';
import { hasSuperadminAccessToken } from '../lib/superadminAuth';

/** Redirects to /panel/superadmin/login when no valid superadmin token. */
const ProtectedSuperadminRoute = ({ children }: { children: React.ReactNode }) => {
  if (!hasSuperadminAccessToken()) {
    return <Navigate to="/panel/superadmin/login" replace />;
  }
  return <>{children}</>;
};

export default ProtectedSuperadminRoute;
