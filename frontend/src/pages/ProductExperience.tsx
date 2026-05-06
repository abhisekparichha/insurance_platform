import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import AppHeader from '../components/AppHeader';
import CategoryPicker from '../components/CategoryPicker';
import ProductGrid, { ProductFilters } from '../components/ProductGrid';
import ProductCard from '../components/ProductCard';
import ProductDetail from '../components/ProductDetail';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useSearchContext } from '../context/SearchContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { usePrefetchProduct } from '../hooks/usePrefetchProduct';
import {
  fetchCategories,
  fetchInsurers,
  fetchProductDetail,
  fetchProducts,
  fetchSearchSuggestions,
} from '../lib/api';
import {
  getGroupById,
  getDefaultCategoryForGroup,
} from '../lib/categoryTree';

const defaultFilters: ProductFilters = {
  insurers: [],
  coverageTypes: [],
  tags: [],
  sort: 'relevance',
};

const PAGE_SIZE = 8;
const TOP_PICKS_SIZE = 3;

type ViewMode = 'picks' | 'browse';

const ProductExperience = () => {
  const { searchTerm, setSearchTerm, recentSearches, addRecentSearch } = useSearchContext();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('picks');
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const filtersKey = JSON.stringify(filters);
  const parsedFilters = useMemo(() => JSON.parse(filtersKey) as ProductFilters, [filtersKey]);
  const prefetchProduct = usePrefetchProduct();

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const insurersQuery = useQuery({ queryKey: ['insurers'], queryFn: fetchInsurers });

  const liveIds = useMemo(
    () => (categoriesQuery.data ?? []).map(c => c.id),
    [categoriesQuery.data],
  );

  // Resolve the API categoryId from group + subcategory selection
  const apiCategoryId = useMemo(() => {
    if (selectedCategoryId) return selectedCategoryId;
    if (selectedGroupId) {
      const group = getGroupById(selectedGroupId);
      if (!group) return undefined;
      return getDefaultCategoryForGroup(group, liveIds);
    }
    return undefined;
  }, [selectedGroupId, selectedCategoryId, liveIds]);

  const showProducts = Boolean(selectedGroupId || debouncedSearch);

  useEffect(() => { setPage(1); }, [apiCategoryId, debouncedSearch, filtersKey]);
  useEffect(() => { setSelectedProductId(null); }, [apiCategoryId]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const topPicksQuery = useQuery({
    queryKey: ['top-picks', apiCategoryId, debouncedSearch],
    queryFn: () =>
      fetchProducts({
        categoryId: apiCategoryId,
        search: debouncedSearch || undefined,
        page: 1,
        pageSize: TOP_PICKS_SIZE,
      }),
    enabled: showProducts && viewMode === 'picks',
    keepPreviousData: true,
  });

  const productsQuery = useQuery({
    queryKey: ['products', apiCategoryId, debouncedSearch, filtersKey, page],
    queryFn: () =>
      fetchProducts({
        categoryId: apiCategoryId,
        search: debouncedSearch || undefined,
        ...parsedFilters,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: showProducts && viewMode === 'browse',
    keepPreviousData: true,
  });

  const productDetailQuery = useQuery({
    queryKey: ['product-detail', selectedProductId],
    queryFn: () =>
      selectedProductId ? fetchProductDetail(selectedProductId) : Promise.resolve(null),
    enabled: Boolean(selectedProductId),
  });

  const suggestionsQuery = useQuery({
    queryKey: ['search-suggestions', debouncedSearch],
    queryFn: () => fetchSearchSuggestions(debouncedSearch ?? ''),
    enabled: Boolean(debouncedSearch) && (debouncedSearch?.length ?? 0) > 1,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const insurerOptions = useMemo(
    () => insurersQuery.data?.map(i => i.name) ?? [],
    [insurersQuery.data],
  );
  const coverageOptions = ['base-plan', 'topup-plan', 'term-plan'];
  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    productsQuery.data?.items.forEach(p => p.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [productsQuery.data]);

  const totalPages = productsQuery.data
    ? Math.ceil(productsQuery.data.total / PAGE_SIZE)
    : 1;

  const selectedGroup = selectedGroupId ? getGroupById(selectedGroupId) : null;

  const activeTotal =
    viewMode === 'picks' ? topPicksQuery.data?.total : productsQuery.data?.total;

  const contextLabel = useMemo(() => {
    if (debouncedSearch) return `Search: "${debouncedSearch}"`;
    if (!selectedGroup) return null;
    const sub = selectedGroup.subcategories.find(s => s.id === selectedCategoryId);
    return sub ? `${selectedGroup.label} › ${sub.label}` : selectedGroup.label;
  }, [debouncedSearch, selectedGroup, selectedCategoryId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGroupSelect = (groupId: string) => {
    // Toggle off if clicking the same group
    setSelectedGroupId(prev => (prev === groupId ? null : groupId));
    setSelectedCategoryId(null);
    setSelectedProductId(null);
    setViewMode('picks');
    setPage(1);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setSelectedProductId(null);
    setPage(1);
  };

  const handleSearchSubmit = () => {
    addRecentSearch(searchTerm);
    setPage(1);
    if (searchTerm) setViewMode('browse');
  };

  const handleSuggestionSelect = (suggestion: { name: string; id?: string }) => {
    setSearchTerm(suggestion.name);
    addRecentSearch(suggestion.name);
    if (suggestion.id) setSelectedProductId(suggestion.id);
    setViewMode('browse');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 text-white">

      {/* Search header */}
      <AppHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={handleSearchSubmit}
        suggestions={suggestionsQuery.data ?? []}
        isSuggestionsLoading={suggestionsQuery.isFetching}
        recentSearches={recentSearches}
        onSuggestionSelect={handleSuggestionSelect}
      />

      {/* Category picker */}
      <CategoryPicker
        liveCategories={categoriesQuery.data ?? []}
        selectedGroupId={selectedGroupId}
        selectedCategoryId={selectedCategoryId}
        onGroupSelect={handleGroupSelect}
        onCategorySelect={handleCategorySelect}
      />

      {/* Landing prompt — nothing selected yet */}
      {!showProducts && (
        <div className="py-16 text-center">
          <p className="text-4xl">☝️</p>
          <p className="mt-3 text-lg font-medium text-white/60">
            Pick a category above, or search for a specific plan
          </p>
          <p className="mt-1 text-sm text-white/30">
            Health · Life · Motor · Travel · Fire & Perils · Home and more
          </p>
        </div>
      )}

      {/* Products area */}
      {showProducts && (
        <div className="flex flex-col gap-6">

          {/* Context bar + mode toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {contextLabel && (
                <p className="text-xs uppercase tracking-widest text-white/40">{contextLabel}</p>
              )}
              <p className="text-xl font-semibold text-white">
                {activeTotal !== undefined
                  ? `${activeTotal.toLocaleString()} plans found`
                  : 'Searching…'}
              </p>
            </div>

            <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('picks')}
                className={clsx(
                  'rounded-xl px-5 py-2 text-sm font-medium transition-all',
                  viewMode === 'picks'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                ⭐ Top Picks
              </button>
              <button
                onClick={() => setViewMode('browse')}
                className={clsx(
                  'rounded-xl px-5 py-2 text-sm font-medium transition-all',
                  viewMode === 'browse'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                🔍 Browse All
              </button>
            </div>
          </div>

          {/* TOP PICKS view */}
          {viewMode === 'picks' && (
            <>
              {topPicksQuery.isLoading && <LoadingSkeleton rows={2} />}

              {!topPicksQuery.isLoading && topPicksQuery.data?.items.length === 0 && (
                <EmptyState
                  title="No plans available yet"
                  description="We're adding more products in this category soon. Try a different sub-type or search by name."
                />
              )}

              {!topPicksQuery.isLoading && (topPicksQuery.data?.items.length ?? 0) > 0 && (
                <>
                  <div className="grid gap-5 md:grid-cols-3">
                    {topPicksQuery.data!.items.map((product, index) => (
                      <div key={product.id} className="relative">
                        {index === 0 && (
                          <div className="absolute -top-2.5 left-4 z-10 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-900">
                            ⭐ Top Rated
                          </div>
                        )}
                        {index === 1 && (
                          <div className="absolute -top-2.5 left-4 z-10 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
                            Popular
                          </div>
                        )}
                        <ProductCard
                          product={product}
                          selected={product.id === selectedProductId}
                          onSelect={setSelectedProductId}
                          searchTerm={searchTerm}
                        />
                      </div>
                    ))}
                  </div>

                  {(topPicksQuery.data?.total ?? 0) > TOP_PICKS_SIZE && (
                    <div className="text-center">
                      <button
                        onClick={() => setViewMode('browse')}
                        className="rounded-2xl border border-white/15 px-6 py-3 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
                      >
                        Browse all {topPicksQuery.data!.total.toLocaleString()} plans →
                      </button>
                    </div>
                  )}
                </>
              )}

              {selectedProductId && (
                <ProductDetail
                  product={productDetailQuery.data}
                  isLoading={productDetailQuery.isFetching}
                  searchTerm={searchTerm}
                />
              )}
            </>
          )}

          {/* BROWSE ALL view */}
          {viewMode === 'browse' && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
              <ProductGrid
                products={productsQuery.data?.items ?? []}
                total={productsQuery.data?.total ?? 0}
                page={page}
                totalPages={totalPages}
                onPageChange={p => setPage(Math.max(1, Math.min(p, totalPages)))}
                filters={filters}
                onFiltersChange={setFilters}
                insurerOptions={insurerOptions}
                coverageOptions={coverageOptions}
                tagOptions={tagOptions}
                onSelect={setSelectedProductId}
                onHoverProduct={prefetchProduct}
                selectedProductId={selectedProductId}
                isLoading={productsQuery.isLoading && !productsQuery.data}
                error={
                  productsQuery.error instanceof Error
                    ? productsQuery.error.message
                    : null
                }
                onRetry={() => productsQuery.refetch()}
                searchTerm={searchTerm}
              />
              <ProductDetail
                product={productDetailQuery.data}
                isLoading={productDetailQuery.isFetching}
                searchTerm={searchTerm}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default ProductExperience;
