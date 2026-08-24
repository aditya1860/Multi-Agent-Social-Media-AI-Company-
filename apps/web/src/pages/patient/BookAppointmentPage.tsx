import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, addDays, startOfToday } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export default function BookAppointmentPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);

  const { data: doctor } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => api.get(`/doctors/${doctorId}`).then(r => r.data),
    enabled: !!doctorId,
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', doctorId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => api.get(`/doctors/${doctorId}/slots`, { params: { date: format(selectedDate, 'yyyy-MM-dd') } }).then(r => r.data),
    enabled: !!doctorId,
  });

  const holdMutation = useMutation({
    mutationFn: (slot: { start: string; end: string }) =>
      api.post('/appointments/hold', { doctorId, slotStart: slot.start, slotEnd: slot.end }).then(r => r.data),
    onSuccess: (data) => {
      navigate(`/appointments/${data.id}/symptoms`);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to hold slot');
    },
  });

  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Book with {doctor ? `Dr. ${doctor.user?.name}` : 'Doctor'}
          </h1>
          {doctor && <p className="text-primary-500 font-medium">{doctor.specialization}</p>}
        </div>
        {/* Date selector */}
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Select Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dateOptions.map(date => (
              <button
                key={date.toISOString()}
                onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                className={cn(
                  'flex flex-col items-center p-3 rounded-xl min-w-[60px] transition-all',
                  format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                    ? 'bg-primary-500 text-white shadow-card'
                    : 'bg-white/60 text-slate-600 hover:bg-white/80',
                )}
              >
                <span className="text-xs font-medium">{format(date, 'EEE')}</span>
                <span className="text-lg font-bold tabular-nums">{format(date, 'd')}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Slot grid */}
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">
            Available slots · {format(selectedDate, 'MMMM d')}
          </p>
          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : slots.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No slots available on this day.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot: any, i: number) => {
                const isSelected = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={i}
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.available ? slot : null)}
                    className={cn(
                      'py-2 px-3 rounded-xl text-sm font-medium transition-all',
                      slot.available
                        ? isSelected ? 'bg-primary-500 text-white shadow-card' : 'bg-white/70 text-slate-700 hover:bg-primary-50 hover:text-primary-700 border border-white/60'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed line-through',
                    )}
                  >
                    {format(new Date(slot.start), 'h:mm a')}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedSlot && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => holdMutation.mutate(selectedSlot)}
              disabled={holdMutation.isPending}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-card transition-all text-lg"
            >
              {holdMutation.isPending ? 'Reserving slot…' : `Continue with ${format(new Date(selectedSlot.start), 'h:mm a')}`}
            </button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
