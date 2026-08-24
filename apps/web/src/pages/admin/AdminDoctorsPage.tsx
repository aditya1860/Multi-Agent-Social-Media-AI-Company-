import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { IconBadge } from '../../components/ui/IconBadge';
import { api } from '../../lib/api';
import { Stethoscope, Plus, CalendarOff, X, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const leaveSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: z.string().optional(),
});

const newDoctorSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password min 6 chars'),
  specialization: z.string().min(2, 'Specialization required'),
  bio: z.string().optional(),
  slotDurationMinutes: z.number().default(30),
});

const DEFAULT_WORKING_HOURS = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: null,
  sunday: null,
};

export default function AdminDoctorsPage() {
  const qc = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: doctors = [] } = useQuery({
    queryKey: ['admin', 'doctors'],
    queryFn: () => api.get('/admin/doctors').then((r) => r.data),
  });

  const { register: registerLeave, handleSubmit: handleSubmitLeave, reset: resetLeave } = useForm({
    resolver: zodResolver(leaveSchema),
  });

  const leaveMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/admin/leave', { doctorUserId: selectedDoctor.id, ...data }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      resetLeave();
      alert('Leave created. Affected appointments will be notified.');
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to create leave'),
  });

  const {
    register: registerDoctor,
    handleSubmit: handleSubmitDoctor,
    reset: resetDoctor,
    formState: { errors: doctorErrors, isSubmitting: isSubmittingDoctor },
  } = useForm({
    resolver: zodResolver(newDoctorSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      specialization: '',
      bio: '',
      slotDurationMinutes: 30,
    },
  });

  const createDoctorMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/doctors', {
        ...data,
        workingHours: DEFAULT_WORKING_HOURS,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'doctors'] });
      qc.invalidateQueries({ queryKey: ['doctors'] });
      resetDoctor();
      setShowAddModal(false);
      alert('Doctor account & profile created successfully!');
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to create doctor profile'),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Doctor Management</h1>
            <p className="text-slate-500 text-sm mt-1">Manage profiles, working hours, and leave schedules</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-4 py-2.5 rounded-xl shadow-card transition-all"
          >
            <Plus size={18} /> Add Doctor
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-600">All Doctors ({doctors.length})</h2>
            {doctors.map((doc: any) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`glass-card p-4 flex items-center gap-3 cursor-pointer transition-all ${
                  selectedDoctor?.id === doc.id ? 'ring-2 ring-primary-500' : ''
                }`}
                onClick={() => setSelectedDoctor(doc)}
              >
                <IconBadge icon={Stethoscope} tone="primary" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{doc.name}</p>
                  <p className="text-xs text-primary-500">{doc.doctorProfile?.specialization || 'General Doctor'}</p>
                  <p className="text-xs text-slate-400">{doc.email}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {selectedDoctor && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5 space-y-4">
              <h2 className="font-semibold text-slate-700">Manage Leave for Dr. {selectedDoctor.name}</h2>
              <form onSubmit={handleSubmitLeave((d) => leaveMutation.mutate(d))} className="space-y-3">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Leave Date</label>
                  <input
                    type="date"
                    {...registerLeave('date')}
                    className="w-full px-3 py-2 rounded-xl border border-white/60 bg-white/60 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Reason (optional)</label>
                  <input
                    {...registerLeave('reason')}
                    placeholder="Conference, personal leave…"
                    className="w-full px-3 py-2 rounded-xl border border-white/60 bg-white/60 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={leaveMutation.isPending}
                  className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl font-medium hover:bg-accent-600 transition-all disabled:opacity-60"
                >
                  <CalendarOff size={16} /> {leaveMutation.isPending ? 'Creating…' : 'Add Leave Day'}
                </button>
              </form>
            </motion.div>
          )}
        </div>

        {/* Add Doctor Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card-lg w-full max-w-lg p-6 space-y-4 relative bg-white/95"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800">Add New Doctor Profile</h2>
              <form onSubmit={handleSubmitDoctor((d) => createDoctorMutation.mutate(d))} className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Doctor Name</label>
                  <input
                    {...registerDoctor('name')}
                    placeholder="Dr. Emily Smith"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                  {doctorErrors.name && <p className="text-red-500 text-xs mt-1">{doctorErrors.name.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                  <input
                    {...registerDoctor('email')}
                    type="email"
                    placeholder="dr.smith@vitalis.app"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                  {doctorErrors.email && <p className="text-red-500 text-xs mt-1">{doctorErrors.email.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      {...registerDoctor('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {doctorErrors.password && <p className="text-red-500 text-xs mt-1">{doctorErrors.password.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Specialization</label>
                  <input
                    {...registerDoctor('specialization')}
                    placeholder="Cardiology, Dermatology, Neurology…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                  {doctorErrors.specialization && (
                    <p className="text-red-500 text-xs mt-1">{doctorErrors.specialization.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Bio (optional)</label>
                  <input
                    {...registerDoctor('bio')}
                    placeholder="Experienced specialist in..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Slot Duration (Minutes)</label>
                  <select
                    {...registerDoctor('slotDurationMinutes', { valueAsNumber: true })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDoctor || createDoctorMutation.isPending}
                    className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-5 py-2 rounded-xl transition-all shadow-card"
                  >
                    {createDoctorMutation.isPending ? 'Creating Doctor…' : 'Create Doctor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
