import { Link } from 'react-router-dom';
import Kicker from '../../components/ui/Kicker';
import Meter from '../../components/ui/Meter';

const DIMENSIONS = [
  {
    label: 'Coverage Breadth',
    weight: 25,
    description:
      'We analyse the breadth of covered conditions, the number of permanently excluded items, and whether modern treatments (robotic surgery, HIFU, etc.) are included. Higher scores for policies that cover more comprehensively with fewer sub-limits.',
  },
  {
    label: 'Claims & TAT',
    weight: 25,
    description:
      'Based on IRDAI annual report claim settlement ratios, reported pre-authorisation turnaround times, and the clarity of the documented claim process within policy wordings. Network size is a secondary signal.',
  },
  {
    label: 'Exclusions Clarity',
    weight: 15,
    description:
      'How clearly the policy wording lists, explains, and limits permanent exclusions. Policies that use plain language, include a numbered list, and provide a glossary score higher.',
  },
  {
    label: 'Co-pay & Room Rent',
    weight: 15,
    description:
      'Presence or absence of co-payment clauses, room rent sub-limits (proportionate deduction), deductibles, and shared accommodation limits. Policies with zero co-pay and no room rent cap score highest.',
  },
  {
    label: 'Wellness & OPD',
    weight: 10,
    description:
      'OPD wallet value, tele-consultation inclusion, preventive care (annual health check), dental, vision, and wellness reward programmes. Treated as a bonus rather than a core signal.',
  },
  {
    label: 'Policy Transparency',
    weight: 10,
    description:
      'Quality of the policy document: does it have section anchors, a glossary, clearly labelled annexures, and QR codes or digital navigation aids? We reward clear, honest communication.',
  },
];

const MethodologyPage = () => (
  <div className="min-h-screen bg-paper">
    <div className="bg-navy-900 py-14">
      <div className="mx-auto max-w-3xl px-4">
        <Kicker className="text-gold">InsureIQ</Kicker>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ink-on">
          Rating Methodology
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-onmuted">
          Every rating on InsureIQ is computed transparently from 6 independent dimensions.
          Here&apos;s exactly how we score insurance products.
        </p>
      </div>
    </div>

    <article className="mx-auto max-w-3xl px-4 py-12">
      <section className="prose prose-sm max-w-none text-ink-600">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Principles</h2>
        <ul className="mt-4 space-y-2">
          <li>We never accept payments from insurers to influence ratings.</li>
          <li>Scores are derived solely from policy wordings, IRDAI data, and verified reviews.</li>
          <li>All scores and weights are published here and updated at least annually.</li>
          <li>Composite ratings are computed as a weighted average of the 6 dimensions.</li>
        </ul>
      </section>

      {/* Dimension cards */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">The 6 dimensions</h2>
        <div className="mt-6 space-y-8">
          {DIMENSIONS.map((dim, idx) => (
            <div key={dim.label} className="rounded-lg border border-paper-strong bg-paper-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-serif text-lg font-semibold text-ink-900">
                  <span className="mr-2 font-data text-sm font-normal text-ink-400">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  {dim.label}
                </h3>
                <span className="shrink-0 font-data text-xl font-semibold text-navy-900">
                  {dim.weight}%
                </span>
              </div>
              <div className="my-3">
                <Meter value={dim.weight} max={100} height={5} colorClass="bg-navy-900" />
              </div>
              <p className="text-sm leading-relaxed text-ink-600">{dim.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-gold/30 bg-gold-soft p-6">
        <h2 className="font-serif text-xl font-semibold text-gold-dark">Composite score formula</h2>
        <p className="mt-3 font-data text-sm text-ink-600">
          Composite = &Sigma;(dimension_score &times; weight) / &Sigma;(weights)
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Each dimension is scored from 0–5 by our analysts using the criteria above.
          The weighted average produces the composite score displayed on every product page.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-ink-900">Data sources</h2>
        <ul className="mt-4 space-y-2 text-sm text-ink-600">
          <li>IRDAI Annual Reports and Handbooks</li>
          <li>IRDAI-filed policy wordings (public filings)</li>
          <li>Verified policyholder reviews (KYC-confirmed)</li>
          <li>Network hospital data from insurer websites</li>
          <li>Claim settlement ratio disclosures</li>
        </ul>
      </section>

      <div className="mt-10 border-t border-paper-strong pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-navy-900 px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-navy-900 hover:text-ink-on"
        >
          Browse products
        </Link>
      </div>
    </article>
  </div>
);

export default MethodologyPage;
