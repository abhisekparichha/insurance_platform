import Meter from '../../components/ui/Meter';
import { getRatingTextClass, getRatingLabel } from '../../lib/scoring';
import type { PolicyScore } from '../../types';

type RatingBreakdownProps = {
  scores: PolicyScore[];
  overallRating: number;
};

const STATUS_COLOR: Record<string, string> = {
  excellent: 'text-emerald-600',
  good: 'text-green-600',
  warning: 'text-amber-600',
  critical: 'text-red-600',
};

const STATUS_SCORE: Record<string, number> = {
  excellent: 4.8,
  good: 4.0,
  warning: 3.0,
  critical: 1.5,
};

const RatingBreakdown = ({ scores, overallRating }: RatingBreakdownProps) => (
  <section aria-labelledby="rating-breakdown-heading">
    <div className="mb-4 flex items-center justify-between">
      <h3 id="rating-breakdown-heading" className="font-serif text-base font-semibold text-ink-900">
        Rating breakdown
      </h3>
      <div className="text-right">
        <span className={`font-data text-2xl font-semibold ${getRatingTextClass(overallRating)}`}>
          {overallRating.toFixed(1)}
        </span>
        <span className="font-data text-sm text-ink-400">/5</span>
        <p className="text-xs text-ink-400">{getRatingLabel(overallRating)}</p>
      </div>
    </div>

    <dl className="space-y-5">
      {scores.map((score) => {
        const numericScore = STATUS_SCORE[score.status] ?? 4.0;
        return (
          <div key={score.id}>
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <dt>
                <span className="text-sm font-medium text-ink-900">{score.label}</span>
                <span className="ml-2 text-xs text-ink-400">({Math.round(score.weight * 100)}%)</span>
              </dt>
              <dd className={`shrink-0 text-xs font-semibold ${STATUS_COLOR[score.status] ?? ''}`}>
                {score.status.charAt(0).toUpperCase() + score.status.slice(1)}
              </dd>
            </div>
            <Meter value={numericScore} max={5} height={6} />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{score.summary}</p>
          </div>
        );
      })}
    </dl>
  </section>
);

export default RatingBreakdown;
