import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import CategoryGlyph from '../../components/ui/CategoryGlyph';
import { fetchCategories } from '../../lib/api';
import { CATEGORY_TREE, CategoryGroup } from '../../lib/categoryTree';
import type { Category } from '../../types';

type GlyphKey = 'health' | 'life' | 'motor' | 'travel' | 'fire' | 'home';

const GROUP_GLYPH: Record<string, GlyphKey> = {
  health: 'health',
  life: 'life',
  motor: 'motor',
  others: 'travel',
};

const GROUP_BG: Record<string, string> = {
  health: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100',
  life: 'bg-blue-50 text-blue-700 group-hover:bg-blue-100',
  motor: 'bg-amber-50 text-amber-700 group-hover:bg-amber-100',
  others: 'bg-purple-50 text-purple-700 group-hover:bg-purple-100',
};

function countForGroup(group: CategoryGroup, live: Category[]): number {
  return live
    .filter((c) => group.dbCategories.includes(c.id))
    .reduce((sum, c) => sum + c.productCount, 0);
}

const CategoryGrid = () => {
  const { data: liveCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4" role="list" aria-label="Insurance categories">
      {CATEGORY_TREE.map((group) => {
        const glyph = GROUP_GLYPH[group.id] ?? 'health';
        const bg = GROUP_BG[group.id] ?? GROUP_BG.health;
        const count = countForGroup(group, liveCategories);

        return (
          <Link
            key={group.id}
            to={`/c/${group.id}`}
            role="listitem"
            className={clsx(
              'group flex flex-col gap-4 rounded-lg border border-paper-strong bg-paper-surface p-5 transition-all',
              'hover:-translate-y-0.5 hover:border-navy-900/30 hover:shadow-card',
            )}
          >
            {/* Glyph tile */}
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded transition-colors',
                bg,
              )}
            >
              <CategoryGlyph type={glyph} size={22} />
            </span>

            {/* Label */}
            <div>
              <h3 className="font-serif text-base font-semibold text-ink-900 group-hover:text-navy-900">
                {group.label}
              </h3>
              <p className="mt-1 text-xs text-ink-400">{group.description}</p>
            </div>

            {/* Count pill */}
            <div className="mt-auto">
              {count > 0 ? (
                <span className="inline-block rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-dark">
                  {count} plans
                </span>
              ) : (
                <span className="inline-block rounded-full bg-paper-raised px-2.5 py-0.5 text-xs text-ink-400">
                  Coming soon
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default CategoryGrid;
