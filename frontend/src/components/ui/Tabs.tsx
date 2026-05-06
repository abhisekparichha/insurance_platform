import clsx from 'clsx';

type Tab<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  activeTab: T;
  onChange: (key: T) => void;
  variant?: 'underline' | 'pill';
};

function Tabs<T extends string>({ tabs, activeTab, onChange, variant = 'underline' }: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === activeTab}
            onClick={() => onChange(tab.key)}
            className={clsx(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              tab.key === activeTab
                ? 'border-navy-900 bg-navy-900 text-ink-on'
                : 'border-paper-strong text-ink-600 hover:border-navy-900/30 hover:text-ink-900',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Underline variant
  return (
    <div className="flex flex-wrap gap-0 border-b border-paper-strong" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === activeTab}
          onClick={() => onChange(tab.key)}
          className={clsx(
            '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            tab.key === activeTab
              ? 'border-gold text-ink-900'
              : 'border-transparent text-ink-600 hover:border-paper-strong hover:text-ink-900',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
