import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { ClipboardList, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const schema = z.object({
  rawSymptoms: z.string().min(10, 'Please describe your symptoms in at least 10 characters'),
});
type FormData = z.infer<typeof schema>;

export default function SymptomFormPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { data: appointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => api.get(`/appointments/${appointmentId}`).then(r => r.data),
    enabled: !!appointmentId,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const submitMutation = useMutation({
    mutationFn: (data: FormData) => Promise.all([
      api.post(`/appointments/${appointmentId}/symptoms`, data),
      api.post(`/appointments/${appointmentId}/confirm`),
    ]),
    onSuccess: () => navigate(`/appointments/${appointmentId}`),
    onError: (err: any) => alert(err?.response?.data?.error || 'Submission failed'),
  });

  return (
    <AppLayout>
      <div className="max-w-xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-800">Tell us about your symptoms</h1>
          <p className="text-slate-500 text-sm mt-1">This helps your doctor prepare. Your appointment will be confirmed after submission.</p>
        </motion.div>
        {appointment && (
          <div className="glass-card p-4">
            <p className="text-sm text-slate-600">Appointment with <strong>Dr. {appointment.doctor?.name}</strong></p>
            <p className="text-xs text-slate-400">{new Date(appointment.slotStart).toLocaleString()}</p>
          </div>
        )}
        <form onSubmit={handleSubmit((d) => submitMutation.mutate(d))} className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList size={20} className="text-primary-500" />
            <h2 className="font-semibold text-slate-700">Symptom Description</h2>
          </div>
          <textarea
            {...register('rawSymptoms')}
            rows={6}
            placeholder="Describe your symptoms in detail: when they started, severity, what makes them better or worse…"
            className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          {errors.rawSymptoms && <p className="text-red-500 text-xs">{errors.rawSymptoms.message}</p>}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-50">
            <AlertCircle size={16} className="text-primary-500 mt-0.5" />
            <p className="text-xs text-primary-700">Our AI will analyze your symptoms and generate a clinical brief for your doctor. This takes a few seconds after submission.</p>
          </div>
          <button type="submit" disabled={isSubmitting || submitMutation.isPending} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-card">
            {submitMutation.isPending ? 'Confirming appointment…' : 'Submit & Confirm Appointment'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
