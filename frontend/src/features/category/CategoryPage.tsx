import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import FilterRail, { FilterRailState } from './FilterRail';
import ProductRow from './ProductRow';
import InsurerLeagueTable from './InsurerLeagueTable';
import PillGroup from '../../components/ui/PillGroup';
import Tabs from '../../components/ui/Tabs';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { fetchCategories, fetchInsurers, fetchProducts } from '../../lib/api';
import { CATEGORY_TREE, getGroupById, getGroupForCategory } from '../../lib/categoryTree';
import type { ProductSummary } from '../../types';

const DEFAULT_FILTERS: FilterRailState = {
  minRating: null,
  maxPremium: null,
  insurers: [],
  coverageTypes: [],
  tags: [],
  sort: 'relevance',
};

const PAGE_SIZE = 10;

const CategoryPage = () => {
  const { categoryId, subcategoryId } = useParams<{ categoryId: string; subcategoryId?: string }>();

  // Resolve the group and category
  const group = useMemo(() => {
    if (!categoryId) return null;
    // categoryId might be a group id (e.g. 'health') or a direct category id
    return getGroupById(categoryId) ?? getGroupForCategory(categoryId) ?? null;
  }, [categoryId]);

  const [selectedSubId, setSelectedSubId] = useState<string | null>(subcategoryId ?? null);
  const [viewTab, setViewTab] = useState<'products' | 'insurers'>('products');
  const [filters, setFilters] = useState<FilterRailState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSelectedSubId(subcategoryId ?? null);
  }, [subcategoryId]);

  useEffect(() => {
    setPage(1);
  }, [selectedSubId, filters]);

  const { data: liveCategories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: insurersData = [] } = useQuery({ queryKey: ['insurers'], queryFn: fetchInsurers });

  // Compute the API category id
  const apiCategoryId = useMemo(() => {
    if (selectedSubId) return selectedSubId;
    if (group) {
      const live = liveCategories.map((c) => c.id);
      return group.dbCategories.find((id) => live.includes(id)) ?? group.dbCategories[0];
    }
    return categoryId;
  }, [group, selectedSubId, liveCategories, categoryId]);

  const productsQuery = useQuery({
    queryKey: ['products', apiCategoryId, filters, page],
    queryFn: () =>
      fetchProducts({
        categoryId: apiCategoryId,
        insurers: filters.insurers,
        coverageTypes: filters.coverageTypes,
        tags: filters.tags,
        sort: filters.sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(apiCategoryId),
    keepPreviousData: true,
  });

  const products: ProductSummary[] = useMemo(() => {
    const items = productsQuery.data?.items ?? [];
    if (filters.minRating !== null) {
      return items.filter((p) => p.rating >= (filters.minRating as number));
    }
    return items;
  }, [productsQuery.data, filters.minRating]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    (productsQuery.data?.items ?? []).forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [productsQuery.data]);

  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const subPills = group?.subcategories.map((sub) => ({
    value: sub.id,
    label: sub.label,
    count: liveCategories.find((c) => c.id === sub.id)?.productCount ?? 0,
  })) ?? [];

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero banner */}
      <div className="bg-navy-900 py-10">
        <div className="mx-auto max-w-7xl px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-ink-onmuted" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-ink-on">Home</Link>
            <ChevronRight className="h-3 w-3" />
            {group && (
              <>
                <span className="text-ink-on">{group.label}</span>
                {selectedSubId && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-gold">
                      {group.subcategories.find((s) => s.id === selectedSubId)?.label}
                    </span>
                  </>
                )}
              </>
            )}
          </nav>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-ink-on">
                {selectedSubId
                  ? group?.subcategories.find((s) => s.id === selectedSubId)?.label
                  : group?.label ?? 'Insurance Products'}
              </h1>
              <p className="mt-1 text-sm text-ink-onmuted">
                {group?.description ?? 'Browse and compare insurance products'}
              </p>
            </div>
            {total > 0 && (
              <p className="font-data text-sm text-ink-onmuted">
                <span className="text-lg font-semibold text-ink-on">{total}</span> plans found
              </p>
            )}
          </div>

          {/* Sub-category pills */}
          {subPills.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSubId(null)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  !selectedSubId
                    ? 'border-gold bg-gold text-navy-900'
                    : 'border-white/20 text-ink-onmuted hover:border-white/40 hover:text-ink-on'
                }`}
              >
                All {group?.label}
              </button>
              {subPills.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => pill.count > 0 ? setSelectedSubId(pill.value) : undefined}
                  disabled={pill.count === 0}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    selectedSubId === pill.value
                      ? 'border-gold bg-gold text-navy-900 font-medium'
                      : pill.count > 0
                      ? 'border-white/20 text-ink-onmuted hover:border-white/40 hover:text-ink-on'
                      : 'cursor-default border-white/10 text-ink-onmuted/30'
                  }`}
                >
                  {pill.label}
                  {pill.count > 0 && <span className="ml-1 opacity-60">({pill.count})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Products / Insurers tab */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { key: 'products', label: 'Products', count: total },
              { key: 'insurers', label: 'Insurers', count: insurersData.length },
            ]}
            activeTab={viewTab}
            onChange={setViewTab}
          />
        </div>

        {viewTab === 'products' ? (
          <div className="flex gap-6">
            {/* Filter rail */}
            <FilterRail
              filters={filters}
              onChange={setFilters}
              insurerOptions={insurersData.map((i) => i.name)}
              coverageOptions={['base-plan', 'topup-plan', 'term-plan', 'motor-comprehensive', 'travel-plan', 'fire-policy', 'home-policy', 'endowment-plan']}
              tagOptions={allTags}
            />

            {/* Product list */}
            <div className="min-w-0 flex-1">
              {productsQuery.isLoading && !productsQuery.data && (
                <LoadingSkeleton rows={4} />
              )}

              {!productsQuery.isLoading && products.length === 0 && (
                <EmptyState
                  title="No products match your filters"
                  description="Try adjusting the filters or selecting a different sub-category."
                />
              )}

              {products.length > 0 && (
                <>
                  <div className="space-y-3">
                    {products.map((product, idx) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        rank={page === 1 ? idx + 1 : undefined}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between text-sm text-ink-600">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-full border border-paper-strong px-4 py-2 transition-colors hover:border-navy-900 hover:text-ink-900 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="font-data">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-full border border-paper-strong px-4 py-2 transition-colors hover:border-navy-900 hover:text-ink-900 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <InsurerLeagueTable insurers={insurersData} />
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
