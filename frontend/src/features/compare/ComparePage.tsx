import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { X, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import Stars from '../../components/ui/Stars';
import Meter from '../../components/ui/Meter';
import MonogramTile from '../../components/ui/MonogramTile';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { fetchProductDetail } from '../../lib/api';
import { useCompare } from './useCompare';
import { useSearchContext } from '../../context/SearchContext';
import type { ProductDetail } from '../../types';

const ROW_HEADERS = [
  { key: 'insurer', label: 'Insurer' },
  { key: 'coverageAmount', label: 'Coverage amount' },
  { key: 'priceFrom', label: 'Starting premium' },
  { key: 'coverageType', label: 'Plan type' },
  { key: 'rating', label: 'Overall rating' },
];

const ComparePage = () => {
  const { compareIds } = useCompare();
  const { removeFromCompare } = useSearchContext();

  const queries = useQueries({
    queries: compareIds.map((id) => ({
      queryKey: ['product-detail', id],
      queryFn: () => fetchProductDetail(id),
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const products = queries.map((q) => q.data).filter(Boolean) as ProductDetail[];

  if (compareIds.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-serif font-semibold text-ink-900">No products to compare</p>
        <p className="mt-2 text-sm text-ink-600">
          Browse categories and click &ldquo;Compare&rdquo; on any product.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-navy-900 px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-navy-900 hover:text-ink-on"
        >
          <ArrowLeft className="h-4 w-4" /> Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Header */}
      <div className="bg-navy-900 py-10">
        <div className="mx-auto max-w-7xl px-4">
          <Link to="/" className="mb-4 flex items-center gap-1 text-xs text-ink-onmuted hover:text-ink-on">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink-on">
            Compare products
          </h1>
          <p className="mt-1 text-sm text-ink-onmuted">
            {compareIds.length} of 5 selected
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading && <LoadingSkeleton rows={5} />}

        {!loading && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              {/* Sticky column headers */}
              <thead>
                <tr>
                  <th className="w-40 border-b border-paper-strong bg-paper pb-3 text-left align-bottom">
                    <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                      Product
                    </span>
                  </th>
                  {products.map((p) => (
                    <th
                      key={p.id}
                      className="border-b border-paper-strong bg-paper px-4 pb-3 text-left align-top"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <MonogramTile name={p.insurer} size="sm" />
                          <div>
                            <Link
                              to={`/p/${p.id}`}
                              className="font-serif text-sm font-semibold text-ink-900 hover:text-navy-900 hover:underline"
                            >
                              {p.name}
                            </Link>
                            <p className="mt-0.5 text-[11px] text-ink-400">{p.insurer}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCompare(p.id)}
                          className="shrink-0 text-ink-400 transition-colors hover:text-ink-900"
                          aria-label={`Remove ${p.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Basic rows */}
                {ROW_HEADERS.map((row) => (
                  <tr key={row.key} className="border-b border-paper-strong">
                    <td className="py-3 text-xs font-medium uppercase tracking-widest text-ink-400">
                      {row.label}
                    </td>
                    {products.map((p) => {
                      const val = p[row.key as keyof ProductDetail];
                      return (
                        <td key={p.id} className="px-4 py-3 text-sm text-ink-900">
                          {row.key === 'priceFrom'
                            ? `₹${val}/month`
                            : row.key === 'coverageType'
                            ? String(val).replace(/-/g, ' ')
                            : row.key === 'rating'
                            ? (
                              <div className="flex items-center gap-2">
                                <span className="font-data font-semibold">{Number(val).toFixed(1)}/5</span>
                                <Stars value={Number(val)} size="xs" />
                              </div>
                            )
                            : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Rating breakdown rows */}
                <tr>
                  <td
                    colSpan={products.length + 1}
                    className="bg-paper-raised py-3 pl-0 text-xs font-semibold uppercase tracking-widest text-ink-400"
                  >
                    Rating dimensions
                  </td>
                </tr>
                {products[0]?.scorecard.map((score) => (
                  <tr key={score.id} className="border-b border-paper-strong">
                    <td className="py-3 text-xs text-ink-600">{score.label}</td>
                    {products.map((p) => {
                      const dim = p.scorecard.find((s) => s.label === score.label);
                      const numScore = dim?.status === 'excellent' ? 4.8 : dim?.status === 'good' ? 4.0 : dim?.status === 'warning' ? 3.0 : 1.5;
                      return (
                        <td key={p.id} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-20">
                              <Meter value={numScore} max={5} height={5} animated={false} />
                            </div>
                            <span
                              className={clsx(
                                'text-xs font-medium capitalize',
                                dim?.status === 'excellent' ? 'text-emerald-600' :
                                dim?.status === 'good' ? 'text-green-600' :
                                dim?.status === 'warning' ? 'text-amber-600' : 'text-red-600',
                              )}
                            >
                              {dim?.status ?? '—'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Highlights row */}
                <tr className="border-b border-paper-strong">
                  <td className="py-3 text-xs font-medium uppercase tracking-widest text-ink-400">
                    Highlights
                  </td>
                  {products.map((p) => (
                    <td key={p.id} className="px-4 py-3">
                      <ul className="space-y-1">
                        {p.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-1.5 text-xs text-ink-600">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
