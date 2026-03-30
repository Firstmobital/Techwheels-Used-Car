import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLoadingScreen from '@/components/AuthLoadingScreen';

const POST_LOGIN_REDIRECT_KEY = 'tw_post_login_redirect';

export default function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    const intendedPath = `${location.pathname}${location.search}${location.hash}`;
    if (intendedPath && intendedPath !== '/login' && intendedPath !== '/signup') {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, intendedPath);
    }

    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
