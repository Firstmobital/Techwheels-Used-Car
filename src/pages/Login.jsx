// @ts-nocheck
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

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

export default function Login() {
  const { signIn, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = getRedirectPath(location);

  if (!loading && isAuthenticated) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to login. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to access Techwheels dashboard.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-sm text-gray-600">
          No account?{' '}
          <Link className="font-semibold text-orange-600 hover:text-orange-700" to="/signup">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
