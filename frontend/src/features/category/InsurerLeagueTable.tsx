import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Stars from '../../components/ui/Stars';
import Score from '../../components/ui/Score';
import MonogramTile from '../../components/ui/MonogramTile';
import type { Insurer } from '../../types';

type InsurerLeagueTableProps = {
  insurers: Insurer[];
};

const InsurerLeagueTable = ({ insurers }: InsurerLeagueTableProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...insurers].sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-2" role="list" aria-label="Insurer league table">
      {sorted.map((ins, idx) => {
        const isExpanded = expandedId === ins.id;
        return (
          <div
            key={ins.id}
            role="listitem"
            className="rounded-lg border border-paper-strong bg-paper-surface transition-colors hover:border-navy-900/20"
          >
            {/* Row */}
            <button
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
              onClick={() => setExpandedId(isExpanded ? null : ins.id)}
              aria-expanded={isExpanded}
            >
              {/* Rank */}
              <span className="w-6 shrink-0 text-center font-data text-sm font-medium text-ink-400">
                {idx + 1}
              </span>

              {/* Monogram */}
              <MonogramTile name={ins.name} size="sm" />

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-semibold text-ink-900">{ins.name}</p>
                <p className="text-[11px] text-ink-400">{ins.totalProducts} products</p>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <Score value={ins.rating} size="sm" />
                <Stars value={ins.rating} size="xs" />
              </div>

              {/* Expand chevron */}
              <span className="ml-2 text-ink-400">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            </button>

            {/* Expanded row */}
            {isExpanded && (
              <div className="border-t border-paper-strong px-5 pb-4 pt-3">
                <p className="text-xs text-ink-600">
                  {ins.name} is one of {sorted.length} insurers tracked on InsureIQ.
                  Ratings are based on claims data, policy wording quality, and verified reviews.
                </p>
                <Link
                  to={`/insurer/${ins.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-900 underline-offset-2 hover:underline"
                >
                  View insurer profile <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default InsurerLeagueTable;
