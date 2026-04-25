import clsx from 'clsx';
import { Category } from '../types';
import { CATEGORY_TREE, CategoryGroup } from '../lib/categoryTree';

export type CategoryPickerProps = {
  liveCategories: Category[];
  selectedGroupId: string | null;
  selectedCategoryId: string | null;
  onGroupSelect: (groupId: string) => void;
  /** Pass null to mean "all in group" */
  onCategorySelect: (categoryId: string | null) => void;
};

function countForGroup(group: CategoryGroup, live: Category[]): number {
  return live
    .filter(c => group.dbCategories.includes(c.id))
    .reduce((sum, c) => sum + c.productCount, 0);
}

const CategoryPicker = ({
  liveCategories,
  selectedGroupId,
  selectedCategoryId,
  onGroupSelect,
  onCategorySelect,
}: CategoryPickerProps) => {
  const selectedGroup = CATEGORY_TREE.find(g => g.id === selectedGroupId) ?? null;

  return (
    <section aria-label="Choose insurance category" className="space-y-5">
      {/* Group cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CATEGORY_TREE.map(group => {
          const count = countForGroup(group, liveCategories);
          const isActive = group.id === selectedGroupId;
          const hasData = count > 0;

          return (
            <button
              key={group.id}
              onClick={() => onGroupSelect(group.id)}
              aria-pressed={isActive}
              className={clsx(
                'relative rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card',
                isActive
                  ? clsx('bg-gradient-to-br', group.gradient, group.borderActive)
                  : 'border-white/10 bg-white/5 hover:border-white/20',
              )}
            >
              <span className="text-3xl leading-none">{group.icon}</span>
              <h3 className={clsx('mt-3 text-base font-semibold', isActive ? 'text-white' : 'text-white/90')}>
                {group.label}
              </h3>
              <p className="mt-1 text-xs text-white/50">{group.description}</p>
              <div className="mt-4">
                {hasData ? (
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', isActive ? clsx('bg-white/20', group.accentText) : 'bg-white/10 text-white/60')}>
                    {count.toLocaleString()} plans
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/30">
                    Coming soon
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Subcategory pills — only shown when a group is active */}
      {selectedGroup && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="mr-1 text-xs uppercase tracking-widest text-white/40">Sub-type:</span>

          {/* "All" pill */}
          <button
            onClick={() => onCategorySelect(null)}
            className={clsx(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              !selectedCategoryId
                ? clsx('border-white/40 bg-white/15 text-white')
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/80',
            )}
          >
            All {selectedGroup.label}
          </button>

          {selectedGroup.subcategories.map(sub => {
            const subCount = liveCategories.find(c => c.id === sub.id)?.productCount ?? 0;
            const isSelected = selectedCategoryId === sub.id;

            return (
              <button
                key={sub.id}
                onClick={() => subCount > 0 ? onCategorySelect(sub.id) : undefined}
                disabled={subCount === 0}
                title={sub.description}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors',
                  isSelected
                    ? 'border-white/40 bg-white/15 text-white'
                    : subCount > 0
                      ? 'border-white/10 text-white/60 hover:border-white/25 hover:text-white/80'
                      : 'cursor-default border-white/5 text-white/20',
                )}
              >
                <span>{sub.icon}</span>
                <span>{sub.label}</span>
                {subCount > 0 && (
                  <span className="text-xs text-white/40">({subCount.toLocaleString()})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CategoryPicker;
