import { Category } from '../types';
import { Icon, icons } from 'lucide-react';
import clsx from 'clsx';

export type CategoryListProps = {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (categoryId: string) => void;
};

const getIcon = (name: string): Icon => {
  const key = name as keyof typeof icons;
  return icons[key] ?? icons.LayoutDashboard;
};

const CategoryList = ({ categories, activeCategory, onSelect }: CategoryListProps) => {
  return (
    <section aria-label="Browse categories" className="scroll-area flex gap-3 overflow-x-auto pb-2">
      {categories.map((category) => {
        const IconComponent = getIcon(category.icon);
        const isActive = category.id === activeCategory;
        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={clsx(
              'min-w-[180px] rounded-2xl border px-4 py-4 text-left transition-all hover:-translate-y-0.5',
              isActive
                ? 'border-brand/50 bg-brand/20 text-white'
                : 'border-white/10 bg-white/5 text-white/80'
            )}
            aria-pressed={isActive}
          >
            <div className="flex items-center justify-between">
              <IconComponent className="h-4 w-4" />
              <span className="text-xs text-white/60">{category.productCount} products</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">{category.label}</h3>
            <p className="mt-1 text-xs text-white/60">Policy wordings mapped with anchors</p>
          </button>
        );
      })}
    </section>
  );
};

export default CategoryList;
