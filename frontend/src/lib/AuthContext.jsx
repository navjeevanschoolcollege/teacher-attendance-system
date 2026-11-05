import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchTeacherProfile(currentSession.user.email);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchTeacherProfile(newSession.user.email);
        } else {
          setTeacherProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchTeacherProfile(email) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.error('Error fetching teacher profile:', error);
        setRole(null);
        setTeacherProfile(null);
      } else {
        setTeacherProfile(data);
        setRole(data.role || 'teacher');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return { success: false, error: error.message };
      }

      toast.success('Login successful!');
      return { success: true, data };
    } catch (err) {
      toast.error('An unexpected error occurred');
      return { success: false, error: err.message };
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setTeacherProfile(null);
      setRole(null);
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error('Error logging out');
    }
  }

  const value = {
    user,
    session,
    teacherProfile,
    role,
    loading,
    login,
    logout,
    refreshProfile: () => user?.email && fetchTeacherProfile(user.email),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRole && role !== allowedRole) {
    const redirectPath = role === 'admin' ? '/admin' : '/teacher';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

export default AuthContext;
