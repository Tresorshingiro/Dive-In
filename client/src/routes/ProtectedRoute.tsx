import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ROLE_HOME, type Role } from '@dive/shared';
import { useAuth } from '../context/AuthContext';

/** Client-side guard for UX only — the API enforces every permission itself. */
export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-line-3 border-t-gold" aria-label="Loading" />
      </div>
    );
  if (!user) return <Navigate to={roles.includes('ADMIN') ? '/admin/login' : '/login'} replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/account/password" replace />;
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <>{children}</>;
}
