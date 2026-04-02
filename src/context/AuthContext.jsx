// @ts-nocheck
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (error) {
      console.error('Error fetching employee:', error.message);
      return null;
    }
    return data;
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) console.error('Error loading session:', error.message);

      const sess = data?.session ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        const emp = await fetchEmployee(sess.user.id);
        if (isMounted) setEmployee(emp);
      }
      if (isMounted) setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        const emp = await fetchEmployee(nextSession.user.id);
        setEmployee(emp);
      } else {
        setEmployee(null);
      }
      setLoading(false);
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // Full access: dept 13 (Used Cars) OR role_id 6 (Admin) OR is_super_admin
  const isUsedCarDept =
    employee?.department_id === 13 ||
    employee?.role_id === 6 ||
    employee?.is_super_admin === true;

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