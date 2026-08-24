import React from 'react';
import { Pill, CheckCircle, ArrowRight } from 'lucide-react';
import { IconBadge } from '../ui/IconBadge';

interface MedItem { drug: string; dosage: string; timesPerDay: number; durationDays: number; }
interface PostVisitSummary {
  patientFriendlySummary?: string;
  medicationScheduleJSON?: MedItem[];
  followUpSteps?: string[];
  llmStatus: string;
}

export function CarePlanCard({ summary }: { summary?: PostVisitSummary | null }) {
  if (!summary) return null;
  if (summary.llmStatus === 'PENDING') return (
    <div className="glass-card p-6 text-center text-slate-500 text-sm">Patient summary is being generated…</div>
  );
  if (summary.llmStatus === 'FAILED') return (
    <div className="glass-card p-6 text-slate-500 text-sm">AI summary unavailable. Please contact your doctor for details.</div>
  );
  const meds = summary.medicationScheduleJSON as MedItem[] | undefined;
  const steps = summary.followUpSteps as string[] | undefined;
  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start gap-4">
        <IconBadge icon={Pill} tone="success" size="lg" />
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Your Care Plan</h3>
          <p className="text-slate-600 text-sm leading-relaxed mt-1">{summary.patientFriendlySummary}</p>
        </div>
      </div>
      {meds && meds.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Medication Schedule</p>
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                <div className="flex items-center gap-2">
                  <Pill size={14} className="text-primary-500" />
                  <span className="text-sm font-medium text-slate-700">{m.drug}</span>
                  <span className="text-xs text-slate-400">{m.dosage}</span>
                </div>
                <div className="text-xs text-slate-500">{m.timesPerDay}x/day · {m.durationDays} days</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {steps && steps.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Follow-up Steps</p>
          <ul className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle size={16} className="text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
