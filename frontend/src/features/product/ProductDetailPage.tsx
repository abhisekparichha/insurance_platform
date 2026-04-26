import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, PlusCircle, CheckCircle2, BookOpen } from 'lucide-react';
import Stars from '../../components/ui/Stars';
import Score from '../../components/ui/Score';
import Badge from '../../components/ui/Badge';
import KVBlock from '../../components/ui/KVBlock';
import MonogramTile from '../../components/ui/MonogramTile';
import Tabs from '../../components/ui/Tabs';
import RatingBreakdown from './RatingBreakdown';
import CoverageLists from './CoverageLists';
import ReviewCards from './ReviewCards';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { fetchProductDetail, fetchProducts } from '../../lib/api';
import { useSearchContext } from '../../context/SearchContext';
import ProductRow from '../category/ProductRow';

const PRODUCT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'documents', label: 'Documents' },
] as const;

type TabKey = (typeof PRODUCT_TABS)[number]['key'];

// Derive inclusions/exclusions from benefits & policySections
const COMMON_INCLUSIONS = [
  'In-patient hospitalisation',
  'Day care procedures',
  'Pre & post hospitalisation',
  'Ambulance charges',
  'Modern treatments',
];
const COMMON_EXCLUSIONS = [
  '30-day initial waiting period',
  'Cosmetic or aesthetic treatment',
  'Fertility treatment',
  'Self-inflicted injuries',
  'Experimental treatments',
];

const ProductDetailPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { addToCompare, removeFromCompare, isInCompare, compareIds } = useSearchContext();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => fetchProductDetail(productId!),
    enabled: Boolean(productId),
  });

  const { data: related } = useQuery({
    queryKey: ['related-products', product?.categoryId],
    queryFn: () =>
      fetchProducts({ categoryId: product!.categoryId, pageSize: 3 }),
    enabled: Boolean(product?.categoryId),
  });

  const relatedProducts = (related?.items ?? []).filter((p) => p.id !== productId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-24 text-center text-sm text-ink-400">
        Product not found.{' '}
        <Link to="/" className="font-semibold text-navy-900 underline">
          Go home
        </Link>
      </div>
    );
  }

  const inCompare = isInCompare(product.id);
  const compareFull = compareIds.length >= 5 && !inCompare;

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-navy-900 py-10">
        <div className="mx-auto max-w-5xl px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-ink-onmuted" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-ink-on">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/c/${product.categoryId}`} className="hover:text-ink-on">
              {product.categoryId.replace(/_/g, ' ')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gold">{product.name}</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-start gap-5">
            <MonogramTile name={product.insurer} size="lg" />

            <div className="flex-1">
              <p className="text-xs text-ink-onmuted">{product.insurer}</p>
              <h1 className="mt-1 font-serif text-3xl font-semibold text-ink-on">{product.name}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Score value={product.rating} size="lg" />
                  <Stars value={product.rating} size="sm" showValue={false} />
                </div>
                {product.rating >= 4.5 && <Badge variant="editors-pick">Editor's pick</Badge>}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <KVBlock label="Coverage" value={product.coverageAmount} size="sm" />
                <KVBlock label="Starts from" value={`₹${product.priceFrom}/month`} size="sm" />
                <KVBlock label="Type" value={product.coverageType.replace(/-/g, ' ')} size="sm" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 sm:items-end">
              <a
                href={product.policyDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm text-ink-on transition-colors hover:border-white hover:bg-white/10"
              >
                <BookOpen className="h-4 w-4" /> Policy wording
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
              <button
                onClick={() => inCompare ? removeFromCompare(product.id) : addToCompare(product.id)}
                disabled={compareFull}
                className="flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inCompare ? (
                  <><CheckCircle2 className="h-4 w-4" /> In compare</>
                ) : (
                  <><PlusCircle className="h-4 w-4" /> Add to compare</>
                )}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 px-3 py-0.5 text-xs text-ink-onmuted"
              >
                {tag.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Tabs
          tabs={PRODUCT_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.key === 'reviews' ? product.reviews.length : undefined,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-8">
          {activeTab === 'overview' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-900">About this product</h2>
                <p className="mt-3 leading-relaxed text-ink-600">{product.description}</p>

                <h3 className="mt-8 font-serif text-base font-semibold text-ink-900">Key benefits</h3>
                <ul className="mt-3 space-y-2">
                  {product.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm text-ink-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="rounded-lg border border-paper-strong bg-paper-surface p-5">
                <RatingBreakdown scores={product.scorecard} overallRating={product.rating} />
              </aside>
            </div>
          )}

          {activeTab === 'coverage' && (
            <CoverageLists
              inclusions={product.benefits.length > 0 ? product.benefits : COMMON_INCLUSIONS}
              exclusions={COMMON_EXCLUSIONS}
            />
          )}

          {activeTab === 'ratings' && (
            <div className="max-w-2xl">
              <RatingBreakdown scores={product.scorecard} overallRating={product.rating} />
            </div>
          )}

          {activeTab === 'reviews' && (
            <ReviewCards reviews={product.reviews} />
          )}

          {activeTab === 'documents' && (
            <div className="space-y-3 max-w-lg">
              {product.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-paper-strong bg-paper-surface px-4 py-3 text-sm transition-colors hover:border-navy-900/30"
                >
                  <span className="flex items-center gap-2 font-medium text-ink-900">
                    <BookOpen className="h-4 w-4 text-ink-400" />
                    {doc.label}
                  </span>
                  <span className="text-xs uppercase text-ink-400">{doc.type}</span>
                </a>
              ))}
              {product.documents.length === 0 && (
                <p className="text-sm text-ink-400">No documents published.</p>
              )}
            </div>
          )}
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="mb-4 font-serif text-xl font-semibold text-ink-900">
              Related products
            </h2>
            <div className="space-y-3">
              {relatedProducts.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
