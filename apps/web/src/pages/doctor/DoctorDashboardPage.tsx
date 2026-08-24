import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatCard } from '../../components/ui/StatCard';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { ClinicalBriefCard } from '../../components/appointments/ClinicalBriefCard';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTime } from '../../lib/utils';
import { Calendar, CheckCircle, Users, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { isToday } from 'date-fns';

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', 'my'],
    queryFn: () => api.get('/appointments/my').then(r => r.data),
  });

  const today = appointments.filter((a: any) => isToday(new Date(a.slotStart)) && a.status === 'CONFIRMED');
  const upcoming = appointments.filter((a: any) => new Date(a.slotStart) > new Date() && a.status === 'CONFIRMED');
  const completed = appointments.filter((a: any) => a.status === 'COMPLETED');
  const nextApt = today[0] || upcoming[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, Dr. {user?.name?.split(' ').slice(1).join(' ') || user?.name}</h1>
          <p className="text-slate-500 text-sm">{today.length} appointments today</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Today" value={today.length} icon={Calendar} tone="primary" />
          <StatCard label="This Week" value={upcoming.length} icon={Users} tone="blue" />
          <StatCard label="Completed" value={completed.length} icon={CheckCircle} tone="success" />
        </div>
        {nextApt && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Next Patient</p>
            <div className="glass-card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-slate-800 text-lg">{nextApt.patient?.name}</p>
                  <p className="text-primary-500 text-sm">{formatDate(nextApt.slotStart)} at {formatTime(nextApt.slotStart)}</p>
                </div>
                <AppointmentStatusBadge status={nextApt.status} />
              </div>
              {nextApt.preVisitSummary && (
                <ClinicalBriefCard summary={nextApt.preVisitSummary} symptomForm={nextApt.symptomForm} />
              )}
              <Link to={`/appointments/${nextApt.id}`} className="mt-4 flex items-center gap-1.5 text-primary-500 font-medium text-sm hover:underline">
                Open appointment <ChevronRight size={14} />
              </Link>
            </div>
          </motion.div>
        )}
        <h2 className="text-lg font-bold text-slate-800">Today’s Schedule</h2>
        <div className="space-y-3">
          {today.map((apt: any, i: number) => (
            <motion.div key={apt.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/appointments/${apt.id}`} className="glass-card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all block">
                <div className="text-center w-14">
                  <p className="text-primary-500 font-bold text-sm">{formatTime(apt.slotStart)}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{apt.patient?.name}</p>
                  {apt.preVisitSummary?.urgencyLevel && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${apt.preVisitSummary.urgencyLevel === 'High' ? 'bg-red-50 text-red-600' : apt.preVisitSummary.urgencyLevel === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-700'}`}>
                      {apt.preVisitSummary.urgencyLevel} urgency
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </Link>
            </motion.div>
          ))}
          {today.length === 0 && (
            <div className="glass-card p-8 text-center text-slate-400">No appointments scheduled for today.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
