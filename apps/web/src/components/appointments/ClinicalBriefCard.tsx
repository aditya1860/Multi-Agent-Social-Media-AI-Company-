import React from 'react';
import { Brain, CheckSquare, Square } from 'lucide-react';
import { UrgencyBadge } from '../ui/UrgencyBadge';
import { IconBadge } from '../ui/IconBadge';

interface PreVisitSummary {
  urgencyLevel?: string;
  chiefComplaint?: string;
  suggestedQuestions?: string[];
  llmStatus: string;
}

interface SymptomForm {
  rawSymptoms: string;
}

export function ClinicalBriefCard({ summary, symptomForm }: { summary?: PreVisitSummary | null; symptomForm?: SymptomForm | null }) {
  if (!summary) return (
    <div className="glass-card p-5 text-slate-500 text-sm">No pre-visit summary available yet.</div>
  );
  return (
    <div className="glass-card p-6 relative">
      <div className="absolute top-4 right-4">
        <UrgencyBadge level={summary.urgencyLevel || 'Unspecified'} />
      </div>
      <div className="flex items-start gap-4 mb-5">
        <IconBadge icon={Brain} tone="primary" size="lg" />
        <div>
          <h3 className="font-bold text-slate-800 text-lg">AI Clinical Brief</h3>
          <p className="text-slate-500 text-sm">
            {summary.llmStatus === 'FAILED' ? 'AI summary unavailable — review raw symptoms below.' :
             summary.llmStatus === 'PENDING' ? 'Generating AI summary...' :
             summary.chiefComplaint || 'No chief complaint identified.'}
          </p>
        </div>
      </div>
      {symptomForm && (
        <div className="mb-4 p-4 bg-white/50 rounded-xl">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Patient’s Reported Symptoms</p>
          <p className="text-slate-700 text-sm">{symptomForm.rawSymptoms}</p>
        </div>
      )}
      {summary.suggestedQuestions && summary.suggestedQuestions.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Suggested Questions</p>
          <ul className="space-y-2">
            {summary.suggestedQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <Square size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700 text-sm">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
