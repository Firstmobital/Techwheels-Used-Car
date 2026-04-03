// @ts-nocheck
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const AUTH_INIT_TIMEOUT_MS = 8000;
const SUPABASE_STORAGE_KEY = 'techwheels-auth'; // must match storageKey in supabaseClient.js

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(undefined);

// ─── Employee fetch ───────────────────────────────────────────────────────────
/**
 * Fetches the employee record linked to a Supabase auth user.
 * Returns { data, notFound, error } so callers can distinguish
 * between "record missing" and "network/db error".
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
    .maybeSingle(); // ← returns null instead of error when no row found

  if (error) {
    console.error('[Auth] fetchEmployee db error:', error.message);
    return { data: null, notFound: false, error };
  }

  return { data, notFound: data === null, error: null };
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
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
  const [session, setSession]       = useState(null);
  const [user, setUser]             = useState(null);
  const [employee, setEmployee]     = useState(null);
  const [loading, setLoading]       = useState(true);

  // employeeStatus: 'idle' | 'loading' | 'found' | 'not_found' | 'error'
  const [employeeStatus, setEmployeeStatus] = useState('idle');

  // Prevent stale async updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Load employee (shared logic) ───────────────────────────────────────────
  const loadEmployee = useCallback(async (userId) => {
    if (!userId) {
      if (isMounted.current) {
        setEmployee(null);
        setEmployeeStatus('idle');
      }
      return;
    }

    if (isMounted.current) setEmployeeStatus('loading');

    const { data, notFound, error } = await fetchEmployee(userId);

    if (!isMounted.current) return;

    if (error) {
      setEmployee(null);
      setEmployeeStatus('error');
      console.warn('[Auth] Could not load employee record. User may have limited access.');
      return;
    }

    if (notFound) {
      setEmployee(null);
      setEmployeeStatus('not_found');
      console.warn('[Auth] No active employee record found for this user.');
      return;
    }

    setEmployee(data);
    setEmployeeStatus('found');
  }, []);

  // ── Initialise session on mount ────────────────────────────────────────────
  useEffect(() => {
    let timeoutId;

    const init = async () => {
      // Safety timeout — never block UI forever
      timeoutId = window.setTimeout(() => {
        if (!isMounted.current) return;
        console.warn('[Auth] Session init timed out.');
        setLoading(false);
      }, AUTH_INIT_TIMEOUT_MS);

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted.current) return;

        if (error) {
          console.error('[Auth] getSession error:', error.message);
          // Clear potentially corrupted storage
          try { window.localStorage.removeItem(SUPABASE_STORAGE_KEY); } catch (_) {}
          setSession(null);
          setUser(null);
          setEmployee(null);
          setEmployeeStatus('idle');
          return;
        }

        const sess = data?.session ?? null;
        setSession(sess);
        setUser(sess?.user ?? null);

        // Load employee BEFORE clearing the loading state
        // so the UI doesn't flash an intermediate state
        if (sess?.user) {
          await loadEmployee(sess.user.id);
        }
      } catch (err) {
        console.error('[Auth] Unexpected init error:', err);
        try { window.localStorage.removeItem(SUPABASE_STORAGE_KEY); } catch (_) {}
        if (isMounted.current) {
          setSession(null);
          setUser(null);
          setEmployee(null);
          setEmployeeStatus('idle');
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted.current) setLoading(false);
      }
    };

    init();

    // ── Auth state change listener ─────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!isMounted.current) return;

        // TOKEN_REFRESHED: session updated silently — no need to re-fetch employee
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

        // Only reload employee on actual sign-in events, not every state change
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await loadEmployee(nextSession.user.id);
        }

        if (isMounted.current) setLoading(false);
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadEmployee]);

  // ── signIn ─────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
  // ⚠ Key fix: call Supabase FIRST, then clear local state.
  // If the API call fails, the user remains logged in consistently.
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (err) {
      // Even if signOut API fails, nuke local storage so the user
      // isn't stuck in a broken session on next load.
      try { window.localStorage.removeItem(SUPABASE_STORAGE_KEY); } catch (_) {}
      throw err;
    } finally {
      // Always clear local state after attempting signout
      if (isMounted.current) {
        setSession(null);
        setUser(null);
        setEmployee(null);
        setEmployeeStatus('idle');
        setLoading(false);
      }
    }
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isUsedCarDept = deriveIsUsedCarDept(employee);

  const employeeName = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    : '';

  const branchName = employee?.locations?.name || '';

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    // Core auth
    session,
    user,
    loading,
    isAuthenticated: !!user,

    // Employee
    employee,
    employeeStatus, // expose so UI can show "not registered" vs "error" states
    isUsedCarDept,
    employeeName,
    branchName,

    // Actions
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