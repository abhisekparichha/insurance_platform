import { CheckCircle2, XCircle } from 'lucide-react';

type CoverageListsProps = {
  inclusions: string[];
  exclusions: string[];
};

const CoverageLists = ({ inclusions, exclusions }: CoverageListsProps) => (
  <div className="grid gap-6 md:grid-cols-2">
    {/* Inclusions */}
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold text-teal-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        What's covered
      </h3>
      <ul className="space-y-2">
        {inclusions.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </section>

    {/* Exclusions */}
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold text-rose-700">
        <XCircle className="h-4 w-4" aria-hidden />
        Key exclusions
      </h3>
      <ul className="space-y-2">
        {exclusions.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </section>
  </div>
);

export default CoverageLists;
