import React from 'react';
import { cn } from '../../lib/utils';

const statusStyles: Record<string, string> = {
  HELD: 'bg-amber-50 text-amber-700 border border-amber-200',
  CONFIRMED: 'bg-primary-50 text-primary-700 border border-primary-200',
  COMPLETED: 'bg-green-50 text-green-700 border border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
  RESCHEDULED: 'bg-purple-50 text-purple-700 border border-purple-200',
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', statusStyles[status] || 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  );
}
