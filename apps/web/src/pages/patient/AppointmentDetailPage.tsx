import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { AppointmentTimeline } from '../../components/appointments/AppointmentTimeline';
import { CarePlanCard } from '../../components/appointments/CarePlanCard';
import { ClinicalBriefCard } from '../../components/appointments/ClinicalBriefCard';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTime } from '../../lib/utils';
import { Calendar, Clock, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: apt, refetch } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => api.get(`/appointments/${appointmentId}`).then(r => r.data),
    refetchInterval: apt => apt?.preVisitSummary?.llmStatus === 'PENDING' || apt?.postVisitSummary?.llmStatus === 'PENDING' ? 5000 : false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/cancel`).then(r => r.data),
    onSuccess: () => refetch(),
  });

  if (!apt) return <AppLayout><div className="glass-card p-8 animate-pulse" /></AppLayout>;

  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {isDoctor ? `Patient: ${apt.patient?.name}` : `Dr. ${apt.doctor?.name}`}
              </h1>
              <p className="text-primary-500 font-medium text-sm">{apt.doctor?.doctorProfile?.specialization}</p>
            </div>
            <AppointmentStatusBadge status={apt.status} />
          </div>
          <div className="flex gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDate(apt.slotStart)}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> {formatTime(apt.slotStart)} – {formatTime(apt.slotEnd)}</span>
          </div>
          <div className="mt-4">
            <AppointmentTimeline status={apt.status} hasPostVisitSummary={!!apt.postVisitSummary} />
          </div>
          {['HELD', 'CONFIRMED'].includes(apt.status) && (
            <button
              onClick={() => { if (confirm('Cancel this appointment?')) cancelMutation.mutate(); }}
              className="mt-4 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
            >
              <X size={14} /> Cancel appointment
            </button>
          )}
        </motion.div>

        {/* AI Brief (doctor view) */}
        {isDoctor && <ClinicalBriefCard summary={apt.preVisitSummary} symptomForm={apt.symptomForm} />}

        {/* Care plan (patient view, post-visit) */}
        {isPatient && apt.postVisitSummary && <CarePlanCard summary={apt.postVisitSummary} />}

        {/* Symptom form needed */}
        {isPatient && apt.status === 'HELD' && !apt.symptomForm && (
          <div className="glass-card p-6 text-center">
            <p className="text-slate-600 mb-3">Complete your symptom form to confirm the appointment.</p>
            <button onClick={() => navigate(`/appointments/${appointmentId}/symptoms`)} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-all">
              Fill Symptom Form
            </button>
          </div>
        )}

        {/* Doctor notes (doctor view, completed) */}
        {isDoctor && apt.status === 'CONFIRMED' && (
          <div className="glass-card p-6">
            <button onClick={() => navigate(`/appointments/${appointmentId}/notes`)} className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition-all">
              Submit Post-Visit Notes
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
