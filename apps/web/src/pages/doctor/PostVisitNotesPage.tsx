import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { Plus, Trash2, Pill } from 'lucide-react';
import { motion } from 'framer-motion';

const prescriptionItemSchema = z.object({
  drug: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().min(1),
});

const schema = z.object({
  doctorNotesRaw: z.string().min(10, 'Please provide clinical notes'),
  prescriptionJSON: z.array(prescriptionItemSchema),
});
type FormData = z.infer<typeof schema>;

export default function PostVisitNotesPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { data: apt } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => api.get(`/appointments/${appointmentId}`).then(r => r.data),
  });

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { doctorNotesRaw: '', prescriptionJSON: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'prescriptionJSON' });

  const submitMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/appointments/${appointmentId}/notes`, data).then(r => r.data),
    onSuccess: () => navigate(`/appointments/${appointmentId}`),
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to save notes'),
  });

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Post-Visit Notes</h1>
        {apt && <p className="text-slate-500">Patient: <strong>{apt.patient?.name}</strong></p>}
        <form onSubmit={handleSubmit((d) => submitMutation.mutate(d))} className="space-y-5">
          <div className="glass-card p-6">
            <label className="text-sm font-semibold text-slate-700 block mb-2">Clinical Notes</label>
            <textarea
              {...register('doctorNotesRaw')}
              rows={8}
              placeholder="Patient presented with… Examination revealed… Assessment: … Plan: …"
              className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/60 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            {errors.doctorNotesRaw && <p className="text-red-500 text-xs mt-1">{errors.doctorNotesRaw.message}</p>}
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pill size={18} className="text-primary-500" />
                <h2 className="font-semibold text-slate-700">Prescription</h2>
              </div>
              <button type="button" onClick={() => append({ drug: '', dosage: '', frequency: 'Once daily', durationDays: 7 })} className="flex items-center gap-1.5 text-sm text-primary-500 font-medium hover:underline">
                <Plus size={14} /> Add medication
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field, i) => (
                <motion.div key={field.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white/60 rounded-xl grid grid-cols-2 gap-3">
                  <input {...register(`prescriptionJSON.${i}.drug`)} placeholder="Drug name" className="px-3 py-2 rounded-lg border border-white/60 bg-white/80 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  <input {...register(`prescriptionJSON.${i}.dosage`)} placeholder="Dosage (e.g. 500mg)" className="px-3 py-2 rounded-lg border border-white/60 bg-white/80 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  <input {...register(`prescriptionJSON.${i}.frequency`)} placeholder="Frequency" className="px-3 py-2 rounded-lg border border-white/60 bg-white/80 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  <div className="flex gap-2">
                    <input {...register(`prescriptionJSON.${i}.durationDays`, { valueAsNumber: true })} type="number" placeholder="Days" className="flex-1 px-3 py-2 rounded-lg border border-white/60 bg-white/80 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                    <button type="button" onClick={() => remove(i)} className="p-2 text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isSubmitting || submitMutation.isPending} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-card transition-all">
            {submitMutation.isPending ? 'Saving notes…' : 'Save Notes & Generate Patient Summary'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
