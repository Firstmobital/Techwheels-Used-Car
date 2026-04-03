// @ts-nocheck
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(undefined);
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_STORAGE_KEY = 'techwheels-auth';

const asNumber = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const asTrue = (value) => {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

const fetchEmployee = async (userId) => {
  if (!userId) return null;
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
    .single();
  if (error) { console.error('Error fetching employee:', error.message); return null; }
  return data;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      console.warn('Auth session initialization timed out. Proceeding without blocking UI.');
      setLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    const init = async () => {
      let sess = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) {
          console.error('Error loading session:', error.message);
        }

        sess = data?.session ?? null;
        setSession(sess);
        setUser(sess?.user ?? null);
      } catch (error) {
        if (!isMounted) return;
        console.error('Unexpected error while initializing auth session:', error);
        try {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch (storageError) {
          console.error('Failed to clear stale auth storage:', storageError);
        }
        setSession(null);
        setUser(null);
        setEmployee(null);
      } finally {
        if (isMounted) {
          window.clearTimeout(timeoutId);
          setLoading(false);
        }
      }

      if (!sess?.user || !isMounted) {
        if (isMounted) setEmployee(null);
        return;
      }

      try {
        const emp = await fetchEmployee(sess.user.id);
        if (isMounted) setEmployee(emp);
      } catch (error) {
        console.error('Error fetching employee after session init:', error);
        if (isMounted) setEmployee(null);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (!nextSession?.user) {
        setEmployee(null);
        return;
      }

      try {
        const emp = await fetchEmployee(nextSession.user.id);
        if (isMounted) setEmployee(emp);
      } catch (error) {
        console.error('Error handling auth state change:', error);
        if (isMounted) setEmployee(null);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    setUser(null);
    setEmployee(null);
    setLoading(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (storageError) {
        console.error('Failed to clear auth storage during sign out:', storageError);
      }
      throw error;
    }
  }, []);

  const employeeDepartmentId = asNumber(employee?.department_id);
  const employeeRoleId = asNumber(employee?.role_id);
  const employeeSuperAdmin = asTrue(employee?.is_super_admin);

  const metadata = user?.app_metadata || user?.user_metadata || {};
  const metadataDepartmentId = asNumber(metadata.department_id ?? metadata.departmentId);
  const metadataRoleId = asNumber(metadata.role_id ?? metadata.roleId);
  const metadataRole = String(metadata.role ?? metadata.user_role ?? '').toLowerCase();
  const metadataSuperAdmin =
    asTrue(metadata.is_super_admin) ||
    asTrue(metadata.super_admin) ||
    metadataRole === 'admin' ||
    metadataRole === 'super_admin';

  const isUsedCarDept =
    employeeDepartmentId === 13 ||
    employeeRoleId === 6 ||
    employeeSuperAdmin ||
    metadataDepartmentId === 13 ||
    metadataRoleId === 6 ||
    metadataSuperAdmin;

  const employeeName = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    : '';

  const branchName = employee?.locations?.name || '';

  const value = useMemo(() => ({
    session, user, employee, loading,
    isAuthenticated: !!user,
    isUsedCarDept,
    employeeName,
    branchName,
    signIn, signUp, signOut,
  }), [loading, session, user, employee, isUsedCarDept, employeeName, branchName, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}