import React from 'react';
import { Check, Clock, Calendar, FileText, Star } from 'lucide-react';
import { cn } from '../../lib/utils';

const STEPS = [
  { key: 'HELD', label: 'Booked', icon: Calendar },
  { key: 'CONFIRMED', label: 'Confirmed', icon: Clock },
  { key: 'COMPLETED', label: 'Completed', icon: Check },
  { key: 'SUMMARY', label: 'Summary Ready', icon: FileText },
];

const STATUS_INDEX: Record<string, number> = {
  HELD: 0, CONFIRMED: 1, COMPLETED: 2, SUMMARY: 3,
};

export function AppointmentTimeline({ status, hasPostVisitSummary }: { status: string; hasPostVisitSummary?: boolean }) {
  const effectiveStatus = hasPostVisitSummary ? 'SUMMARY' : status;
  const activeIdx = STATUS_INDEX[effectiveStatus] ?? 0;
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done ? 'bg-primary-500 border-primary-500 text-white' :
                active ? 'bg-white border-primary-500 text-primary-500' :
                'bg-white border-slate-200 text-slate-300',
              )}>
                <step.icon size={14} />
              </div>
              <p className={cn('text-xs mt-1 font-medium whitespace-nowrap', active ? 'text-primary-600' : done ? 'text-slate-600' : 'text-slate-300')}>
                {step.label}
              </p>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-1 mt-[-12px]', idx < activeIdx ? 'bg-primary-500' : 'bg-slate-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
