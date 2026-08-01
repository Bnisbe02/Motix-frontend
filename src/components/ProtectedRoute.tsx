import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function isEmailAllowed(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;

  if (!allowedEmailsEnv || allowedEmailsEnv.trim() === '') {
    return true;
  }

  const allowedEmails = allowedEmailsEnv
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

  return allowedEmails.includes(email.toLowerCase());
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#4131e0] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  if (isAuthenticated && !isEmailAllowed(user?.email)) {
    return <Navigate to="/app/access-pending" replace />;
  }

  return <>{children}</>;
}
