import Kicker from '../../components/ui/Kicker';
import Meter from '../../components/ui/Meter';

const steps = [
  {
    number: '01',
    title: 'Pick your insurance type',
    description: 'Browse 6 categories — from retail health to fire and perils. Drill into sub-types with a single click.',
  },
  {
    number: '02',
    title: 'Read the policy wording',
    description: 'We surface key clauses, exclusions, and waiting periods directly from IRDAI-filed wordings — no paraphrasing.',
  },
  {
    number: '03',
    title: 'Compare and decide',
    description: 'Add up to 5 products to a side-by-side matrix. Ratings are computed transparently from 6 weighted dimensions.',
  },
];

// Sample rating breakdown for illustration
const sampleDimensions = [
  { label: 'Coverage Breadth', score: 4.8 },
  { label: 'Claims & TAT', score: 4.2 },
  { label: 'Exclusions Clarity', score: 3.9 },
  { label: 'Co-pay & Room Rent', score: 4.6 },
  { label: 'Wellness & OPD', score: 3.5 },
  { label: 'Policy Transparency', score: 4.1 },
];

const HowItWorks = () => (
  <section className="py-20" aria-labelledby="how-heading">
    <div className="mx-auto max-w-7xl px-4">
      <div className="mb-12 text-center">
        <Kicker>How it works</Kicker>
        <h2 id="how-heading" className="mt-3 font-serif text-3xl font-semibold text-ink-900">
          Three steps to the right policy
        </h2>
      </div>

      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        {/* Steps */}
        <ol className="space-y-10">
          {steps.map((step) => (
            <li key={step.number} className="flex gap-5">
              <span className="shrink-0 font-serif text-4xl font-light text-gold/40">
                {step.number}
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Sample rating breakdown card */}
        <aside className="rounded-lg border border-paper-strong bg-paper-surface p-6 shadow-card">
          <p className="font-serif text-base font-semibold text-ink-900">
            Sample rating breakdown — Care Shield
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Overall&nbsp;<strong className="text-ink-900">4.5 / 5</strong>
          </p>
          <dl className="mt-5 space-y-4">
            {sampleDimensions.map((dim) => (
              <div key={dim.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <dt className="text-xs font-medium text-ink-600">{dim.label}</dt>
                  <dd className="font-data text-xs font-medium text-ink-900">
                    {dim.score.toFixed(1)}
                  </dd>
                </div>
                <Meter value={dim.score} max={5} height={6} />
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[10px] text-ink-400">
            Each dimension is weighted and combined into a composite score.
          </p>
        </aside>
      </div>
    </div>
  </section>
);

export default HowItWorks;
