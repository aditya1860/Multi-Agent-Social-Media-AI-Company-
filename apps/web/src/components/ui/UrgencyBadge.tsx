import React from 'react';
import { cn } from '../../lib/utils';

type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Unspecified';

const styles: Record<string, string> = {
  Low: 'bg-primary-50 text-primary-700 border border-primary-100',
  Medium: 'bg-amber-50 text-amber-700 border border-amber-100',
  High: 'bg-red-50 text-red-700 border border-red-100',
  Unspecified: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export function UrgencyBadge({ level }: { level: UrgencyLevel | string }) {
  const l = (level || 'Unspecified') as UrgencyLevel;
  const style = styles[l] || styles.Unspecified;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', style)}>
      {l === 'High' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      {l === 'Low' && <span className="w-2 h-2 rounded-full bg-primary-500" />}
      {l === 'Medium' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
      {l === 'Unspecified' && <span className="w-2 h-2 rounded-full bg-slate-400" />}
      {l} Urgency
    </span>
  );
}
