import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Stethoscope, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['PATIENT', 'DOCTOR']),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'PATIENT' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await authRegister(data);
      navigate('/dashboard');
    } catch (err: any) {
      const message =
        err?.message ||
        err?.response?.data?.error ||
        'Registration failed. Please try again.';
      setError('root', { message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-card-lg w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6FE0D0] to-[#1F9E93] flex items-center justify-center mb-4" style={{ boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 6px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.15)' }}>
            <Stethoscope size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create account</h1>
          <p className="text-slate-500 text-sm mt-1">Join the Vitalis portal</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
              <AlertCircle size={16} /> {errors.root.message}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Full name</label>
            <input {...register('name')} type="text" placeholder="John Doe" className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Email</label>
            <input {...register('email')} type="email" placeholder="you@example.com" className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">I am a...</label>
            <select {...register('role')} className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="PATIENT">Patient</option>
              <option value="DOCTOR">Doctor (requires admin approval)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Phone (optional)</label>
            <input {...register('phone')} type="tel" placeholder="+1 555 000 0000" className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-card">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="text-primary-500 font-medium hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
