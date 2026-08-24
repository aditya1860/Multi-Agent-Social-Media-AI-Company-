import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, BASE_URL } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: 'PATIENT' | 'DOCTOR';
  phone?: string;
}

const DEMO_USERS: Record<string, User> = {
  'patient@vitalis.app': {
    id: 'demo-patient-id',
    name: 'Alex Johnson',
    email: 'patient@vitalis.app',
    role: 'PATIENT',
  },
  'dr.smith@vitalis.app': {
    id: 'demo-doctor-id',
    name: 'Dr. Emily Smith',
    email: 'dr.smith@vitalis.app',
    role: 'DOCTOR',
  },
  'admin@vitalis.app': {
    id: 'demo-admin-id',
    name: 'Clinic Admin',
    email: 'admin@vitalis.app',
    role: 'ADMIN',
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('demoUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setLoading(false);
        return;
      } catch {}
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.clear();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem('demoUser');
      setUser(data.user);
    } catch (err: any) {
      // Check if this is a demo account and backend is offline/sleeping
      const lowerEmail = email.toLowerCase().trim();
      if ((!err.response || err.code === 'ERR_NETWORK') && DEMO_USERS[lowerEmail]) {
        console.warn(`[Auth] Backend at ${BASE_URL} unreachable. Logging in with Demo Mode for ${lowerEmail}.`);
        const demoUser = DEMO_USERS[lowerEmail];
        localStorage.setItem('accessToken', 'demo-access-token');
        localStorage.setItem('refreshToken', 'demo-refresh-token');
        localStorage.setItem('demoUser', JSON.stringify(demoUser));
        setUser(demoUser);
        return;
      }

      if (!err.response) {
        throw new Error(`Cannot connect to backend API at "${BASE_URL}". Please check VITE_API_URL in Vercel.`);
      }
      throw err;
    }
  };

  const register = async (formData: RegisterData) => {
    try {
      const { data } = await api.post('/auth/register', formData);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem('demoUser');
      setUser(data.user);
    } catch (err: any) {
      if (!err.response) {
        throw new Error(`Cannot connect to backend API at "${BASE_URL}". Please check VITE_API_URL in Vercel.`);
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
