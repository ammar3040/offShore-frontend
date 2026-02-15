import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { hasAccessToken } from '../lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/** Redirects to /login when no valid admin token. */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  if (!hasAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
