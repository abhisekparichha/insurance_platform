import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductSummary } from '../types';
import ProductCard from './ProductCard';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import ErrorBanner from './ErrorBanner';

export type ProductFilters = {
  insurers: string[];
  coverageTypes: string[];
  tags: string[];
  sort: 'relevance' | 'price_low' | 'price_high' | 'rating';
};

export type ProductGridProps = {
  products: ProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  insurerOptions: string[];
  coverageOptions: string[];
  tagOptions: string[];
  onSelect: (productId: string) => void;
  onHoverProduct?: (productId: string) => void;
  selectedProductId: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  searchTerm?: string;
};

const ProductGrid = ({
  products,
  total,
  page,
  totalPages,
  onPageChange,
  filters,
  onFiltersChange,
  insurerOptions,
  coverageOptions,
  tagOptions,
  onSelect,
  onHoverProduct,
  selectedProductId,
  isLoading,
  error,
  onRetry,
  searchTerm
}: ProductGridProps) => {
  const toggleFilterValue = (key: keyof Omit<ProductFilters, 'sort'>, value: string) => {
    const current = filters[key];
    const exists = current.includes(value);
    const updated = exists ? current.filter((item) => item !== value) : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const changeSort = (value: ProductFilters['sort']) => onFiltersChange({ ...filters, sort: value });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5" aria-label="Product results">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-brand-light">Results</p>
          <h2 className="text-xl font-semibold text-white">{total} matches</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/80">
          {(['relevance', 'price_low', 'price_high', 'rating'] as const).map((option) => (
            <button
              key={option}
              onClick={() => changeSort(option)}
              className={`rounded-full border px-3 py-1 capitalize ${
                filters.sort === option ? 'border-brand bg-brand/20' : 'border-white/15'
              }`}
            >
              {option.replace('_', ' ')}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-white">
            <Filter className="h-4 w-4" /> Filters
          </div>
          <FilterList
            label="Insurer"
            options={insurerOptions}
            selected={filters.insurers}
            onToggle={(value) => toggleFilterValue('insurers', value)}
          />
          <FilterList
            label="Coverage type"
            options={coverageOptions}
            selected={filters.coverageTypes}
            onToggle={(value) => toggleFilterValue('coverageTypes', value)}
          />
          <FilterList
            label="Tags"
            options={tagOptions}
            selected={filters.tags}
            onToggle={(value) => toggleFilterValue('tags', value)}
          />
          <button className="mt-4 text-xs text-brand-light" onClick={() => onFiltersChange({ ...filters, insurers: [], coverageTypes: [], tags: [] })}>
            Reset filters
          </button>
        </aside>

        <div>
          {error && <ErrorBanner message={error} onRetry={onRetry} />}
          {isLoading && <LoadingSkeleton rows={3} />}
          {!isLoading && !error && products.length === 0 && (
            <EmptyState title="No products" description="Try broadening your filters or search terms." />
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={product.id === selectedProductId}
                onSelect={onSelect}
                onHover={onHoverProduct}
                searchTerm={searchTerm}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-white">
              <button
                className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <p className="text-sm text-white/70">
                Page {page} of {totalPages}
              </p>
              <button
                className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const FilterList = ({
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="mt-5 border-t border-white/5 pt-4">
    <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          className={`rounded-full border px-3 py-1 text-xs ${
            selected.includes(option) ? 'border-brand bg-brand/20 text-white' : 'border-white/10 text-white/70'
          }`}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
      {options.length === 0 && <p className="text-xs text-white/50">No options</p>}
    </div>
  </div>
);

export default ProductGrid;
