import clsx from 'clsx';

type PillGroupProps<T extends string> = {
  options: { value: T; label: string; count?: number }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** If true, clicking active option deselects it */
  clearable?: boolean;
  size?: 'sm' | 'md';
};

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  clearable = true,
  size = 'sm',
}: PillGroupProps<T>) {
  const handleClick = (opt: T) => {
    if (clearable && value === opt) {
      onChange(null);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleClick(opt.value)}
          aria-pressed={value === opt.value}
          className={clsx(
            'rounded-full border font-medium transition-colors',
            size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
            value === opt.value
              ? 'border-navy-900 bg-navy-900 text-ink-on'
              : 'border-paper-strong bg-paper-surface text-ink-600 hover:border-navy-900/40 hover:text-ink-900',
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1 opacity-60">({opt.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default PillGroup;
