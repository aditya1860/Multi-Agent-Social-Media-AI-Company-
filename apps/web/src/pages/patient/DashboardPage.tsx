import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatCard } from '../../components/ui/StatCard';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTime } from '../../lib/utils';
import { motion } from 'framer-motion';

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', 'my'],
    queryFn: () => api.get('/appointments/my').then(r => r.data),
  });

  const upcoming = appointments.filter((a: any) => ['HELD', 'CONFIRMED'].includes(a.status));
  const completed = appointments.filter((a: any) => a.status === 'COMPLETED');
  const next = upcoming[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-800">Good morning, {user?.name?.split(' ')[0]}</h1>
          <p className="text-slate-500 text-sm mt-1">Here’s your health overview</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Upcoming" value={upcoming.length} icon={Calendar} tone="primary" />
          <StatCard label="Completed" value={completed.length} icon={CheckCircle} tone="success" />
          <StatCard label="Total Visits" value={appointments.length} icon={Clock} tone="blue" />
        </div>

        {next && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Next Appointment</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-800 text-lg">Dr. {next.doctor?.name}</p>
                <p className="text-slate-500 text-sm">{next.doctor?.doctorProfile?.specialization}</p>
                <p className="text-primary-600 font-medium mt-2">{formatDate(next.slotStart)} at {formatTime(next.slotStart)}</p>
              </div>
              <AppointmentStatusBadge status={next.status} />
            </div>
            <Link to={`/appointments/${next.id}`} className="mt-4 inline-flex items-center gap-2 text-sm text-primary-500 font-medium hover:underline">
              View details
            </Link>
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Recent Appointments</h2>
          <Link to="/doctors" className="flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary-600 transition-all shadow-card">
            <PlusCircle size={16} /> Book appointment
          </Link>
        </div>

        <div className="space-y-3">
          {appointments.slice(0, 5).map((apt: any, i: number) => (
            <motion.div key={apt.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/appointments/${apt.id}`} className="glass-card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all block">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">Dr. {apt.doctor?.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(apt.slotStart)} · {formatTime(apt.slotStart)}</p>
                </div>
                <AppointmentStatusBadge status={apt.status} />
              </Link>
            </motion.div>
          ))}
          {appointments.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-slate-500">No appointments yet.</p>
              <Link to="/doctors" className="mt-3 inline-block text-primary-500 font-medium hover:underline">Find a doctor</Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
