import { ReactNode } from 'react';
import { PolicyScore } from '../types';
import { ShieldCheck, AlertTriangle, ThumbsDown } from 'lucide-react';

const statusStyles: Record<PolicyScore['status'], string> = {
  excellent: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-50',
  good: 'border-sky-400/50 bg-sky-500/10 text-sky-50',
  warning: 'border-amber-400/50 bg-amber-500/10 text-amber-50',
  critical: 'border-red-400/50 bg-red-500/10 text-red-100'
};

const iconMap: Record<PolicyScore['status'], ReactNode> = {
  excellent: <ShieldCheck className="h-4 w-4" />,
  good: <ShieldCheck className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  critical: <ThumbsDown className="h-4 w-4" />
};

const PolicyScoreView = ({ scores }: { scores: PolicyScore[] }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {scores.map((score) => (
      <article key={score.id} className={`rounded-2xl border px-4 py-3 text-sm ${statusStyles[score.status]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {iconMap[score.status]}
            <h4 className="font-semibold">{score.label}</h4>
          </div>
          <span className="text-xs">Weight {Math.round(score.weight * 100)}%</span>
        </div>
        <p className="mt-2 text-xs opacity-90">{score.summary}</p>
      </article>
    ))}
  </div>
);

export default PolicyScoreView;
