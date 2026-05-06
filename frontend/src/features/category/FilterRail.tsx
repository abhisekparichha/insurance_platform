import clsx from 'clsx';
import { Filter, RotateCcw } from 'lucide-react';

export type FilterRailState = {
  minRating: number | null;
  maxPremium: number | null;
  insurers: string[];
  coverageTypes: string[];
  tags: string[];
  sort: 'relevance' | 'price_low' | 'price_high' | 'rating';
};

type FilterRailProps = {
  filters: FilterRailState;
  onChange: (filters: FilterRailState) => void;
  insurerOptions: string[];
  coverageOptions: string[];
  tagOptions: string[];
};

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
] as const;

const RATING_OPTIONS = [
  { value: 4.5, label: '4.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 3.5, label: '3.5+' },
];

const FilterRail = ({ filters, onChange, insurerOptions, coverageOptions, tagOptions }: FilterRailProps) => {
  const toggle = (key: 'insurers' | 'coverageTypes' | 'tags', value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const hasActive =
    filters.minRating !== null ||
    filters.maxPremium !== null ||
    filters.insurers.length > 0 ||
    filters.coverageTypes.length > 0 ||
    filters.tags.length > 0 ||
    filters.sort !== 'relevance';

  const reset = () =>
    onChange({
      minRating: null,
      maxPremium: null,
      insurers: [],
      coverageTypes: [],
      tags: [],
      sort: 'relevance',
    });

  return (
    <aside
      className="sticky top-[72px] h-fit w-64 shrink-0 rounded-lg border border-paper-strong bg-paper-surface p-5"
      aria-label="Filter options"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Filter className="h-4 w-4" /> Filters
        </span>
        {hasActive && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-gold transition-colors hover:text-gold-dark"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Sort */}
      <section className="mt-5 border-t border-paper-strong pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Sort by</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, sort: opt.value })}
              className={clsx(
                'rounded px-3 py-2 text-left text-xs transition-colors',
                filters.sort === opt.value
                  ? 'bg-navy-900 text-ink-on'
                  : 'text-ink-600 hover:bg-paper-raised hover:text-ink-900',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Min rating */}
      <section className="mt-5 border-t border-paper-strong pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Min. rating</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onChange({ ...filters, minRating: filters.minRating === opt.value ? null : opt.value })
              }
              className={clsx(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                filters.minRating === opt.value
                  ? 'border-navy-900 bg-navy-900 text-ink-on'
                  : 'border-paper-strong text-ink-600 hover:border-navy-900/30',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Insurer */}
      {insurerOptions.length > 0 && (
        <section className="mt-5 border-t border-paper-strong pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Insurer</p>
          <div className="mt-2 max-h-36 space-y-1 overflow-y-auto scroll-area">
            {insurerOptions.map((ins) => (
              <label key={ins} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-paper-raised">
                <input
                  type="checkbox"
                  checked={filters.insurers.includes(ins)}
                  onChange={() => toggle('insurers', ins)}
                  className="h-3.5 w-3.5 accent-navy-900"
                />
                <span className="text-xs text-ink-600 leading-tight">{ins.replace(/ Co Ltd| Company Ltd| Limited/g, '')}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Coverage type */}
      {coverageOptions.length > 0 && (
        <section className="mt-5 border-t border-paper-strong pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Coverage type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {coverageOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => toggle('coverageTypes', opt)}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors',
                  filters.coverageTypes.includes(opt)
                    ? 'border-navy-900 bg-navy-900 text-ink-on'
                    : 'border-paper-strong text-ink-600 hover:border-navy-900/30',
                )}
              >
                {opt.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tags */}
      {tagOptions.length > 0 && (
        <section className="mt-5 border-t border-paper-strong pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Features</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagOptions.map((tag) => (
              <button
                key={tag}
                onClick={() => toggle('tags', tag)}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors',
                  filters.tags.includes(tag)
                    ? 'border-gold bg-gold-soft text-gold-dark'
                    : 'border-paper-strong text-ink-600 hover:border-gold/40',
                )}
              >
                {tag.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
};

export default FilterRail;
