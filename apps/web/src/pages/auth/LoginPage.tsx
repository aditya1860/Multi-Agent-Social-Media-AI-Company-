import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Stethoscope, Mail, Lock, AlertCircle, UserCheck, ShieldCheck, HeartPulse, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});
type FormData = z.infer<typeof schema>;

type PortalTab = 'PATIENT' | 'DOCTOR' | 'ADMIN';

const PORTAL_CONFIG = {
  PATIENT: {
    label: 'Patient',
    icon: HeartPulse,
    sub: 'Sign in to view appointment schedule, care plans & summaries',
    demoEmail: 'patient@vitalis.app',
    demoPass: 'Patient@123',
  },
  DOCTOR: {
    label: 'Doctor',
    icon: UserCheck,
    sub: 'Sign in to access patient clinical briefs & submit visit notes',
    demoEmail: 'dr.smith@vitalis.app',
    demoPass: 'Doctor@123',
  },
  ADMIN: {
    label: 'Admin',
    icon: ShieldCheck,
    sub: 'Sign in to manage clinic profiles, schedules & notifications',
    demoEmail: 'admin@vitalis.app',
    demoPass: 'Admin@123',
  },
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [activePortal, setActivePortal] = useState<PortalTab>('PATIENT');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      const message =
        err?.message ||
        err?.response?.data?.error ||
        'Login failed. Please check your credentials and try again.';
      setError('root', { message });
    }
  };

  const handlePortalSwitch = (portal: PortalTab) => {
    setActivePortal(portal);
    setValue('email', PORTAL_CONFIG[portal].demoEmail);
    setValue('password', PORTAL_CONFIG[portal].demoPass);
  };

  const activeConfig = PORTAL_CONFIG[activePortal];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-card-lg w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6FE0D0] to-[#1F9E93] flex items-center justify-center mb-4"
            style={{
              boxShadow:
                'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 6px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Stethoscope size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Vitalis Portal</h1>
          <p className="text-slate-500 text-sm mt-1 text-center">{activeConfig.sub}</p>
        </div>

        {/* Portal Visual Selector Tabs */}
        <div className="bg-white/60 p-1.5 rounded-2xl flex gap-1 mb-6 border border-white/60 shadow-inner">
          {(['PATIENT', 'DOCTOR', 'ADMIN'] as PortalTab[]).map((portal) => {
            const config = PORTAL_CONFIG[portal];
            const Icon = config.icon;
            const isActive = activePortal === portal;
            return (
              <button
                key={portal}
                type="button"
                onClick={() => handlePortalSwitch(portal)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-card'
                    : 'text-slate-600 hover:bg-white/80 hover:text-slate-800'
                }`}
              >
                <Icon size={14} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
              <AlertCircle size={16} /> {errors.root.message}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full pl-9 pr-11 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-card"
          >
            {isSubmitting ? 'Signing in…' : `Sign in as ${activeConfig.label}`}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don’t have an account?{' '}
          <Link to="/register" className="text-primary-500 font-medium hover:underline">
            Create one
          </Link>
        </p>

        <div className="mt-6 p-4 rounded-xl bg-white/40 text-xs text-slate-500">
          <p className="font-semibold mb-1">Demo credentials for {activeConfig.label} Portal:</p>
          <p className="font-mono">{activeConfig.demoEmail} / {activeConfig.demoPass}</p>
        </div>
      </motion.div>
    </div>
  );
}
