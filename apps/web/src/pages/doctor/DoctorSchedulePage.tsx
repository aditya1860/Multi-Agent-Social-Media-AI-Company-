import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatCard } from '../../components/ui/StatCard';
import { AppointmentStatusBadge } from '../../components/ui/AppointmentStatusBadge';
import { IconBadge } from '../../components/ui/IconBadge';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/utils';
import { Calendar, Clock, ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DoctorSchedulePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'my'],
    queryFn: () => api.get('/appointments/my').then((r) => r.data),
  });

  const dayAppointments = appointments.filter((a: any) =>
    isSameDay(new Date(a.slotStart), selectedDate)
  );

  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i - 3));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Schedule</h1>
          <p className="text-slate-500 text-sm mt-1">View and manage your daily appointment schedule</p>
        </div>

        {/* Date selector strip */}
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Select Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dateOptions.map((date) => {
              const active = isSameDay(date, selectedDate);
              const count = appointments.filter((a: any) => isSameDay(new Date(a.slotStart), date)).length;
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center p-3 rounded-xl min-w-[65px] transition-all relative ${
                    active
                      ? 'bg-primary-500 text-white shadow-card'
                      : 'bg-white/60 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="text-xs font-medium">{format(date, 'EEE')}</span>
                  <span className="text-lg font-bold tabular-nums">{format(date, 'd')}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${
                        active ? 'bg-white text-primary-600' : 'bg-primary-100 text-primary-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Schedule */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              Schedule for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <span className="text-sm font-medium text-slate-500">
              {dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card h-20 animate-pulse" />
              ))}
            </div>
          ) : dayAppointments.length === 0 ? (
            <div className="glass-card p-10 text-center text-slate-400">
              <Calendar size={36} className="mx-auto mb-2 text-slate-300" />
              <p>No appointments scheduled for this date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppointments.map((apt: any, i: number) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/appointments/${apt.id}`}
                    className="glass-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all block"
                  >
                    <div className="text-center w-20 flex-shrink-0 border-r border-slate-200/60 pr-4">
                      <p className="text-primary-600 font-bold text-sm">{formatTime(apt.slotStart)}</p>
                      <p className="text-slate-400 text-xs">{formatTime(apt.slotEnd)}</p>
                    </div>
                    <IconBadge icon={User} tone="primary" size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{apt.patient?.name}</p>
                      <p className="text-xs text-slate-500 truncate">{apt.patient?.email}</p>
                      {apt.reason && (
                        <p className="text-xs text-slate-400 italic mt-0.5 truncate">
                          "{apt.reason}"
                        </p>
                      )}
                    </div>
                    <AppointmentStatusBadge status={apt.status} />
                    <ChevronRight size={18} className="text-slate-300" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
