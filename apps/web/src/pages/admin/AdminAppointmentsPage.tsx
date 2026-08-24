import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/utils';
import { Calendar, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminAppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'appointments', statusFilter],
    queryFn: () =>
      api
        .get('/admin/appointments', {
          params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
        })
        .then((r) => r.data),
  });

  const statuses = ['ALL', 'HELD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and monitor all clinic bookings across patients and doctors</p>
        </div>

        {/* Filter bar */}
        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <Filter size={16} className="text-primary-500" />
            <span>Filter Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-primary-500 text-white shadow-card'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments Table / Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card h-20 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="glass-card p-6 text-center text-red-600 text-sm">
            Failed to load appointments. Please check your network or credentials.
          </div>
        ) : appointments.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No appointments found matching this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt: any, i: number) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-5 flex flex-wrap items-center justify-between gap-4 hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 text-xs font-medium">
                      {new Date(apt.slotStart).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-primary-700 font-bold tabular-nums">
                      {new Date(apt.slotStart).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">
                      Patient: <span className="font-semibold text-slate-700">{apt.patient?.name}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Doctor: <span className="font-medium text-primary-600">Dr. {apt.doctor?.name}</span> ({apt.doctor?.doctorProfile?.specialization || 'General'})
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(apt.slotStart)} at {formatTime(apt.slotStart)} – {formatTime(apt.slotEnd)}
                    </p>
                  </div>
                </div>
                <AppointmentStatusBadge status={apt.status} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
