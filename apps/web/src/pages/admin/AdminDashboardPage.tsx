import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatCard } from '../../components/ui/StatCard';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { api } from '../../lib/api';
import { Users, Calendar, Bell, Stethoscope } from 'lucide-react';
import { formatDate, formatTime } from '../../lib/utils';
import { motion } from 'framer-motion';

export default function AdminDashboardPage() {
  const { data: doctors = [] } = useQuery({ queryKey: ['admin', 'doctors'], queryFn: () => api.get('/admin/doctors').then(r => r.data) });
  const { data: appointments = [] } = useQuery({ queryKey: ['admin', 'appointments'], queryFn: () => api.get('/admin/appointments').then(r => r.data) });
  const { data: notifications = [] } = useQuery({ queryKey: ['admin', 'notifications'], queryFn: () => api.get('/admin/notifications').then(r => r.data) });
  const failed = notifications.filter((n: any) => n.status === 'FAILED');
  const abandoned = notifications.filter((n: any) => n.status === 'ABANDONED');
  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Doctors" value={doctors.length} icon={Stethoscope} tone="primary" />
          <StatCard label="Total Appointments" value={appointments.length} icon={Calendar} tone="blue" />
          <StatCard label="Failed Notifications" value={failed.length} icon={Bell} tone="warning" />
          <StatCard label="Abandoned" value={abandoned.length} icon={Bell} tone="danger" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Recent Appointments</h2>
        <div className="space-y-2">
          {appointments.slice(0, 10).map((apt: any) => (
            <div key={apt.id} className="glass-card p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-slate-700">{apt.patient?.name} → Dr. {apt.doctor?.name}</p>
                <p className="text-xs text-slate-400">{formatDate(apt.slotStart)} {formatTime(apt.slotStart)}</p>
              </div>
              <AppointmentStatusBadge status={apt.status} />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
