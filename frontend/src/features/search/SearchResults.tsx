import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import ProductRow from '../category/ProductRow';
import Badge from '../../components/ui/Badge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { fetchProducts } from '../../lib/api';
import { CATEGORY_TREE } from '../../lib/categoryTree';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () =>
      fetchProducts({ search: query, pageSize: 20 }),
    enabled: Boolean(query),
  });

  const results = data?.items ?? [];

  // Group results by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof results>();
    results.forEach((p) => {
      const group = CATEGORY_TREE.find((g) => g.dbCategories.includes(p.categoryId));
      const key = group?.label ?? p.categoryId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-navy-900 py-10">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="font-serif text-3xl font-semibold text-ink-on">
            Search results
          </h1>
          {query && (
            <p className="mt-1 text-sm text-ink-onmuted">
              Showing results for &ldquo;<span className="text-gold">{query}</span>&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Facet chips */}
        {query && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-xs text-ink-400">Narrow by:</span>
            {CATEGORY_TREE.map((group) => (
              <Link
                key={group.id}
                to={`/search?q=${encodeURIComponent(query)}&cat=${group.id}`}
                className="rounded-full border border-paper-strong px-3 py-1 text-xs text-ink-600 transition-colors hover:border-navy-900/30 hover:text-ink-900"
              >
                {group.label}
              </Link>
            ))}
          </div>
        )}

        {isLoading && <LoadingSkeleton rows={4} />}

        {!isLoading && results.length === 0 && query && (
          <div className="flex flex-col items-center py-20 text-center">
            <SearchX className="h-12 w-12 text-ink-400/40" />
            <h2 className="mt-4 font-serif text-xl font-semibold text-ink-900">No results found</h2>
            <p className="mt-2 max-w-sm text-sm text-ink-600">
              No products matched &ldquo;{query}&rdquo;. Try a different term or browse categories.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {CATEGORY_TREE.map((group) => (
                <Link
                  key={group.id}
                  to={`/c/${group.id}`}
                  className="rounded-full border border-paper-strong px-4 py-2 text-sm text-ink-600 transition-colors hover:border-navy-900 hover:text-ink-900"
                >
                  {group.icon} {group.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !query && (
          <div className="py-12 text-center">
            <p className="text-sm text-ink-400">Enter a search term above to find products.</p>
          </div>
        )}

        {/* Grouped results */}
        {grouped.map(([category, items]) => (
          <section key={category} className="mb-10">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-serif text-lg font-semibold text-ink-900">{category}</h2>
              <Badge variant="neutral">{items.length} results</Badge>
            </div>
            <div className="space-y-3">
              {items.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
