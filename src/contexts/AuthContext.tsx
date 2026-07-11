import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';

const IDLE_TIMEOUT_MS = parseInt(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || '30') * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before logout

type AppUser = { email: string; id: string; role: string; name?: string };

type AuthContextType = {
  session: any;
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string, turnstileToken?: string) => Promise<{ error: string | null; step?: string; userId?: string; message?: string; debugOtp?: string }>;
  signUp: (email: string, password: string, name?: string, turnstileToken?: string) => Promise<{ error: string | null; step?: string; userId?: string; message?: string; debugOtp?: string }>;
  verifyLogin: (userId: string, otp: string) => Promise<{ error: string | null }>;
  verifyEmail: (userId: string, otp: string) => Promise<{ error: string | null }>;
  resendOTP: (userId: string, purpose: 'verify' | 'login' | 'reset-password') => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updatedUser: any) => void;
  // Idle timer state
  idleWarning: boolean;
  resetIdleTimer: () => void;
  brandName: string;
  brandLogo: string;
  refreshBrandConfig: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const API_URL = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const [brandName, setBrandName] = useState('DomainWhois');
  const [brandLogo, setBrandLogo] = useState('');

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session on mount
  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setUser(data.user);
      } else {
        localStorage.removeItem('auth_token');
        setSession(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      localStorage.removeItem('auth_token');
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // ─── Idle Logout Timer ──────────────────────────────────────────────────────
  const doSignOut = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch(`${API_URL}/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
    } catch (e) {
      console.error('Sign out error:', e);
    }
    localStorage.removeItem('auth_token');
    setSession(null);
    setUser(null);
    setIdleWarning(false);
  }, []);

  const resetIdleTimer = useCallback(() => {
    setIdleWarning(false);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);

    const warnDelay = Math.max(0, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    warnTimer.current = setTimeout(() => {
      setIdleWarning(true);
    }, warnDelay);

    idleTimer.current = setTimeout(() => {
      doSignOut();
    }, IDLE_TIMEOUT_MS);
  }, [doSignOut]);

  // Attach activity listeners when user is logged in
  useEffect(() => {
    if (!user) {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handleActivity = () => resetIdleTimer();
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, resetIdleTimer]);

  const refreshBrandConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.brandName) setBrandName(data.brandName);
        if (data.brandLogo !== undefined) setBrandLogo(data.brandLogo || '');
      }
    } catch (err) {
      console.error('Failed to fetch brand config:', err);
    }
  }, []);

  useEffect(() => {
    refreshBrandConfig();
  }, [refreshBrandConfig]);

  // ─── Auth Actions via Local REST API ─────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken })
      });
      const data = await res.json();
      if (!res.ok) {
        // Handle unverified user login redirect trigger (403 from sign-in)
        if (res.status === 403 && data.step === 'otp-verify') {
          return { error: data.error, step: 'otp-verify', userId: data.userId, message: data.message || data.error, debugOtp: data.debugOtp };
        }
        return { error: data.error || 'Login gagal' };
      }
      return { 
        error: null, 
        step: data.step, 
        userId: data.userId, 
        message: data.message,
        debugOtp: data.debugOtp
      };
    } catch (err: any) {
      return { error: err.message || 'Login gagal' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string, turnstileToken?: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, turnstileToken })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Pendaftaran gagal' };
      }
      return { 
        error: null, 
        step: data.step, 
        userId: data.userId, 
        message: data.message,
        debugOtp: data.debugOtp
      };
    } catch (err: any) {
      return { error: err.message || 'Pendaftaran gagal' };
    }
  }, []);

  const verifyLogin = useCallback(async (userId: string, otp: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Verifikasi login gagal' };
      }
      localStorage.setItem('auth_token', data.session.token);
      setSession(data.session);
      setUser(data.user);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Verifikasi login gagal' };
    }
  }, []);

  const verifyEmail = useCallback(async (userId: string, otp: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Verifikasi email gagal' };
      }
      localStorage.setItem('auth_token', data.session.token);
      setSession(data.session);
      setUser(data.user);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Verifikasi email gagal' };
    }
  }, []);

  const resendOTP = useCallback(async (userId: string, purpose: 'verify' | 'login' | 'reset-password') => {
    try {
      const res = await fetch(`${API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, purpose })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Gagal mengirim ulang OTP' };
      }
      return { error: null, message: data.message };
    } catch (err: any) {
      return { error: err.message || 'Gagal mengirim ulang OTP' };
    }
  }, []);

  const signOut = useCallback(async () => { await doSignOut(); }, [doSignOut]);

  const updateUser = useCallback((updatedUser: any) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : null);
  }, []);

  return (
    <AuthContext.Provider value={{
      session, user, loading,
      signIn, signUp, verifyLogin, verifyEmail, resendOTP, signOut,
      updateUser,
      idleWarning, resetIdleTimer,
      brandName, brandLogo, refreshBrandConfig
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
