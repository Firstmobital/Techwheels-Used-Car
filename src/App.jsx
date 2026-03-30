import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AuthLoadingScreen from '@/components/AuthLoadingScreen';
import Home from './pages/Home';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';

const POST_LOGIN_REDIRECT_KEY = 'tw_post_login_redirect';

function getRedirectPath(location) {
  const statePath = location.state?.from?.pathname;
  const stateSearch = location.state?.from?.search ?? '';
  const stateHash = location.state?.from?.hash ?? '';
  const rememberedPath = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  const target = (statePath ? `${statePath}${stateSearch}${stateHash}` : rememberedPath) || '/Home';

  if (target === '/login' || target === '/signup') {
    return '/Home';
  }

  return target;
}

function PublicOnlyRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to={getRedirectPath(location)} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route
          path="/login"
          element={(
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          )}
        />
        <Route
          path="/signup"
          element={(
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          )}
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/Home" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
