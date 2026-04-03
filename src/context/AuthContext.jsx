// @ts-nocheck
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────
// The key we set in supabaseClient.js storageKey option.
const SUPABASE_STORAGE_KEY = 'techwheels-auth';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wipe every Supabase-related key from localStorage.
 * We do this synchronously on logout so it works even when offline.
 */
function nukeLocalSession() {
  try {
    // Our custom key
    window.localStorage.removeItem(SUPABASE_STORAGE_KEY);

    // Supabase also writes a key like "sb-<project-ref>-auth-token"
    // Find and remove any key that looks like a supabase auth token.
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        window.localStorage.removeItem(key);
      }
    });
  } catch (_) {
    // localStorage may be blocked in some environments — ignore
  }
}

/**
 * Fetches the employee record linked to a Supabase auth user.
 * Returns { data, notFound, error } so callers can distinguish
 * between "record missing" and a real db/network error.
 */
async function fetchEmployee(userId) {
  if (!userId) return { data: null, notFound: false, error: null };

  const { data, error } = await supabase
    .from('employees')
    .select(`
      id, first_name, last_name, email, mobile,
      department_id, location_id, role_id, is_super_admin,
      departments:department_id ( id, name, code ),
      locations:location_id ( id, name )
    `)
    .eq('auth_user_id', userId)
    .eq('employee_status', 'active')
    .maybeSingle(); // returns null (not error) when no row found

  if (error) {
    console.error('[Auth] fetchEmployee db error:', error.message);
    return { data: null, notFound: false, error };
  }

  return { data, notFound: data === null, error: null };
}

// ─── Role logic ───────────────────────────────────────────────────────────────
const USED_CAR_DEPT_ID = 13;
const USED_CAR_ROLE_ID = 6;

function deriveIsUsedCarDept(employee) {
  if (!employee) return false;
  return (
    Number(employee.department_id) === USED_CAR_DEPT_ID ||
    Number(employee.role_id) === USED_CAR_ROLE_ID ||
    employee.is_super_admin === true ||
    employee.is_super_admin === 'true' ||
    employee.is_super_admin === 1
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [session, setSession]           = useState(null);
  const [user, setUser]                 = useState(null);
  const [employee, setEmployee]         = useState(null);
  const [loading, setLoading]           = useState(true);
  // 'idle' | 'loading' | 'found' | 'not_found' | 'error'
  const [employeeStatus, setEmployeeStatus] = useState('idle');

  // ── Load employee ──────────────────────────────────────────────────────────
  const loadEmployee = useCallback(async (userId) => {
    if (!userId) {
      setEmployee(null);
      setEmployeeStatus('idle');
      return;
    }

    setEmployeeStatus('loading');

    const { data, notFound, error } = await fetchEmployee(userId);

    if (error) {
      setEmployee(null);
      setEmployeeStatus('error');
      return;
    }
    if (notFound) {
      setEmployee(null);
      setEmployeeStatus('not_found');
      console.warn('[Auth] No active employee record for this user.');
      return;
    }

    setEmployee(data);
    setEmployeeStatus('found');
  }, []);

  // ── Session initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.error('[Auth] getSession error:', error.message);
          nukeLocalSession();
          setSession(null);
          setUser(null);
          setEmployee(null);
          setEmployeeStatus('idle');
          return;
        }

        const nextSession = data?.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        // Load employee before clearing loading state
        if (nextSession?.user) {
          await loadEmployee(nextSession.user.id);
        }
      })
      .catch((err) => {
        console.error('[Auth] Unexpected init error:', err);
        if (mounted) {
          nukeLocalSession();
          setSession(null);
          setUser(null);
          setEmployee(null);
          setEmployeeStatus('idle');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // ── Auth state listener ──────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;

        // TOKEN_REFRESHED is silent — just update session, no employee re-fetch needed
        if (event === 'TOKEN_REFRESHED') {
          setSession(nextSession);
          return;
        }

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (!nextSession?.user) {
          setEmployee(null);
          setEmployeeStatus('idle');
          setLoading(false);
          return;
        }

        // Only re-fetch employee on real sign-in events
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await loadEmployee(nextSession.user.id);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadEmployee]);

  // ── signIn ─────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    if (error) throw error;
    return data;
  }, []);

  // ── signUp ─────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  // ── signOut ────────────────────────────────────────────────────────────────
  // KEY DESIGN: clear local state FIRST so the UI reacts immediately.
  // The network call is fire-and-forget — logout always works even offline.
  const signOut = useCallback(async () => {
    // Step 1: Wipe localStorage synchronously — works even if Supabase is down
    nukeLocalSession();

    // Step 2: Clear React state immediately so ProtectedRoute redirects at once
    if (isMounted.current) {
      setSession(null);
      setUser(null);
      setEmployee(null);
      setEmployeeStatus('idle');
      setLoading(false);
    }

    // Step 3: Best-effort server-side invalidation — don't await, don't throw
    supabase.auth.signOut({ scope: 'local' }).catch((err) => {
      console.warn('[Auth] Server signout failed (offline?):', err?.message);
    });
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isUsedCarDept = deriveIsUsedCarDept(employee);
  const employeeName  = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    : '';
  const branchName = employee?.locations?.name || '';

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    session,
    user,
    loading,
    isAuthenticated: !!user,

    employee,
    employeeStatus,   // use this in UI: 'not_found' → show UserNotRegisteredError
    isUsedCarDept,
    employeeName,
    branchName,

    signIn,
    signUp,
    signOut,
  }), [
    session, user, loading,
    employee, employeeStatus, isUsedCarDept, employeeName, branchName,
    signIn, signUp, signOut,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}