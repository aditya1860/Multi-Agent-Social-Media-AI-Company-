import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/utils';
import { Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AppointmentsListPage() {
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'my'],
    queryFn: () => api.get('/appointments/my').then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">My Appointments</h1>
        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />)}</div>
        ) : appointments.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Calendar size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500">No appointments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt: any, i: number) => (
              <motion.div key={apt.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/appointments/${apt.id}`} className="glass-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all block">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 text-xs font-medium">{new Date(apt.slotStart).toLocaleDateString('en', { month: 'short' })}</span>
                    <span className="text-primary-700 font-bold tabular-nums">{new Date(apt.slotStart).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Dr. {apt.doctor?.name}</p>
                    <p className="text-xs text-primary-500">{apt.doctor?.doctorProfile?.specialization}</p>
                    <p className="text-xs text-slate-400">{formatTime(apt.slotStart)}</p>
                  </div>
                  <AppointmentStatusBadge status={apt.status} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
