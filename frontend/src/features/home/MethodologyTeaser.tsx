import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Kicker from '../../components/ui/Kicker';
import Meter from '../../components/ui/Meter';

const DIMENSIONS = [
  { label: 'Coverage Breadth', weight: 25, description: 'Scope of covered conditions, exclusions count, and modern treatment inclusion' },
  { label: 'Claims & TAT', weight: 25, description: 'Cashless approval time, settlement ratio, and documented claim process clarity' },
  { label: 'Exclusions Clarity', weight: 15, description: 'How clearly policy wording lists, explains, and limits permanent exclusions' },
  { label: 'Co-pay & Room Rent', weight: 15, description: 'Presence of co-pay, room rent sub-limits, and deductible structures' },
  { label: 'Wellness & OPD', weight: 10, description: 'OPD wallet, teleconsults, preventive care, and wellness reward programmes' },
  { label: 'Policy Transparency', weight: 10, description: 'Document quality, anchor depth, glossary completeness, and digital navigation' },
];

const MethodologyTeaser = () => (
  <section className="border-t border-paper-strong bg-paper-raised py-20" aria-labelledby="method-heading">
    <div className="mx-auto max-w-7xl px-4">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        {/* Text */}
        <div>
          <Kicker>Rating methodology</Kicker>
          <h2 id="method-heading" className="mt-3 font-serif text-3xl font-semibold text-ink-900">
            Transparent, weighted scoring
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Every product rating on InsureIQ is computed from 6 independent dimensions,
            each weighted to reflect what matters most to a typical policyholder.
            Scores are derived from policy wordings, IRDAI annual reports, and verified user reviews.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            We never accept payments from insurers to influence ratings.
          </p>
          <Link
            to="/methodology"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-navy-900 px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-navy-900 hover:text-ink-on"
          >
            Read full methodology <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Weighted bars */}
        <dl className="space-y-4 rounded-lg border border-paper-strong bg-paper-surface p-6 shadow-card">
          {DIMENSIONS.map((dim) => (
            <div key={dim.label}>
              <div className="mb-1.5 flex items-start justify-between gap-4">
                <dt>
                  <p className="text-sm font-medium text-ink-900">{dim.label}</p>
                  <p className="text-[10px] leading-snug text-ink-400">{dim.description}</p>
                </dt>
                <dd className="shrink-0 font-data text-sm font-semibold text-navy-900">
                  {dim.weight}%
                </dd>
              </div>
              <Meter value={dim.weight} max={100} height={5} colorClass="bg-navy-900" />
            </div>
          ))}
        </dl>
      </div>
    </div>
  </section>
);

export default MethodologyTeaser;
