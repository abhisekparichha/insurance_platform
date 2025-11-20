import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppHeader from '../components/AppHeader';
import CategoryList from '../components/CategoryList';
import ProductGrid, { ProductFilters } from '../components/ProductGrid';
import ProductDetail from '../components/ProductDetail';
import { useSearchContext } from '../context/SearchContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { usePrefetchProduct } from '../hooks/usePrefetchProduct';
import {
  fetchCategories,
  fetchInsurers,
  fetchProductDetail,
  fetchProducts,
  fetchSearchSuggestions
} from '../lib/api';

const defaultFilters: ProductFilters = {
  insurers: [],
  coverageTypes: [],
  tags: [],
  sort: 'relevance'
};

const PAGE_SIZE = 8;

const ProductExperience = () => {
  const { searchTerm, setSearchTerm, recentSearches, addRecentSearch } = useSearchContext();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const filtersKey = JSON.stringify(filters);
  const parsedFilters = useMemo(() => JSON.parse(filtersKey) as ProductFilters, [filtersKey]);
  const prefetchProduct = usePrefetchProduct();

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  useEffect(() => {
    if (!activeCategory && categoriesQuery.data?.length) {
      setActiveCategory(categoriesQuery.data[0].id);
    }
  }, [categoriesQuery.data, activeCategory]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, debouncedSearch, filtersKey]);

  const productsQuery = useQuery({
    queryKey: ['products', activeCategory, debouncedSearch, filtersKey, page],
    queryFn: () =>
      fetchProducts({
        categoryId: activeCategory ?? undefined,
        search: debouncedSearch || undefined,
        ...parsedFilters,
        page,
        pageSize: PAGE_SIZE
      }),
    keepPreviousData: true
  });

  useEffect(() => {
    if (productsQuery.data?.items.length && !selectedProductId) {
      setSelectedProductId(productsQuery.data.items[0].id);
    }
  }, [productsQuery.data, selectedProductId]);

  const productDetailQuery = useQuery({
    queryKey: ['product-detail', selectedProductId],
    queryFn: () => (selectedProductId ? fetchProductDetail(selectedProductId) : Promise.resolve(null)),
    enabled: Boolean(selectedProductId)
  });

  const suggestionsQuery = useQuery({
    queryKey: ['search-suggestions', debouncedSearch],
    queryFn: () => fetchSearchSuggestions(debouncedSearch ?? ''),
    enabled: Boolean(debouncedSearch) && (debouncedSearch?.length ?? 0) > 1
  });

  const insurersQuery = useQuery({ queryKey: ['insurers'], queryFn: fetchInsurers });

  const insurerOptions = useMemo(() => insurersQuery.data?.map((insurer) => insurer.name) ?? [], [insurersQuery.data]);
  const coverageOptions = ['base-plan', 'topup-plan', 'term-plan'];
  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    productsQuery.data?.items.forEach((product) => product.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, [productsQuery.data]);

  const totalPages = productsQuery.data ? Math.ceil(productsQuery.data.total / PAGE_SIZE) : 1;
  const isProductsLoading = productsQuery.isLoading && !productsQuery.data;
  const productsError = productsQuery.error instanceof Error ? productsQuery.error.message : null;

  const handleSearchSubmit = () => {
    addRecentSearch(searchTerm);
    setPage(1);
  };

  const handleSuggestionSelect = (suggestion: { name: string; id?: string }) => {
    setSearchTerm(suggestion.name);
    addRecentSearch(suggestion.name);
    if (suggestion.id) {
      setSelectedProductId(suggestion.id);
    }
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-white">
      <AppHeader
        categories={categoriesQuery.data ?? []}
        activeCategory={activeCategory}
        onCategoryChange={(id) => {
          setActiveCategory(id);
          setSelectedProductId(null);
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={handleSearchSubmit}
        suggestions={suggestionsQuery.data ?? []}
        isSuggestionsLoading={suggestionsQuery.isFetching}
        recentSearches={recentSearches}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <CategoryList
        categories={categoriesQuery.data ?? []}
        activeCategory={activeCategory}
        onSelect={(id) => {
          setActiveCategory(id);
          setSelectedProductId(null);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <ProductGrid
          products={productsQuery.data?.items ?? []}
          total={productsQuery.data?.total ?? 0}
          page={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
          filters={filters}
          onFiltersChange={setFilters}
          insurerOptions={insurerOptions}
          coverageOptions={coverageOptions}
          tagOptions={tagOptions}
          onSelect={setSelectedProductId}
          onHoverProduct={prefetchProduct}
          selectedProductId={selectedProductId}
          isLoading={isProductsLoading}
          error={productsError}
          onRetry={() => productsQuery.refetch()}
          searchTerm={searchTerm}
        />
        <ProductDetail
          product={productDetailQuery.data}
          isLoading={productDetailQuery.isFetching}
          searchTerm={searchTerm}
        />
      </div>
    </main>
  );
};

export default ProductExperience;
